// ═══════════════════════════════════════════════════
//  STORAGE
// ═══════════════════════════════════════════════════
const SESSIONS_KEY  = 'hang_sessions_v1';
const SETTINGS_KEY  = 'hang_settings_v2';
const STATE_KEY     = 'hang_state_v1';
const CUE_OPEN_KEY  = 'hang_cue_open_v1';


function getSessions(){ try{ return JSON.parse(localStorage.getItem(SESSIONS_KEY))||[]; }catch{ return []; } }
function saveSessions(a){
  a.sort((x,y)=>x.ts-y.ts);
  localStorage.setItem(SESSIONS_KEY,JSON.stringify(a));
}
function getSettings(){ try{ return {...DEFAULTS,...JSON.parse(localStorage.getItem(SETTINGS_KEY))}; }catch{ return {...DEFAULTS}; } }
function saveSettings(s){ localStorage.setItem(SETTINGS_KEY,JSON.stringify(s)); }
function getState(){ try{ return JSON.parse(localStorage.getItem(STATE_KEY))||{level:1}; }catch{ return {level:1}; } }
function saveState(s){ localStorage.setItem(STATE_KEY,JSON.stringify(s)); }

// ═══════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════
const LEVEL_COLORS = { 1:'#c8f542', 2:'#42d4f5', 3:'#f542c8' };
const LEVEL_NAMES  = { 1:'Passive Hang', 2:'Active Hang', 3:'Scapular Shrugs' };
const LEVEL_UNITS  = { 1:'s', 2:'s', 3:' reps' };

// ═══════════════════════════════════════════════════
//  CUE CARD
// ═══════════════════════════════════════════════════
const CUE_DATA = {
  1: [
    'Grip slightly wider than shoulder-width, palms facing away',
    'Arms fully extended — elbows soft, not locked',
    'Shoulders relaxed and raised toward ears',
    'Body still — no swinging or kicking',
    'Stop well before your grip gives out'
  ],
  2: [
    'Start from a relaxed passive hang',
    'Pull shoulder blades DOWN — away from ears',
    'Pull shoulder blades BACK — together behind you',
    'Arms stay straight throughout — no elbow bend',
    'Feel your chest open and rise slightly'
  ],
  3: [
    'Begin in active hang — shoulders already engaged',
    'Drive scapulae DOWN and IN to rise slightly',
    'Hold the top for 1–2 seconds',
    'Lower slowly and with control',
    'Elbows remain straight throughout'
  ]
};

function toggleCue(){
  const card=document.getElementById('cue-card');
  card.classList.toggle('open');
  const open=card.classList.contains('open');
  document.getElementById('cue-arrow').textContent = open ? '▴' : '▾';
  localStorage.setItem(CUE_OPEN_KEY, open ? '1' : '0');
}

// ═══════════════════════════════════════════════════
//  TIMER STATE
// ═══════════════════════════════════════════════════
const RING_C = 2*Math.PI*108;
let running=false, startTime=null, elapsed=0, raf=null, lastDur=null;
let _levelupDismissedThisSession=false;
let currentReps=0;  // for level 3
let countdownActive=false, countdownTimer=null;
let _timerTarget=null, _timerAutoStop=false;
let _maxTestMode=false;

function getActiveLevel(){ return getState().level; }
function getLevelColor(l){ return LEVEL_COLORS[l]; }

function handleTap(){
  if (countdownActive) { cancelCountdown(); return; }
  const lvl = getActiveLevel();
  if (lvl===3) { /* rep counter — tap does nothing for timing */ return; }
  running ? stopTimer() : startTimer();
}

function startTimer(){
  const _s=getSettings();
  const st=getState();
  _timerTarget=computeProgression(getCycleSessions(getSessions(),st),_s,getActiveLevel()).targetVal;
  _timerAutoStop=_maxTestMode?false:_s.autoStop;
  running=true;
  startTime=performance.now()-elapsed;
  document.getElementById('tap-btn').textContent='Stop';
  document.getElementById('tap-btn').classList.add('running');
  document.getElementById('post-timer').classList.remove('visible');
  document.getElementById('ring').classList.remove('paused');
  document.getElementById('tap-delay').classList.add('hidden');
  document.getElementById('delay-hint').classList.remove('visible');
  const ringEl=document.getElementById('ring');
  if(_maxTestMode){ ringEl.classList.add('max-test'); ringEl.style.strokeDashoffset=''; }
  tick();
}

function updatePostTimerContext(val, target, lvl){
  const ctx=document.getElementById('postsave-context');
  if(!target){ctx.textContent='';return;}
  const unit=lvl===3?' reps':'s';
  const sessions=getSessions().filter(x=>(x.level||1)===lvl&&!x.isMax);
  const rawVal=lvl===3?val:val*1000;
  const prevBest=sessions.length?Math.max(...sessions.map(x=>x.duration)):0;
  if(sessions.length>0&&rawVal>prevBest){
    ctx.textContent='New personal best!'; ctx.style.color='var(--text)';
  } else if(val>=target){
    const over=lvl===3?(val-target):(val-target).toFixed(1);
    ctx.textContent=over>0?`${over}${unit} over target`:'Target hit!'; ctx.style.color='var(--accent)';
  } else {
    const short=lvl===3?(target-val):(target-val).toFixed(1);
    ctx.textContent=`${short}${unit} short — almost there`; ctx.style.color='var(--muted)';
  }
}

function stopTimer(){
  running=false;
  const target=_timerTarget;
  _timerTarget=null; _timerAutoStop=false;
  cancelAnimationFrame(raf);
  lastDur=elapsed;
  document.getElementById('tap-btn').textContent='Start Hang';
  document.getElementById('tap-btn').classList.remove('running');
  const _ring=document.getElementById('ring');
  _ring.classList.add('paused'); _ring.classList.remove('max-test');
  document.getElementById('delay-hint').classList.remove('visible');
  document.getElementById('cue-card').classList.add('hidden');
  if(_maxTestMode){ _maxTestMode=false; _handleMaxTestResult(lastDur); return; }
  document.getElementById('presave-sec').textContent=(lastDur/1000).toFixed(1);
  document.getElementById('presave-unit').textContent='seconds';
  updatePostTimerContext(lastDur/1000, target, getActiveLevel());
  document.getElementById('post-timer').classList.add('visible');
  document.getElementById('tap-btn-wrap').classList.add('hidden');
}

