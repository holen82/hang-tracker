import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DEFAULTS, computeProgression, computeRestDayStatus, computeWaveDayTarget, computeCycleStatus } from '../lib.js';

// Helper: create a session at noon on a given date offset from "today"
// daysAgo=0 means today, daysAgo=1 means yesterday, etc.
function makeSession(daysAgo, level = 1) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(12, 0, 0, 0);
  return { ts: d.getTime(), level };
}

// Build N qualifying days: DEFAULTS.minHangsPerDay sessions each day, starting daysBack days ago
function qualDaySessions(count, level = 1, startDaysAgo = null) {
  // startDaysAgo defaults so the last qualifying day is yesterday (daysAgo=1)
  const offset = startDaysAgo ?? count; // day count back from today
  const sessions = [];
  for (let i = 0; i < count; i++) {
    const daysAgo = offset - i; // oldest first
    for (let j = 0; j < DEFAULTS.minHangsPerDay; j++) {
      sessions.push(makeSession(daysAgo, level));
    }
  }
  return sessions;
}

// Build N partial days: DEFAULTS.partialHangsMin sessions each day
function partialDaySessions(count, level = 1, startDaysAgo = null) {
  const offset = startDaysAgo ?? count;
  const sessions = [];
  for (let i = 0; i < count; i++) {
    const daysAgo = offset - i;
    for (let j = 0; j < DEFAULTS.partialHangsMin; j++) {
      sessions.push(makeSession(daysAgo, level));
    }
  }
  return sessions;
}

// Build N boost days: DEFAULTS.minHangsPerDay + 1 sessions each day
function boostDaySessions(count, level = 1, startDaysAgo = null) {
  const offset = startDaysAgo ?? count;
  const sessions = [];
  for (let i = 0; i < count; i++) {
    const daysAgo = offset - i;
    for (let j = 0; j < DEFAULTS.minHangsPerDay + 1; j++) {
      sessions.push(makeSession(daysAgo, level));
    }
  }
  return sessions;
}

const S = { ...DEFAULTS }; // default settings

