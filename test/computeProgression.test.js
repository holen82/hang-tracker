import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DEFAULTS, computeProgression } from '../lib.js';

// Helper: create a session at noon on a given date offset from "today"
// daysAgo=0 means today, daysAgo=1 means yesterday, etc.
function makeSession(daysAgo, level = 1) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(12, 0, 0, 0);
  return { ts: d.getTime(), level };
}

// Build N qualifying days: 2 sessions each day, starting daysBack days ago
function qualDaySessions(count, level = 1, startDaysAgo = null) {
  // startDaysAgo defaults so the last qualifying day is yesterday (daysAgo=1)
  const offset = startDaysAgo ?? count; // day count back from today
  const sessions = [];
  for (let i = 0; i < count; i++) {
    const daysAgo = offset - i; // oldest first
    sessions.push(makeSession(daysAgo, level));
    sessions.push(makeSession(daysAgo, level));
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

  it('miss within grace period → no penalty', () => {
    // 7 qual days, then 1 miss (grace=1), then yesterday qual
    const s = qualDaySessions(7, 1, 9); // days 9..3 ago
    // miss day 2, qual day 1
    s.push(makeSession(1));
    s.push(makeSession(1));
    const r = computeProgression(s, { ...S, graceDays: 1 }, 1);
    // 8 qual days = 1 step (floor(8/7)=1)
    expect(r.targetVal).toBe(S.startSecL1 + S.stepSec);
  });

  it('miss beyond grace → penalty applied', () => {
    // 7 qual days (days 9..3 ago), then days 2 and 1 missed (2 consecutive misses)
    // grace=1: first miss → within grace (no penalty), second → penalised
    // earned = floor(7/7)*2 = 2; penalty = 1*2 = 2; targetVal = max(8, 8+2-2) = 8
    const s = qualDaySessions(7, 1, 9);
    const settings = { ...S, graceDays: 1, penaltySec: 2 };
    const r = computeProgression(s, settings, 1);
    expect(r.targetVal).toBe(S.startSecL1);
  });

  it('penalty never goes below startVal', () => {
    // Many missed days with high penalty
    const s = [makeSession(30), makeSession(30)]; // one qual day far back
    const settings = { ...S, penaltySec: 100, graceDays: 0 };
    const r = computeProgression(s, settings, 1);
    expect(r.targetVal).toBeGreaterThanOrEqual(settings.startSecL1);
  });

  it('partial days (< minHangs) are neutral — no penalty, no qual', () => {
    // 7 qual days then 3 days with 1 session (partial)
    const s = qualDaySessions(7, 1, 10);
    s.push(makeSession(3));
    s.push(makeSession(2));
    s.push(makeSession(1));
    const r = computeProgression(s, S, 1);
    // 7 qual + 3 partial = 7 qual, 0 penalty
    expect(r.qualDays).toBe(7);
    expect(r.targetVal).toBe(S.startSecL1 + S.stepSec);
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
    // Sessions with no .level property should count for level 1
    const sessions = [];
    for (let i = 0; i < 7; i++) {
      const daysAgo = 7 - i;
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      d.setHours(12, 0, 0, 0);
      sessions.push({ ts: d.getTime() }); // no .level
      sessions.push({ ts: d.getTime() });
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
    // 2 sessions today (daysAgo=0) — "today" is excluded from progression
    const sessions = [makeSession(0), makeSession(0)];
    const r = computeProgression(sessions, S, 1);
    expect(r.qualDays).toBe(0);
    expect(r.targetVal).toBe(S.startSecL1);
  });
});