function adjustRep(delta){
  currentReps=Math.max(0, currentReps+delta);
  document.getElementById('rep-num').textContent=currentReps;
}

function showDelayBtn(){
  const btn=document.getElementById('tap-delay');
  btn.classList.remove('hidden');
  updateDelayBtn();
}

function updateDelayBtn(){
  const s=getSettings();
  const btn=document.getElementById('tap-delay');
  if(s.delayStart===0){
    btn.classList.add('hidden');
  } else {
    btn.querySelector('.tap-delay-sec').textContent=s.delayStart+'s';
  }
}

function toggleAutoStop(){
  const s=getSettings(); s.autoStop=!s.autoStop; saveSettings(s); renderSettings(s);
}

function handleDelayedStart(){
  if(countdownActive){ cancelCountdown(); return; }
  if(running){ stopTimer(); return; }
  startCountdown(getSettings().delayStart);
}

function startCountdown(secs){
  countdownActive=true;
  let remaining=secs;
  const secEl=document.getElementById('timer-sec');
  const msEl=document.getElementById('timer-ms');
  secEl.classList.add('countdown');
  secEl.textContent='-'+remaining;
  msEl.textContent='.0';
  document.getElementById('tap-btn').textContent='Cancel';
  document.getElementById('tap-delay').classList.add('hidden');
  document.getElementById('ring').classList.add('paused');
  countdownTimer=setInterval(()=>{
    remaining--;
    if(remaining>0){
      secEl.textContent='-'+remaining;
    } else {
      secEl.textContent='0';
      secEl.classList.remove('countdown');
      clearInterval(countdownTimer); countdownTimer=null;
      countdownActive=false;
      if(getActiveLevel()!==3) showDelayBtn();
      startTimer();
    }
  },1000);
}

function cancelCountdown(){
  if(!countdownActive) return;
  clearInterval(countdownTimer); countdownTimer=null;
  countdownActive=false;
  const secEl=document.getElementById('timer-sec');
  secEl.classList.remove('countdown');
  secEl.textContent='0';
  document.getElementById('timer-ms').textContent='.0';
  document.getElementById('tap-btn').textContent='Start Hang';
  if(getActiveLevel()!==3) showDelayBtn();
}

function saveRepSession(){
  lastDur=currentReps; // store reps as "duration" value
  if(_maxTestMode){ _maxTestMode=false; currentReps=0; document.getElementById('rep-num').textContent='0'; _handleMaxTestResult(lastDur); return; }
  const s=getSettings();
  const target=computeProgression(getCycleSessions(getSessions(),getState()),s,3).targetVal;
  document.getElementById('presave-sec').textContent=currentReps;
  document.getElementById('presave-unit').textContent='reps';
  updatePostTimerContext(currentReps, target, 3);
  currentReps=0;
  document.getElementById('rep-num').textContent='0';
  document.getElementById('post-timer').classList.add('visible');
  document.getElementById('tap-btn-wrap').classList.add('hidden');
}

function tick(){
  if(!running) return;
  elapsed=performance.now()-startTime;
  const totalSec=elapsed/1000;
  const s=Math.floor(totalSec), ms=Math.floor((totalSec-s)*10);
  document.getElementById('timer-sec').textContent=s;
  document.getElementById('timer-ms').textContent='.'+ms;
  if(_maxTestMode){ raf=requestAnimationFrame(tick); return; }
  const target=_timerTarget;
  const ring=document.getElementById('ring'), ov=document.getElementById('ring-overflow');
  if(totalSec<target){
    ring.style.strokeDashoffset=RING_C*(1-totalSec/target);
    ring.classList.remove('over-target');
    ov.style.opacity='0'; ov.style.strokeDashoffset=RING_C;
  } else {
    if(_timerAutoStop){ stopTimer(); showToast('Target reached!'); return; }
    ring.style.strokeDashoffset='0';
    ring.classList.add('over-target');
    const op=Math.min((totalSec-target)/target,1);
    ov.style.opacity='1'; ov.style.strokeDashoffset=RING_C*(1-op);
  }
  raf=requestAnimationFrame(tick);
}

function resetTimer(){
  elapsed=0;
  document.getElementById('timer-sec').textContent='0';
  document.getElementById('timer-ms').textContent='.0';
  const ringEl=document.getElementById('ring');
  ringEl.classList.remove('paused','over-target','max-test');
  ringEl.style.strokeDashoffset=RING_C;
  const ov=document.getElementById('ring-overflow');
  ov.style.opacity='0'; ov.style.strokeDashoffset=RING_C;
}

function adjustPresave(delta){
  if(lastDur===null) return;
  const lvl=getActiveLevel();
  if(lvl===3){ lastDur=Math.max(0,lastDur+delta); document.getElementById('presave-sec').textContent=lastDur; }
  else       { lastDur=Math.max(100,lastDur+delta*1000); document.getElementById('presave-sec').textContent=(lastDur/1000).toFixed(1); }
}

function saveSession(){
  if(lastDur===null) return;
  const lvl=getActiveLevel();
  const sessions=getSessions();
  // Check for personal record before adding
  const lvlSessions=sessions.filter(x=>(x.level||1)===lvl&&!x.isMax);
  const prevBest=lvlSessions.length?Math.max(...lvlSessions.map(x=>x.duration)):0;
  const newDur=Math.round(lastDur);
  const isPR=lvlSessions.length>0&&newDur>prevBest;
  // duration: ms for l1/l2, raw reps for l3
  sessions.push({ ts:Date.now(), duration:newDur, level:lvl });
  saveSessions(sessions);
  if (typeof bleIsConnected === 'function' && bleIsConnected()) bleSyncTarget();
  lastDur=null;
  document.getElementById('post-timer').classList.remove('visible');
  document.getElementById('tap-btn-wrap').classList.remove('hidden');
  resetTimer();
  refreshTimerUI();
  document.getElementById('cue-card').classList.remove('hidden');
  if(getActiveLevel()!==3){ showDelayBtn(); maybeShowDelayHint(); }
  if(isPR){
    const dispVal=lvl===3?newDur:(newDur/1000).toFixed(1);
    const unit=lvl===3?' reps':'s';
    showToast(`New personal best! ${dispVal}${unit}`);
  } else {
    showToast('Session saved ✓');
  }
}