describe('computeProgression', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Fix "today" to noon so date boundaries are stable
    vi.setSystemTime(new Date(2025, 0, 20, 12, 0, 0)); // 2025-01-20
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('no sessions → baseline', () => {
    const r = computeProgression([], S, 1);
    expect(r.targetVal).toBe(S.startSecL1);
    expect(r.qualDays).toBe(0);
    expect(r.daysIntoStep).toBe(0);
    expect(r.nextStepIn).toBe(S.daysPerStep);
  });

  it('7 qualifying days → one step earned (targetVal = start + step)', () => {
    const sessions = qualDaySessions(7);
    const r = computeProgression(sessions, S, 1);
    expect(r.targetVal).toBe(S.startSecL1 + S.stepSec);
    expect(r.qualDays).toBe(7);
  });

  it('6 qualifying days → not yet a step (nextStepIn = 1)', () => {
    const sessions = qualDaySessions(6);
    const r = computeProgression(sessions, S, 1);
    expect(r.targetVal).toBe(S.startSecL1);
    expect(r.nextStepIn).toBe(1);
  });

  it('14 qualifying days → two steps earned', () => {
    const sessions = qualDaySessions(14);
    const r = computeProgression(sessions, S, 1);
    expect(r.targetVal).toBe(S.startSecL1 + 2 * S.stepSec);
  });

  it('max calibrated: startVal becomes 40% of maxSecL1 when higher than configuredStart', () => {
    // maxSecL1=60 → 40% = 24 > configuredStart(8) → targetVal = 24
    const r = computeProgression([], { ...S, maxSecL1: 60 }, 1);
    expect(r.targetVal).toBe(24);
  });

  it('max calibrated: configuredStart wins when 40% of max is lower', () => {
    // maxSecL1=10 → 40% = 4 < configuredStart(8) → stays at 8
    const r = computeProgression([], { ...S, maxSecL1: 10 }, 1);
    expect(r.targetVal).toBe(S.startSecL1);
  });

  it('no-change days (1 to partialHangsMin-1) are neutral — no penalty, no qual', () => {
    // 7 qual days then 3 days with 1 session each (below partialHangsMin)
    const s = qualDaySessions(7, 1, 10);
    s.push(makeSession(3)); // 1 session each (no change tier)
    s.push(makeSession(2));
    s.push(makeSession(1));
    const r = computeProgression(s, S, 1);
    // 7 qual + 3 neutral = 7 qual, target = 1 step
    expect(r.qualDays).toBe(7);
    expect(r.targetVal).toBe(S.startSecL1 + S.stepSec);
  });

  it('partial days earn 0.5 qual score each — two partial days advance progression', () => {
    // daysPerStep=7: need qualScore>=7 to earn a step
    // 6 full qual days (score=6) + 2 partial days (score=1) = 7 → 1 step earned
    const s = qualDaySessions(6, 1, 8); // days 8..3 ago
    const partial = partialDaySessions(2, 1, 2); // days 2..1 ago
    const r = computeProgression([...s, ...partial], S, 1);
    expect(r.qualScore).toBe(7);
    expect(r.targetVal).toBe(S.startSecL1 + S.stepSec);
  });

  it('partial days do not increment integer qualDays', () => {
    const s = partialDaySessions(4, 1, 4);
    const r = computeProgression(s, S, 1);
    expect(r.qualDays).toBe(0); // no full qual days
    expect(r.qualScore).toBe(2); // 4 * 0.5
  });

  it('boost days earn 1.5 qual score each — two boost days exceed one full step', () => {
    // 2 boost days = qualScore 3.0; daysPerStep=7 → not enough for a step alone
    // 4 full days + 2 boost days = 4 + 3 = 7 → 1 step
    const s = qualDaySessions(4, 1, 6); // days 6..3 ago
    const boost = boostDaySessions(2, 1, 2); // days 2..1 ago
    const r = computeProgression([...s, ...boost], S, 1);
    expect(r.qualScore).toBe(7);
    expect(r.targetVal).toBe(S.startSecL1 + S.stepSec);
  });

  it('boost days increment qualDays (counted as target-met days)', () => {
    const s = boostDaySessions(3, 1, 3);
    const r = computeProgression(s, S, 1);
    expect(r.qualDays).toBe(3);
    expect(r.qualScore).toBe(4.5); // 3 * 1.5
  });

  it('mixed tiers compute correct qualScore', () => {
    // 1 boost (1.5) + 1 partial (0.5) + 1 target (1.0) = 3.0
    const boost = boostDaySessions(1, 1, 3);
    const partial = partialDaySessions(1, 1, 2);
    const target = qualDaySessions(1, 1, 1);
    const r = computeProgression([...boost, ...partial, ...target], S, 1);
    expect(r.qualScore).toBe(3);
    expect(r.qualDays).toBe(2); // only boost + target count
  });

  it('level 2 baseline', () => {
    const r = computeProgression([], S, 2);
    expect(r.targetVal).toBe(S.startSecL2);
  });

  it('level 3 uses reps baseline', () => {
    const r = computeProgression([], S, 3);
    expect(r.targetVal).toBe(S.startRepsL3);
  });

  it('level isolation — L1 sessions do not affect L3', () => {
    const sessions = qualDaySessions(14, 1);
    const r = computeProgression(sessions, S, 3);
    expect(r.qualDays).toBe(0);
    expect(r.targetVal).toBe(S.startRepsL3);
  });

  it('sessions without .level default to level 1', () => {
    const sessions = [];
    for (let i = 0; i < 7; i++) {
      const daysAgo = 7 - i;
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      d.setHours(12, 0, 0, 0);
      for (let j = 0; j < DEFAULTS.minHangsPerDay; j++) {
        sessions.push({ ts: d.getTime() }); // no .level
      }
    }
    const r = computeProgression(sessions, S, 1);
    expect(r.qualDays).toBe(7);
    expect(r.targetVal).toBe(S.startSecL1 + S.stepSec);
  });

  it('daysIntoStep cycles to 0 at step boundary (7 qual days)', () => {
    const sessions = qualDaySessions(7);
    const r = computeProgression(sessions, S, 1);
    expect(r.daysIntoStep).toBe(0);
    expect(r.nextStepIn).toBe(7);
  });

  it('daysIntoStep mid-step (10 qual days → 3 into step)', () => {
    const sessions = qualDaySessions(10);
    const r = computeProgression(sessions, S, 1);
    expect(r.daysIntoStep).toBe(3);
    expect(r.nextStepIn).toBe(4);
  });

  it('today excluded — sessions only today give qualDays=0', () => {
    // sessions today (daysAgo=0) — "today" is excluded from progression
    const sessions = qualDaySessions(1, 1, 0); // today
    const r = computeProgression(sessions, S, 1);
    expect(r.qualDays).toBe(0);
    expect(r.targetVal).toBe(S.startSecL1);
  });
});

