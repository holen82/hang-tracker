export const DEFAULTS = {
  startSecL1:8, startSecL2:5, startRepsL3:1,
  stepSec:2, daysPerStep:7, minHangsPerDay:6, partialHangsMin:4,
  restDaysPerWeek:1,
  levelupThreshL1:30, levelupThreshL2:20,
  delayStart:5, autoStop:true,
  // Max calibration (0 = not tested)
  maxSecL1:0, maxSecL2:0, maxRepsL3:0,
  // Wave loading
  waveHighSessions:8, waveMidSessions:6, waveLowSessions:4,
  // Cycle structure
  cycleWeeks:6
};
export const LIMITS = {
  startSecL1:[2,60], startSecL2:[2,60], startRepsL3:[1,20],
  stepSec:[1,10], daysPerStep:[1,30], minHangsPerDay:[1,10], partialHangsMin:[1,10],
  restDaysPerWeek:[0,3],
  levelupThreshL1:[10,120], levelupThreshL2:[10,120],
  delayStart:[0,30],
  maxSecL1:[0,300], maxSecL2:[0,300], maxRepsL3:[0,50],
  waveHighSessions:[1,20], waveMidSessions:[1,20], waveLowSessions:[1,20],
  cycleWeeks:[4,8]
};

export function dayKey(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

export function computeProgression(sessions, s, level) {
  const configuredStart = level===1 ? s.startSecL1 : level===2 ? s.startSecL2 : s.startRepsL3;
  const maxVal = level===1 ? (s.maxSecL1||0) : level===2 ? (s.maxSecL2||0) : (s.maxRepsL3||0);
  const startVal = maxVal > 0 ? Math.max(configuredStart, Math.round(maxVal * 0.4)) : configuredStart;
  const { stepSec, daysPerStep, minHangsPerDay } = s;
  const partialHangsMin = s.partialHangsMin || 4;

  // only training sessions for this level (exclude max tests)
  const lvlSessions = sessions.filter(x => (x.level||1) === level && !x.isMax);
  if (!lvlSessions.length) return { targetVal:startVal, qualDays:0, qualScore:0, daysIntoStep:0, nextStepIn:daysPerStep };

  const counts = {};
  lvlSessions.forEach(x => { const k=dayKey(new Date(x.ts)); counts[k]=(counts[k]||0)+1; });

  const firstDate = new Date(lvlSessions[0].ts); firstDate.setHours(0,0,0,0);
  const yesterday = new Date(); yesterday.setHours(0,0,0,0); yesterday.setDate(yesterday.getDate()-1);

  let qualDays=0, qualScore=0;
  const d = new Date(firstDate);
  while (d <= yesterday) {
    const c = counts[dayKey(d)]||0;
    if (c >= minHangsPerDay + 1)   { qualScore += 1.5; qualDays++; }
    else if (c >= minHangsPerDay)  { qualScore += 1.0; qualDays++; }
    else if (c >= partialHangsMin) { qualScore += 0.5; }
    // else: missed or neutral day — no effect
    d.setDate(d.getDate()+1);
  }

  const earned = Math.floor(qualScore/daysPerStep)*stepSec;
  const targetVal = startVal + earned;
  const daysIntoStep = qualScore%daysPerStep;
  return { targetVal, qualDays, qualScore, daysIntoStep, nextStepIn:daysPerStep-daysIntoStep };
}

export function computeRestDayStatus(sessions, s, level) {
  const restPerWeek = s.restDaysPerWeek || 0;
  if (restPerWeek === 0) return { isRestDay: false, nextIsRestDay: false };

  const partialHangsMin = s.partialHangsMin || 4;
  const lvlSessions = sessions.filter(x => (x.level||1) === level && !x.isMax);
  const counts = {};
  lvlSessions.forEach(x => { const k=dayKey(new Date(x.ts)); counts[k]=(counts[k]||0)+1; });

  // Count training days in the last 7 days (today through 6 days ago)
  const today = new Date(); today.setHours(0,0,0,0);
  let weekTrainingDays = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const c = counts[dayKey(d)] || 0;
    if (c >= partialHangsMin) weekTrainingDays++;
  }

  const trainingTarget = 7 - restPerWeek;
  const todayTrained  = (counts[dayKey(today)] || 0) >= partialHangsMin;
  const isRestDay     = !todayTrained && weekTrainingDays >= trainingTarget;
  const nextIsRestDay = todayTrained && weekTrainingDays >= trainingTarget;
  return { isRestDay, nextIsRestDay };
}

export function computeWaveDayTarget(cycleStartDate, s, refDate) {
  if (!cycleStartDate) return { type: null, sessionTarget: null };

  const day = refDate ? new Date(refDate) : new Date(); day.setHours(0,0,0,0);
  const start = new Date(cycleStartDate); start.setHours(0,0,0,0);
  const cycleDay = Math.floor((day - start) / 86400000);
  const dayInWave = cycleDay % 7;

  if (dayInWave === 6) return { type: 'rest', sessionTarget: 0 };
  if (dayInWave === 0 || dayInWave === 3) return { type: 'high', sessionTarget: s.waveHighSessions };
  if (dayInWave === 1 || dayInWave === 4) return { type: 'mid',  sessionTarget: s.waveMidSessions };
  return { type: 'low', sessionTarget: s.waveLowSessions };
}

export function computeCycleStatus(state, s) {
  if (!state || !state.cycleStartDate) return { active: false };

  const today = new Date(); today.setHours(0,0,0,0);
  const start = new Date(state.cycleStartDate); start.setHours(0,0,0,0);
  const cycleDay = Math.floor((today - start) / 86400000);

  const trainingEnd = s.cycleWeeks * 7;
  const deloadEnd   = trainingEnd + 7;

  if (cycleDay >= deloadEnd) {
    return { active: true, week: s.cycleWeeks, totalWeeks: s.cycleWeeks,
             isDeload: false, isComplete: true, cycleDay, daysRemaining: 0 };
  }
  if (cycleDay >= trainingEnd) {
    return { active: true, week: s.cycleWeeks, totalWeeks: s.cycleWeeks,
             isDeload: true, isComplete: false, cycleDay,
             daysRemaining: deloadEnd - cycleDay };
  }
  return { active: true, week: Math.floor(cycleDay / 7) + 1, totalWeeks: s.cycleWeeks,
           isDeload: false, isComplete: false, cycleDay,
           daysRemaining: trainingEnd - cycleDay };
}

// Browser globals (no-op in Node/Vitest)
if (typeof window !== 'undefined') {
  Object.assign(window, { DEFAULTS, LIMITS, dayKey, computeProgression, computeRestDayStatus,
    computeWaveDayTarget, computeCycleStatus });
}