function discardSession(){
  lastDur=null;
  _restoreSaveBtn();
  document.getElementById('post-timer').classList.remove('visible');
  document.getElementById('tap-btn-wrap').classList.remove('hidden');
  resetTimer();
  document.getElementById('cue-card').classList.remove('hidden');
  if(getActiveLevel()!==3){ showDelayBtn(); maybeShowDelayHint(); }
}

// ═══════════════════════════════════════════════════
//  MAX TEST
// ═══════════════════════════════════════════════════
function _restoreSaveBtn(){
  const btn=document.getElementById('save-btn');
  if(btn.textContent==='Save as max'){
    btn.textContent='Save this session'; btn.onclick=saveSession;
    document.getElementById('postsave-header').textContent='Nice work!';
    document.getElementById('timer-target-lbl').classList.remove('max-test');
  }
}

function _handleMaxTestResult(rawDur){
  const lvl=getActiveLevel();
  const isReps=lvl===3;
  const valDisplay=isReps?rawDur:(rawDur/1000).toFixed(1);
  const unit=isReps?' reps':'s';
  document.getElementById('postsave-header').textContent='Max test result';
  document.getElementById('postsave-context').textContent=`${valDisplay}${unit} — tap below to save`;
  document.getElementById('postsave-context').style.color='var(--accent)';
  document.getElementById('presave-sec').textContent=valDisplay;
  document.getElementById('presave-unit').textContent=isReps?'reps':'seconds';
  const btn=document.getElementById('save-btn');
  btn.textContent='Save as max'; btn.onclick=saveMaxResult;
  document.getElementById('post-timer').classList.add('visible');
  document.getElementById('tap-btn-wrap').classList.add('hidden');
}

function saveMaxResult(){
  if(lastDur===null) return;
  const lvl=getActiveLevel();
  const s=getSettings();
  const isReps=lvl===3;
  const maxKey=lvl===1?'maxSecL1':lvl===2?'maxSecL2':'maxRepsL3';
  const startKey=lvl===1?'startSecL1':lvl===2?'startSecL2':'startRepsL3';
  const maxVal=isReps?Math.round(lastDur):parseFloat((lastDur/1000).toFixed(1));
  s[maxKey]=maxVal;
  // Calibrate working target to 45% of max, clamped to LIMITS
  const [sMin,sMax]=LIMITS[startKey];
  s[startKey]=Math.min(sMax,Math.max(sMin,isReps?Math.round(maxVal*0.45):Math.round(maxVal*0.45)));
  saveSettings(s);
  const durToSave=isReps?Math.round(lastDur):Math.round(lastDur);
  const allSess=getSessions(); allSess.push({ts:Date.now(),duration:durToSave,level:lvl,isMax:true}); saveSessions(allSess);
  lastDur=null;
  _restoreSaveBtn();
  document.getElementById('postsave-context').style.color='';
  document.getElementById('post-timer').classList.remove('visible');
  document.getElementById('tap-btn-wrap').classList.remove('hidden');
  document.getElementById('timer-target-lbl').classList.remove('max-test');
  resetTimer();
  refreshTimerUI();
  if(getActiveLevel()!==3){ showDelayBtn(); }
  renderSettings(s);
  const unit=isReps?' reps':'s';
  showToast(`Max saved ✓ — target set to ${s[startKey]}${unit}`);
}

function startMaxTest(level){
  _maxTestMode=true;
  _levelupDismissedThisSession=false;
  const st=getState(); st.level=level; saveState(st);
  applyLevelTheme(level);
  document.getElementById('timer-target-lbl').textContent='MAX TEST — no limit';
  document.getElementById('timer-target-lbl').classList.add('max-test');
  refreshTimerUI();
  showScreen('timer');
}

// ═══════════════════════════════════════════════════
//  CYCLE
// ═══════════════════════════════════════════════════
function getCycleSessions(sessions, state){
  if(!state||!state.cycleStartDate) return sessions;
  return sessions.filter(x=>x.ts>=state.cycleStartDate);
}

function startNewCycle(){
  const st=getState(); st.cycleStartDate=Date.now(); st.cycleEndTarget=null; saveState(st);
  refreshTimerUI(); renderSettings(getSettings()); showToast('New cycle started!');
}

function endCycle(){
  const st=getState(), s=getSettings(), lvl=st.level;
  const prog=computeProgression(getCycleSessions(getSessions(),st),s,lvl);
  st.cycleEndTarget=prog.targetVal; saveState(st);
}

// ═══════════════════════════════════════════════════
//  LEVEL MANAGEMENT
// ═══════════════════════════════════════════════════
function switchLevel(lvl){
  _levelupDismissedThisSession=false;
  const st=getState(); st.level=lvl; saveState(st);
  applyLevelTheme(lvl);
  refreshTimerUI();
  renderSettings(getSettings());
  showToast(`Switched to Level ${lvl}`);
}

function applyLevelTheme(lvl){
  document.body.className = lvl===2?'lvl-2':lvl===3?'lvl-3':'';
  const color=LEVEL_COLORS[lvl];
  // level badge
  document.getElementById('lvl-dot').style.background=color;
  document.getElementById('lvl-text').textContent=`Level ${lvl} — ${LEVEL_NAMES[lvl]}`;
  document.getElementById('lvl-text').style.color=color;
  // ring/rep visibility
  const isRep=lvl===3;
  document.getElementById('timer-ring').style.display=isRep?'none':'block';
  document.getElementById('rep-counter').classList.toggle('visible',isRep);
  // tap btn label
  if(isRep){
    document.getElementById('tap-btn').textContent='Save reps';
    document.getElementById('tap-btn').onclick=saveRepSession;
    document.getElementById('tap-delay').classList.add('hidden');
  } else {
    document.getElementById('tap-btn').textContent='Start Hang';
    document.getElementById('tap-btn').onclick=handleTap;
    if(!running&&!countdownActive) showDelayBtn();
  }
  // level buttons in settings
  [1,2,3].forEach(n=>{
    document.getElementById(`lvl-btn-${n}`).classList.toggle('active-level',n===lvl);
  });
}