describe('computeRestDayStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 20, 12, 0, 0)); // 2025-01-20
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('no rest days configured → always false', () => {
    const sessions = qualDaySessions(7);
    const r = computeRestDayStatus(sessions, { ...S, restDaysPerWeek: 0 }, 1);
    expect(r.isRestDay).toBe(false);
    expect(r.nextIsRestDay).toBe(false);
  });

  it('6 training days in last 7 → today is rest day', () => {
    // 6 days in the window (today + 5 past days) each with partialHangsMin sessions
    const sessions = partialDaySessions(6, 1, 5); // days 5..0
    const r = computeRestDayStatus(sessions, S, 1);
    expect(r.isRestDay).toBe(true);
    expect(r.nextIsRestDay).toBe(false);
  });

  it('5 training days in last 7 → tomorrow is rest day', () => {
    // 5 qualifying days in the window (days 5..1), none today
    const sessions = partialDaySessions(5, 1, 5); // days 5..1
    const r = computeRestDayStatus(sessions, S, 1);
    expect(r.isRestDay).toBe(false);
    expect(r.nextIsRestDay).toBe(true);
  });

  it('4 training days in last 7 → neither', () => {
    const sessions = partialDaySessions(4, 1, 4); // days 4..1
    const r = computeRestDayStatus(sessions, S, 1);
    expect(r.isRestDay).toBe(false);
    expect(r.nextIsRestDay).toBe(false);
  });
});

// ── Helpers for wave / cycle tests ──────────────────────────────────────────

// Returns a timestamp for midnight N days ago relative to the faked "today"
function daysAgoMidnight(n) {
  const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-n);
  return d.getTime();
}

describe('computeWaveDayTarget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 20, 12, 0, 0)); // 2025-01-20
  });
  afterEach(() => { vi.useRealTimers(); });

  it('null cycleStartDate → type null', () => {
    const r = computeWaveDayTarget(null, S);
    expect(r.type).toBeNull();
    expect(r.sessionTarget).toBeNull();
  });

  it('day 0 (cycle starts today) → high day', () => {
    const r = computeWaveDayTarget(daysAgoMidnight(0), S);
    expect(r.type).toBe('high');
    expect(r.sessionTarget).toBe(S.waveHighSessions);
  });

  it('day 1 → mid day', () => {
    const r = computeWaveDayTarget(daysAgoMidnight(1), S);
    expect(r.type).toBe('mid');
    expect(r.sessionTarget).toBe(S.waveMidSessions);
  });

  it('day 2 → low day', () => {
    const r = computeWaveDayTarget(daysAgoMidnight(2), S);
    expect(r.type).toBe('low');
    expect(r.sessionTarget).toBe(S.waveLowSessions);
  });

  it('day 3 → high day (second high in wave)', () => {
    const r = computeWaveDayTarget(daysAgoMidnight(3), S);
    expect(r.type).toBe('high');
  });

  it('day 6 → rest day', () => {
    const r = computeWaveDayTarget(daysAgoMidnight(6), S);
    expect(r.type).toBe('rest');
    expect(r.sessionTarget).toBe(0);
  });

  it('day 7 → wraps back to high (second full wave)', () => {
    const r = computeWaveDayTarget(daysAgoMidnight(7), S);
    expect(r.type).toBe('high');
  });
});

describe('computeCycleStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 20, 12, 0, 0)); // 2025-01-20
  });
  afterEach(() => { vi.useRealTimers(); });

  it('no cycleStartDate → active false', () => {
    const r = computeCycleStatus({ level: 1 }, S);
    expect(r.active).toBe(false);
  });

  it('day 0 → week 1, not deload, not complete', () => {
    const r = computeCycleStatus({ level:1, cycleStartDate: daysAgoMidnight(0) }, S);
    expect(r.active).toBe(true);
    expect(r.week).toBe(1);
    expect(r.isDeload).toBe(false);
    expect(r.isComplete).toBe(false);
  });

  it('day 6 → still week 1', () => {
    const r = computeCycleStatus({ level:1, cycleStartDate: daysAgoMidnight(6) }, S);
    expect(r.week).toBe(1);
  });

  it('day 7 → week 2', () => {
    const r = computeCycleStatus({ level:1, cycleStartDate: daysAgoMidnight(7) }, S);
    expect(r.week).toBe(2);
  });

  it('day cycleWeeks*7 → deload started', () => {
    const s = { ...S, cycleWeeks: 6 };
    const r = computeCycleStatus({ level:1, cycleStartDate: daysAgoMidnight(s.cycleWeeks*7) }, s);
    expect(r.isDeload).toBe(true);
    expect(r.isComplete).toBe(false);
    expect(r.daysRemaining).toBe(7);
  });

  it('day cycleWeeks*7 + 3 → deload in progress', () => {
    const s = { ...S, cycleWeeks: 6 };
    const r = computeCycleStatus({ level:1, cycleStartDate: daysAgoMidnight(s.cycleWeeks*7+3) }, s);
    expect(r.isDeload).toBe(true);
    expect(r.daysRemaining).toBe(4);
  });

  it('day cycleWeeks*7 + 7 → complete', () => {
    const s = { ...S, cycleWeeks: 6 };
    const r = computeCycleStatus({ level:1, cycleStartDate: daysAgoMidnight(s.cycleWeeks*7+7) }, s);
    expect(r.isComplete).toBe(true);
    expect(r.isDeload).toBe(false);
  });
});
