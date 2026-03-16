export const DEFAULTS = {
  startSecL1:8, startSecL2:5, startRepsL3:1,
  stepSec:2, daysPerStep:7, minHangsPerDay:2,
  graceDays:1, penaltySec:2, restDaysPerWeek:1,
  levelupThreshL1:30, levelupThreshL2:20,
  delayStart:5, autoStop:true
};
export const LIMITS = {
  startSecL1:[2,60], startSecL2:[2,60], startRepsL3:[1,20],
  stepSec:[1,10], daysPerStep:[1,30], minHangsPerDay:[1,10],
  graceDays:[0,7], penaltySec:[0,10], restDaysPerWeek:[0,3],
  levelupThreshL1:[10,120], levelupThreshL2:[10,120],
  delayStart:[0,30]
};

export function dayKey(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

export function computeProgression(sessions, s, level) {
  const startVal = level===1 ? s.startSecL1 : level===2 ? s.startSecL2 : s.startRepsL3;
  const { stepSec, daysPerStep, minHangsPerDay, graceDays, penaltySec } = s;
  const restPerWeek = s.restDaysPerWeek || 0;

  // only sessions for this level
  const lvlSessions = sessions.filter(x => (x.level||1) === level);
  if (!lvlSessions.length) return { targetVal:startVal, qualDays:0, daysIntoStep:0, nextStepIn:daysPerStep };

  const counts = {};
  lvlSessions.forEach(x => { const k=dayKey(new Date(x.ts)); counts[k]=(counts[k]||0)+1; });

  const firstDate = new Date(lvlSessions[0].ts); firstDate.setHours(0,0,0,0);
  const yesterday = new Date(); yesterday.setHours(0,0,0,0); yesterday.setDate(yesterday.getDate()-1);

  let qualDays=0, penaltyPool=0, missStreak=0, weekMisses=0, weekDay=0;
  const d = new Date(firstDate);
  while (d <= yesterday) {
    const c = counts[dayKey(d)]||0;
    if (c >= minHangsPerDay)     { qualDays++; missStreak=0; }
    else if (c === 0)            {
      weekMisses++;
      // Exempt planned rest days from penalty
      if(weekMisses<=restPerWeek){ missStreak=0; }
      else { missStreak++; if(missStreak>graceDays) penaltyPool+=penaltySec; }
    }
    else                         { missStreak=0; } // partial — neutral
    weekDay++;
    if(weekDay>=7){ weekDay=0; weekMisses=0; }
    d.setDate(d.getDate()+1);
  }

  const earned   = Math.floor(qualDays/daysPerStep)*stepSec;
  const targetVal = Math.max(startVal, startVal+earned-penaltyPool);
  const daysIntoStep = qualDays%daysPerStep;
  return { targetVal, qualDays, daysIntoStep, nextStepIn:daysPerStep-daysIntoStep };
}

// Browser globals (no-op in Node/Vitest)
if (typeof window !== 'undefined') {
  Object.assign(window, { DEFAULTS, LIMITS, dayKey, computeProgression });
}