function checkLevelUpSuggestion(){
  if(_levelupDismissedThisSession) return;
  const st=getState();
  const lvl=st.level;
  if(lvl>=3) return;
  const s=getSettings();
  const prog=computeProgression(getSessions(),s,lvl);
  const thresh = lvl===1 ? s.levelupThreshL1 : s.levelupThreshL2;
  const banner=document.getElementById('levelup-banner');
  if(prog.targetVal>=thresh){
    document.getElementById('banner-title').textContent=`Ready for Level ${lvl+1}?`;
    document.getElementById('banner-sub').textContent=
      `Your ${lvl===1?'passive hang':'active hang'} target has reached ${prog.targetVal}${LEVEL_UNITS[lvl]}. `+
      `Time to progress to ${LEVEL_NAMES[lvl+1]}.`;
    banner.classList.add('visible');
  } else {
    banner.classList.remove('visible');
  }
}

function confirmLevelUp(){
  const lvl=getState().level;
  switchLevel(lvl+1);
  document.getElementById('levelup-banner').classList.remove('visible');
}

function dismissLevelUp(){
  _levelupDismissedThisSession=true;
  document.getElementById('levelup-banner').classList.remove('visible');
}

// ═══════════════════════════════════════════════════
//  DELAY HINT
// ═══════════════════════════════════════════════════
function dismissDelayHint(){
  document.getElementById('delay-hint').classList.remove('visible');
  localStorage.setItem('hang_delay_hint_seen','1');
}

function maybeShowDelayHint(){
  if(localStorage.getItem('hang_delay_hint_seen')) return;
  const s=getSettings();
  if(s.delayStart<=0) return;
  const btn=document.getElementById('tap-delay');
  if(btn&&!btn.classList.contains('hidden')){
    document.getElementById('delay-hint').classList.add('visible');
  }
}

// ═══════════════════════════════════════════════════
//  STREAK
// ═══════════════════════════════════════════════════
function computeStreak(sessions, settings, level){
  const lvlSessions = sessions.filter(x => (x.level || 1) === level);
  const counts = {};
  lvlSessions.forEach(x => { const k = dayKey(new Date(x.ts)); counts[k] = (counts[k] || 0) + 1; });
  const min = settings.minHangsPerDay;
  const d = new Date(); d.setHours(0, 0, 0, 0);
  // Start from yesterday — today is in progress, not yet "complete"
  d.setDate(d.getDate() - 1);
  let streak = 0;
  while (true) {
    const c = counts[dayKey(d)] || 0;
    if (c >= min) { streak++; }
    else break;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function updateLastSetLabel(){
  const lvl=getActiveLevel();
  const sessions=getSessions();
  const lastSetEl=document.getElementById('last-set-label');
  const restUntilEl=document.getElementById('rest-until-label');
  if(!lastSetEl) return;
  const allLvlSessions=sessions.filter(x=>(x.level||1)===lvl);
  if(!allLvlSessions.length){ lastSetEl.textContent=''; if(restUntilEl) restUntilEl.textContent=''; return; }
  const lastTs=allLvlSessions[allLvlSessions.length-1].ts;
  const mins=Math.round((Date.now()-lastTs)/60000);
  if(mins<1){lastSetEl.textContent='Last set: just now';lastSetEl.className='too-soon';}
  else if(mins<60){lastSetEl.textContent=`Last set: ${mins} min ago`;lastSetEl.className=mins<15?'too-soon':mins<=120?'ideal':'neutral';}
  else{const hrs=Math.floor(mins/60),rm=mins%60;lastSetEl.textContent=`Last set: ${hrs}h ${rm}m ago`;lastSetEl.className='neutral';}
  if(restUntilEl){
    const restUntilMs=lastTs+60*60*1000;
    if(Date.now()<restUntilMs){
      const d=new Date(restUntilMs);
      const hh=String(d.getHours()).padStart(2,'0'), mm=String(d.getMinutes()).padStart(2,'0');
      restUntilEl.textContent=`Recommended rest until: ${hh}:${mm}`;
    } else { restUntilEl.textContent=''; }
  }
}

// ═══════════════════════════════════════════════════
//  TIMER UI REFRESH
// ═══════════════════════════════════════════════════
function refreshTimerUI(){
  const sessions=getSessions(), s=getSettings(), lvl=getActiveLevel();
  const st=getState();
  const cycleStatus=computeCycleStatus(st,s);

  // Auto-freeze target when deload begins
  if(cycleStatus.isDeload&&st.cycleEndTarget===null) endCycle();
  const st2=getState(); // re-read after potential endCycle mutation

  const progSessions=getCycleSessions(sessions,st2);
  const prog=computeProgression(progSessions,s,lvl);
  const displayTarget=(cycleStatus.isDeload&&st2.cycleEndTarget!==null)?st2.cycleEndTarget:prog.targetVal;

  const todayKey=dayKey(new Date());
  const lvlSessions=sessions.filter(x=>(x.level||1)===lvl);
  const todayN=lvlSessions.filter(x=>dayKey(new Date(x.ts))===todayKey).length;
  const minH=s.minHangsPerDay, partialMin=s.partialHangsMin||4;

  // Wave loading: determine today's recommended sessions
  let sessionTarget=minH, waveLabel=`target: ${minH}`;
  if(cycleStatus.active&&!cycleStatus.isComplete){
    const wave=computeWaveDayTarget(st2.cycleStartDate,s);
    if(cycleStatus.isDeload){
      waveLabel=`DELOAD · ${s.waveLowSessions}`; sessionTarget=s.waveLowSessions;
    } else if(wave.type==='rest'){
      waveLabel='REST DAY'; sessionTarget=0;
    } else {
      waveLabel=`${wave.type.toUpperCase()} · ${wave.sessionTarget}`; sessionTarget=wave.sessionTarget;
    }
  }

  const isBoost=todayN>=sessionTarget+1, onTarget=todayN>=sessionTarget, isPartial=todayN>=partialMin;
  const fill=document.getElementById('today-fill');
  fill.style.width=(sessionTarget>0?Math.min(100,(todayN/sessionTarget)*100):0)+'%';
  fill.classList.toggle('bonus',isBoost);
  document.getElementById('today-count-label').textContent=`${todayN} session${todayN!==1?'s':''} today`;
  const spark=document.getElementById('bonus-spark');
  let sparkLabel='', sparkClass='';
  if(isBoost)         { sparkLabel='✦ boost';           sparkClass='bonus'; }
  else if(onTarget)   { sparkLabel='✓ on target';        sparkClass='on-target'; }
  else if(isPartial)  { sparkLabel='◐ some improvement'; sparkClass='partial'; }
  else if(todayN>0)   { sparkLabel='✗ no change';        sparkClass='warn'; }
  spark.textContent=sparkLabel; spark.style.opacity=sparkLabel?'1':'0'; spark.className=sparkClass;
  const tl=document.getElementById('today-target-label');
  tl.textContent=waveLabel; tl.className='';

  const unit=lvl===3?'reps':'s';
  if(!_maxTestMode){
    document.getElementById('timer-target-lbl').textContent=`target ${displayTarget}${unit}`;
    document.getElementById('timer-target-lbl').classList.remove('max-test');
  }
  if(lvl===3) document.getElementById('rep-target-lbl').textContent=`target ${displayTarget} reps`;

  const streakEl = document.getElementById('streak-label');
  const streak = computeStreak(sessions, s, lvl);
  streakEl.textContent = streak > 0 ? streak + ' day streak' : '';

  const { isRestDay, nextIsRestDay } = computeRestDayStatus(sessions, s, lvl);
  const rb = document.getElementById('rest-banner');
  if (isRestDay)          { rb.textContent = 'Rest day — recover and come back tomorrow'; rb.className = 'rest-banner rest-today'; }
  else if (nextIsRestDay) { rb.textContent = 'Tomorrow is your rest day'; rb.className = 'rest-banner rest-next'; }
  else                    { rb.textContent = ''; rb.className = 'rest-banner'; }

  // Cycle banner
  const cb=document.getElementById('cycle-banner');
  if(cycleStatus.isComplete){
    cb.className='cycle-banner cycle-complete';
    cb.innerHTML=`Cycle complete! Retest your max, then start a new cycle.<div class="cycle-banner-btns"><button class="cycle-banner-btn" onclick="startMaxTest(${lvl})">Retest max</button><button class="cycle-banner-btn primary" onclick="startNewCycle()">New cycle</button></div>`;
  } else if(cycleStatus.isDeload){
    cb.className='cycle-banner cycle-deload';
    cb.textContent=`Deload week — reduce volume (${cycleStatus.daysRemaining}d left)`;
  } else {
    cb.className='cycle-banner'; cb.textContent='';
  }

  // last-set elapsed time
  updateLastSetLabel();

  const cueBody=document.getElementById('cue-body');
  if(cueBody){
    cueBody.innerHTML='<ul class="cue-list">'+CUE_DATA[lvl].map(c=>`<li>${c}</li>`).join('')+'</ul>';
  }

  applyLevelTheme(lvl);
  checkLevelUpSuggestion();
  if(lvl!==3&&!running&&!countdownActive) updateDelayBtn();
}

// ═══════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════
function adj(key,delta){
  const s=getSettings(); const [mn,mx]=LIMITS[key];
  s[key]=Math.min(mx,Math.max(mn,s[key]+delta));
  if(!Number.isFinite(s[key])) s[key]=mn;
  saveSettings(s); renderSettings(s); refreshTimerUI();
}

function renderSettings(s){
  Object.keys(DEFAULTS).forEach(k=>{ const el=document.getElementById('sv-'+k); if(el) el.textContent=s[k]; });
  const asBtn=document.getElementById('toggle-autostop');
  if(asBtn){ asBtn.textContent=s.autoStop?'On':'Off'; asBtn.classList.toggle('toggle-on',!!s.autoStop); }
  const lvl=getActiveLevel();
  const st=getState();
  const cycleStatus=computeCycleStatus(st,s);
  const progSessions=getCycleSessions(getSessions(),st);
  const prog=computeProgression(progSessions,s,lvl);
  const displayTarget=(cycleStatus.isDeload&&st.cycleEndTarget!==null)?st.cycleEndTarget:prog.targetVal;
  document.getElementById('sp-level').textContent=`${lvl} — ${LEVEL_NAMES[lvl]}`;
  const unit=lvl===3?'reps':'s';
  document.getElementById('sp-target').textContent=displayTarget+unit;
  document.getElementById('sp-qual-days').textContent=prog.qualDays;
  const pct=Math.round((prog.daysIntoStep/s.daysPerStep)*100);
  document.getElementById('sp-bar').style.width=pct+'%';
  document.getElementById('sp-bar-label').textContent=
    `${+prog.daysIntoStep.toFixed(1)} / ${s.daysPerStep} qual score → next +${s.stepSec}${unit}`;

  // Max calibration row
  const maxKey=lvl===1?'maxSecL1':lvl===2?'maxSecL2':'maxRepsL3';
  const maxVal=s[maxKey]||0;
  const maxEl=document.getElementById('sp-max');
  if(maxEl){
    maxEl.innerHTML=maxVal>0
      ?`${maxVal}${unit} <button class="inline-retest-btn" onclick="startMaxTest(${lvl})">Retest</button>`
      :`not tested <button class="inline-retest-btn" onclick="startMaxTest(${lvl})">Test max</button>`;
  }

  // Step size hint
  const hintEl=document.getElementById('step-size-hint');
  if(hintEl){
    if(maxVal>0){
      const pctStep=Math.round((s.stepSec/maxVal)*100);
      const warn=pctStep<3||pctStep>15;
      hintEl.textContent=`= ${pctStep}% of your max (GtG: 5–10%)`;
      hintEl.className='step-hint'+(warn?' step-hint-warn':'');
    } else {
      hintEl.textContent=''; hintEl.className='step-hint';
    }
  }

  // Cycle status row
  const cycleEl=document.getElementById('sp-cycle');
  if(cycleEl){
    if(cycleStatus.active&&!cycleStatus.isComplete){
      cycleEl.textContent=cycleStatus.isDeload
        ?`Deload week (${cycleStatus.daysRemaining}d left)`
        :`Week ${cycleStatus.week} / ${cycleStatus.totalWeeks}`;
    } else if(cycleStatus.isComplete){
      cycleEl.textContent='Cycle complete';
    } else {
      cycleEl.textContent='No active cycle';
    }
  }
  const startBtn=document.getElementById('sp-start-cycle');
  if(startBtn) startBtn.style.display=(!cycleStatus.active||cycleStatus.isComplete)?'inline-block':'none';
  const startRow=document.getElementById('sp-start-cycle-row');
  if(startRow) startRow.style.display=(!cycleStatus.active||cycleStatus.isComplete)?'flex':'none';

  [1,2,3].forEach(n=>{ document.getElementById(`lvl-btn-${n}`).classList.toggle('active-level',n===lvl); });
  updateDelayBtn();
}

// ═══════════════════════════════════════════════════
//  HISTORY
// ═══════════════════════════════════════════════════
function renderHistory(){
  const sessions=getSessions(), s=getSettings(), lvl=getActiveLevel();
  const prog=computeProgression(sessions,s,lvl);
  // streak uses training sessions only (no max tests)
  const lvlSess=sessions.filter(x=>(x.level||1)===lvl);
  const trainSess=lvlSess.filter(x=>!x.isMax);
  const counts={}; trainSess.forEach(x=>{ const k=dayKey(new Date(x.ts)); counts[k]=(counts[k]||0)+1; });
  let streak=0, dd=new Date(); dd.setHours(0,0,0,0);
  if((counts[dayKey(dd)]||0)<s.minHangsPerDay){ dd.setDate(dd.getDate()-1); if((counts[dayKey(dd)]||0)<s.minHangsPerDay){streak=0;dd=null;} }
  if(dd) while((counts[dayKey(dd)]||0)>=s.minHangsPerDay){streak++;dd.setDate(dd.getDate()-1);}
  const unit=lvl===3?'reps':'s';
  // best includes max tests
  const best=lvlSess.length?lvl===3?Math.max(...lvlSess.map(x=>x.duration)):((Math.max(...lvlSess.map(x=>x.duration))/1000).toFixed(1)):'0';
  // Build forecast tile for next 3 days
  const st=getState();
  const cycleStatus=computeCycleStatus(st,s);
  let forecastHtml='';
  if(cycleStatus.active&&!cycleStatus.isComplete){
    const days=[];
    for(let i=1;i<=3;i++){
      const fd=new Date(); fd.setHours(0,0,0,0); fd.setDate(fd.getDate()+i);
      const dayLabel=fd.toLocaleDateString('default',{weekday:'short'});
      if(cycleStatus.isDeload){
        days.push(`<div class="forecast-day"><div class="forecast-day-name">${dayLabel}</div><div class="forecast-day-val deload">${s.waveLowSessions}</div><div class="forecast-day-type">deload</div></div>`);
      } else {
        const wave=computeWaveDayTarget(st.cycleStartDate,s,fd);
        if(wave.type==='rest'){
          days.push(`<div class="forecast-day"><div class="forecast-day-name">${dayLabel}</div><div class="forecast-day-val rest">—</div><div class="forecast-day-type">rest</div></div>`);
        } else {
          days.push(`<div class="forecast-day"><div class="forecast-day-name">${dayLabel}</div><div class="forecast-day-val">${wave.sessionTarget}</div><div class="forecast-day-type">${wave.type}</div></div>`);
        }
      }
    }
    forecastHtml=`<div class="stat-card forecast-card"><div class="stat-label">Next 3 days</div><div class="forecast-days">${days.join('')}</div></div>`;
  }

  document.getElementById('stats-row').innerHTML=`
    <div class="stat-card"><div class="stat-value">${prog.targetVal}${unit}</div><div class="stat-label">Target</div></div>
    <div class="stat-card"><div class="stat-value">${streak}</div><div class="stat-label">Streak</div></div>
    <div class="stat-card"><div class="stat-value">${best}${unit}</div><div class="stat-label">Best</div></div>
    <div class="stat-card"><div class="stat-value">${trainSess.length}</div><div class="stat-label">Sessions</div></div>
    ${forecastHtml}`;

  // heatmap (all sessions, colour by level)
  const allCounts={};
  sessions.forEach(x=>{ const k=dayKey(new Date(x.ts)); allCounts[k]=(allCounts[k]||0)+1; });
  const WEEKS=15, today=new Date(); today.setHours(0,0,0,0);
  const start=new Date(today); start.setDate(today.getDate()-(WEEKS*7-1));
  const dow=start.getDay(); start.setDate(start.getDate()+(dow===0?-6:1-dow));
  document.getElementById('day-labels').innerHTML=['M','','W','','F','','S'].map(l=>`<div class="heatmap-day-label">${l}</div>`).join('');
  const hm=document.getElementById('heatmap'); hm.innerHTML='';
  const firstDay=sessions.length?new Date(sessions[0].ts):null; if(firstDay)firstDay.setHours(0,0,0,0);
  let mData=[],prevM=-1,ci=0;
  const d=new Date(start);
  while(d<=today){
    const col=document.createElement('div'); col.className='heatmap-col';
    if(d.getMonth()!==prevM){mData.push({col:ci,month:d.toLocaleString('default',{month:'short'})});prevM=d.getMonth();}
    for(let r=0;r<7;r++){
      const cell=document.createElement('div'); cell.className='heatmap-cell';
      if(d<=today){
        const k=dayKey(d),c=allCounts[k]||0;
        const isPast=firstDay&&d>=firstDay&&d<today;
        const partialMin=s.partialHangsMin||4;
        if(c>=s.minHangsPerDay+1)  cell.classList.add('bonus');
        else if(c>=s.minHangsPerDay) cell.classList.add('full');
        else if(c>=partialMin)     cell.classList.add('has-2');
        else if(c>0)               cell.classList.add('has-1');
        else if(isPast&&c===0)     cell.classList.add('missed');
      }
      col.appendChild(cell); d.setDate(d.getDate()+1);
      if(d>today&&r<6){for(let r2=r+1;r2<7;r2++){const e=document.createElement('div');e.className='heatmap-cell';col.appendChild(e);}break;}
    }
    hm.appendChild(col); ci++;
  }
  const ml=document.getElementById('month-labels'); ml.innerHTML='';
  mData.forEach((m,i)=>{const sp=document.createElement('div');sp.className='month-label';sp.textContent=m.month;sp.style.width=(((mData[i+1]?mData[i+1].col:ci)-m.col)*16-3)+'px';sp.style.flexShrink='0';ml.appendChild(sp);});
  setTimeout(()=>{const w=document.querySelector('.heatmap-wrap');if(w)w.scrollLeft=w.scrollWidth;},50);

  // session list (all sessions, recent 30)
  const el=document.getElementById('session-list');
  if(!sessions.length){el.innerHTML=`<div class="empty-state">No sessions yet<br>Head to the Timer tab to log your first hang.</div>`;return;}
  el.innerHTML='';
  [...sessions].reverse().slice(0,30).forEach((sess,idx)=>{
    const realIdx=sessions.length-1-idx;
    const dt=new Date(sess.ts);
    const dateStr=dt.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
    const timeStr=dt.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
    const sl=sess.level||1;
    const dispVal=sl===3?sess.duration:((sess.duration/1000).toFixed(1));
    const dispUnit=sl===3?'reps':'s';
    const color=LEVEL_COLORS[sl];
    const wrap=document.createElement('div'); wrap.className='session-wrap';
    const item=document.createElement('div'); item.className=`session-item lvl-${sl}${sess.isMax?' max-effort-item':''}`;
    const maxBadge=sess.isMax?`<span class="max-effort-badge">max effort</span>`:'';
    item.innerHTML=`
      <div style="display:flex;align-items:center;gap:8px">
        <div class="session-lvl-pip" style="background:${color}"></div>
        <div><div class="session-date">${dateStr} · ${timeStr}${maxBadge}</div></div>
      </div>
      <div class="session-duration">${dispVal}<span>${dispUnit}</span></div>
      <div class="session-dot" style="background:${color}"></div>`;
    item.addEventListener('click',()=>toggleSessionEdit(wrap));
    const actions=document.createElement('div'); actions.className='session-actions';
    actions.dataset.idx=realIdx; actions.dataset.dur=sess.duration; actions.dataset.lvl=sl;
    actions.innerHTML=`
      <div class="action-row">
        <span class="action-label">${sl===3?'Reps':'Duration'}</span>
        <button class="log-adj" onclick="logAdj(this,-1)">−</button>
        <div><div class="log-edit-val">${dispVal}</div><div class="log-edit-unit">${dispUnit}</div></div>
        <button class="log-adj" onclick="logAdj(this,1)">+</button>
      </div>
      <div class="action-btns">
        <button class="act-btn confirm" onclick="saveLogEdit(this)">Save</button>
        <button class="act-btn delete"  onclick="deleteArm(this)">Delete</button>
      </div>`;
    wrap.appendChild(item); wrap.appendChild(actions); el.appendChild(wrap);
  });
}

let _openWrap=null;
function toggleSessionEdit(wrap){
  const actions=wrap.querySelector('.session-actions'), item=wrap.querySelector('.session-item');
  if(_openWrap&&_openWrap!==wrap){_openWrap.querySelector('.session-actions').classList.remove('visible');_openWrap.querySelector('.session-item').classList.remove('editing');resetDeleteBtn(_openWrap.querySelector('.act-btn.delete'));}
  const open=actions.classList.contains('visible');
  if(open){actions.classList.remove('visible');item.classList.remove('editing');_openWrap=null;}
  else{actions.classList.add('visible');item.classList.add('editing');_openWrap=wrap;}
}
function logAdj(btn,delta){
  const a=btn.closest('.session-actions'), sl=parseInt(a.dataset.lvl);
  let dur=parseInt(a.dataset.dur);
  dur = sl===3 ? Math.max(0,dur+delta) : Math.max(100,dur+delta*1000);
  a.dataset.dur=dur;
  a.querySelector('.log-edit-val').textContent=sl===3?dur:(dur/1000).toFixed(1);
}
function saveLogEdit(btn){
  const a=btn.closest('.session-actions');
  const idx=parseInt(a.dataset.idx), dur=parseInt(a.dataset.dur);
  const sessions=getSessions(); sessions[idx].duration=dur; saveSessions(sessions);
  refreshTimerUI(); renderHistory(); showToast('Updated ✓');
}
function deleteArm(btn){
  if(btn.classList.contains('armed')){
    const a=btn.closest('.session-actions'), idx=parseInt(a.dataset.idx);
    const sessions=getSessions(); sessions.splice(idx,1); saveSessions(sessions);
    _openWrap=null; refreshTimerUI(); renderHistory(); showToast('Deleted');
  } else {
    btn.classList.add('armed'); btn.textContent='Confirm delete';
    setTimeout(()=>resetDeleteBtn(btn),3000);
  }
}
function resetDeleteBtn(btn){if(!btn)return;btn.classList.remove('armed');btn.textContent='Delete';}

// ═══════════════════════════════════════════════════
//  MANUAL ADD SESSION
// ═══════════════════════════════════════════════════
let _addDurVal=8000;
function toggleAddPanel(){
  const panel=document.getElementById('add-session-panel');
  const open=panel.classList.contains('visible');
  if(open){panel.classList.remove('visible');}
  else{
    const lvl=getActiveLevel();
    document.getElementById('add-level').value=lvl;
    const prog=computeProgression(getSessions(),getSettings(),lvl);
    _addDurVal=lvl===3?prog.targetVal:prog.targetVal*1000;
    updateAddDisplay(lvl);
    const now=new Date(); now.setSeconds(0,0);
    document.getElementById('add-datetime').value=toDatetimeLocal(now);
    panel.classList.add('visible');
  }
}
function updateAddDisplay(lvl){
  const isRep=lvl===3;
  document.getElementById('add-dur-label').textContent=isRep?'Reps':'Duration';
  document.getElementById('add-dur-val').textContent=isRep?_addDurVal:(_addDurVal/1000).toFixed(1);
  document.getElementById('add-dur-unit').textContent=isRep?'reps':'sec';
}
function addAdj(delta){
  const lvl=parseInt(document.getElementById('add-level').value);
  _addDurVal=lvl===3?Math.max(0,_addDurVal+delta):Math.max(100,_addDurVal+delta*1000);
  updateAddDisplay(lvl);
}
function toDatetimeLocal(d){const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;}
function confirmAddSession(){
  const dtVal=document.getElementById('add-datetime').value;
  const ts=dtVal?new Date(dtVal).getTime():Date.now();
  if(isNaN(ts)){showToast('Invalid date');return;}
  const lvl=Math.max(1,Math.min(3,parseInt(document.getElementById('add-level').value)||1));
  const sessions=getSessions();
  sessions.push({ts,duration:Math.round(_addDurVal),level:lvl});
  sessions.sort((a,b)=>a.ts-b.ts);
  saveSessions(sessions);
  document.getElementById('add-session-panel').classList.remove('visible');
  refreshTimerUI(); renderHistory(); showToast('Session added ✓');
}

// ═══════════════════════════════════════════════════
//  SCREEN SWITCHING
// ═══════════════════════════════════════════════════
function showScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
  const scr=document.getElementById(name+'-screen');
  scr.classList.add('active');
  scr.scrollTop=0;
  document.getElementById('nav-'+name).classList.add('active');
  if(name==='history')  renderHistory();
  if(name==='settings') renderSettings(getSettings());
}

// ═══════════════════════════════════════════════════
//  VOICE (TF.js Speech Commands — offline-capable)
// ═══════════════════════════════════════════════════
let scRecognizer=null,voiceActive=false,lastVoiceCmd=0,scLoading=false;
const VOICE_THRESHOLD=0.4;

function voiceDispatch(word){
  const now=Date.now();if(now-lastVoiceCmd<1500)return;
  if(getActiveLevel()===3)return;
  if(word==='go'&&!running&&!countdownActive){lastVoiceCmd=now;handleTap();setMic('listening','✓ go');setTimeout(()=>setMic('listening','Say "go" or "stop"…'),800);}
  else if(word==='stop'&&running){lastVoiceCmd=now;handleTap();setMic('listening','✓ stop');setTimeout(()=>setMic('listening','Say "go" or "stop"…'),800);}
}

function toggleVoice(){voiceActive?stopVoice():startVoice();}

async function startVoice(){
  if(scLoading)return;
  if(!window.speechCommands){setMic('error','Not available');return;}
  scLoading=true;
  setMic('listening','Loading…');
  try{
    if(!scRecognizer){
      scRecognizer=window.speechCommands.create('BROWSER_FFT');
      await scRecognizer.ensureModelLoaded();
    }
    const labels=scRecognizer.wordLabels();
    const goIdx=labels.indexOf('go'),stopIdx=labels.indexOf('stop');
    await scRecognizer.listen(result=>{
      const scores=Array.from(result.scores);
      const goScore=goIdx>=0?scores[goIdx]:0;
      const stopScore=stopIdx>=0?scores[stopIdx]:0;
      if(goScore>=VOICE_THRESHOLD&&goScore>=stopScore)voiceDispatch('go');
      else if(stopScore>=VOICE_THRESHOLD&&stopScore>goScore)voiceDispatch('stop');
    },{probabilityThreshold:VOICE_THRESHOLD,overlapFactor:0.5});
    voiceActive=true;
    setMic('listening','Say "go" or "stop"…');
  }catch(e){
    setMic('error','Mic error');
    voiceActive=false;
  }
  scLoading=false;
}

function stopVoice(){
  voiceActive=false;
  if(scRecognizer){try{scRecognizer.stopListening();}catch(_){}}
  setMic('off','Voice off');
}

function setMic(state,label){document.getElementById('mic-status').className=state==='listening'?'listening':state==='error'?'error':'';document.getElementById('mic-text').textContent=label;}

// ═══════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2000);}

// ═══════════════════════════════════════════════════
//  BACKUP & RESTORE
// ═══════════════════════════════════════════════════
function downloadBackup(){
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions: getSessions(),
    settings: getSettings(),
    state: getState()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const _now=new Date();
  const date=`${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;
  a.href     = url;
  a.download = `hang-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Backup downloaded ✓');
}

function restoreBackup(event){
  const file = event.target.files[0];
  if(!file){ return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if(!data.version || !Array.isArray(data.sessions)){
        showToast('Invalid backup file'); return;
      }
      const valid = data.sessions.every(s =>
        s && typeof s.ts === 'number' && typeof s.duration === 'number'
      );
      if(!valid){ showToast('Invalid backup file'); return; }
      if(!confirm(`Restore ${data.sessions.length} sessions from ${data.exportedAt ? new Date(data.exportedAt).toLocaleDateString() : 'backup'}? This replaces current data.`)){
        event.target.value=''; return;
      }
      saveSessions(data.sessions);
      if(data.settings){
        const filtered=Object.fromEntries(Object.entries(data.settings).filter(([k])=>k in DEFAULTS));
        saveSettings({...DEFAULTS,...filtered});
      }
      if(data.state)    saveState(data.state);
      event.target.value='';
      refreshTimerUI();
      renderSettings(getSettings());
      showToast(`Restored ${data.sessions.length} sessions ✓`);
    } catch(err){
      showToast('Could not read file');
      event.target.value='';
    }
  };
  reader.readAsText(file);
}

// ═══════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════
if (window.APP_VERSION) document.getElementById('version-badge').textContent = window.APP_VERSION;
(function initCueState(){
  const stored=localStorage.getItem(CUE_OPEN_KEY);
  const open = stored === null ? true : stored === '1';
  const card=document.getElementById('cue-card');
  if(open){ card.classList.add('open'); document.getElementById('cue-arrow').textContent='▴'; }
})();
refreshTimerUI();
maybeShowDelayHint();
if (typeof bleInit === 'function') bleInit();
setInterval(updateLastSetLabel, 30000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && countdownActive) cancelCountdown();
});

// ═══════════════════════════════════════════════════
//  SERVICE WORKER + UPDATE DETECTION
// ═══════════════════════════════════════════════════
let _swWaiting = null, _bannerDismissed = false;

function applyUpdate() {
  if (_swWaiting) {
    _swWaiting.postMessage('SKIP_WAITING');
    _swWaiting = null;
  }
  document.getElementById('update-banner').classList.remove('visible');
}

function dismissUpdate() {
  _bannerDismissed = true;
  document.getElementById('update-banner').classList.remove('visible');
}

function _showUpdateBanner(worker) {
  if (_bannerDismissed) return;
  _swWaiting = worker;
  document.getElementById('update-banner').classList.add('visible');
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    // Already waiting (e.g. page refreshed while update was pending)
    if (reg.waiting) {
      _showUpdateBanner(reg.waiting);
    }

    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          _showUpdateBanner(newWorker);
        }
      });
    });

    // Check for updates whenever the user switches back to the app
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update();
    });

  }).catch(() => { /* SW unavailable (e.g. file:// protocol) — silent */ });

  // When the new SW takes control, reload so the fresh files are served
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}
