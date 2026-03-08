// ═══════════════════════════════════════════════════
//  STORAGE
// ═══════════════════════════════════════════════════
const SESSIONS_KEY = 'hang_sessions_v1';
const SETTINGS_KEY = 'hang_settings_v2';
const STATE_KEY    = 'hang_state_v1';


function getSessions(){ try{ return JSON.parse(localStorage.getItem(SESSIONS_KEY))||[]; }catch{ return []; } }
function saveSessions(a){ localStorage.setItem(SESSIONS_KEY,JSON.stringify(a)); }
function getSettings(){ try{ return {...DEFAULTS,...JSON.parse(localStorage.getItem(SETTINGS_KEY))}; }catch{ return {...DEFAULTS}; } }
function saveSettings(s){ localStorage.setItem(SETTINGS_KEY,JSON.stringify(s)); }
function getState(){ try{ return JSON.parse(localStorage.getItem(STATE_KEY))||{level:1,levelupDismissed:false}; }catch{ return {level:1,levelupDismissed:false}; } }
function saveState(s){ localStorage.setItem(STATE_KEY,JSON.stringify(s)); }

// ═══════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════
const LEVEL_COLORS = { 1:'#c8f542', 2:'#42d4f5', 3:'#f542c8' };
const LEVEL_NAMES  = { 1:'Passive Hang', 2:'Active Hang', 3:'Scapular Shrugs' };
const LEVEL_UNITS  = { 1:'s', 2:'s', 3:' reps' };

// ═══════════════════════════════════════════════════
//  TIMER STATE
// ═══════════════════════════════════════════════════
const RING_C = 2*Math.PI*108;
let running=false, startTime=null, elapsed=0, raf=null, lastDur=null;
let currentReps=0;  // for level 3
let countdownActive=false, countdownTimer=null;
let _timerTarget=null, _timerAutoStop=false;

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
  _timerTarget=computeProgression(getSessions(),_s,getActiveLevel()).targetVal;
  _timerAutoStop=_s.autoStop;
  running=true;
  startTime=performance.now()-elapsed;
  document.getElementById('tap-btn').textContent='Stop';
  document.getElementById('tap-btn').classList.add('running');
  document.getElementById('post-timer').classList.remove('visible');
  document.getElementById('ring').classList.remove('paused');
  document.getElementById('tap-delay').classList.add('hidden');
  tick();
}

function stopTimer(){
  running=false;
  _timerTarget=null; _timerAutoStop=false;
  cancelAnimationFrame(raf);
  lastDur=elapsed;
  document.getElementById('tap-btn').textContent='Start Hang';
  document.getElementById('tap-btn').classList.remove('running');
  document.getElementById('ring').classList.add('paused');
  document.getElementById('presave-sec').textContent=(lastDur/1000).toFixed(1);
  document.getElementById('presave-unit').textContent='seconds';
  document.getElementById('post-timer').classList.add('visible');
  if(getActiveLevel()!==3) showDelayBtn();
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
  document.getElementById('presave-sec').textContent=currentReps;
  document.getElementById('presave-unit').textContent='reps';
  currentReps=0;
  document.getElementById('rep-num').textContent='0';
  document.getElementById('post-timer').classList.add('visible');
}

function tick(){
  if(!running) return;
  elapsed=performance.now()-startTime;
  const totalSec=elapsed/1000;
  const s=Math.floor(totalSec), ms=Math.floor((totalSec-s)*10);
  document.getElementById('timer-sec').textContent=s;
  document.getElementById('timer-ms').textContent='.'+ms;
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
  document.getElementById('ring').style.strokeDashoffset=RING_C;
  document.getElementById('ring').classList.remove('paused','over-target');
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
  // duration: ms for l1/l2, raw reps for l3
  sessions.push({ ts:Date.now(), duration:Math.round(lastDur), level:lvl });
  saveSessions(sessions);
  lastDur=null;
  document.getElementById('post-timer').classList.remove('visible');
  resetTimer();
  refreshTimerUI();
  showToast('Session saved ✓');
}

function discardSession(){
  lastDur=null;
  document.getElementById('post-timer').classList.remove('visible');
  resetTimer();
}

// ═══════════════════════════════════════════════════
//  LEVEL MANAGEMENT
// ═══════════════════════════════════════════════════
function switchLevel(lvl){
  const st=getState(); st.level=lvl; st.levelupDismissed=false; saveState(st);
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
  const st=getState();
  if(st.levelupDismissed) return;
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
  const st=getState(); st.levelupDismissed=true; saveState(st);
  document.getElementById('levelup-banner').classList.remove('visible');
}

// ═══════════════════════════════════════════════════
//  TIMER UI REFRESH
// ═══════════════════════════════════════════════════
function refreshTimerUI(){
  const sessions=getSessions(), s=getSettings(), lvl=getActiveLevel();
  const prog=computeProgression(sessions,s,lvl);
  const todayKey=dayKey(new Date());
  const lvlSessions=sessions.filter(x=>(x.level||1)===lvl);
  const todayN=lvlSessions.filter(x=>dayKey(new Date(x.ts))===todayKey).length;
  const minH=s.minHangsPerDay;
  const bonus=todayN>=minH+1, onTarget=todayN>=minH;

  const fill=document.getElementById('today-fill');
  fill.style.width=Math.min(100,(todayN/minH)*100)+'%';
  fill.classList.toggle('bonus',bonus);
  document.getElementById('today-count-label').textContent=`${todayN} session${todayN!==1?'s':''} today`;
  const spark=document.getElementById('bonus-spark');
  spark.textContent=bonus?'✦ bonus':''; spark.style.opacity=bonus?'1':'0'; spark.style.color='#fff';
  const tl=document.getElementById('today-target-label');
  tl.textContent=`target: ${minH}`; tl.className=bonus?'bonus':onTarget?'on-target':todayN>0?'warn':'';

  const unit=lvl===3?'reps':'s';
  document.getElementById('timer-target-lbl').textContent=`target ${prog.targetVal}${unit}`;
  if(lvl===3) document.getElementById('rep-target-lbl').textContent=`target ${prog.targetVal} reps`;

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
  saveSettings(s); renderSettings(s); refreshTimerUI();
}

function renderSettings(s){
  Object.keys(DEFAULTS).forEach(k=>{ const el=document.getElementById('sv-'+k); if(el) el.textContent=s[k]; });
  const asBtn=document.getElementById('toggle-autostop');
  if(asBtn){ asBtn.textContent=s.autoStop?'On':'Off'; asBtn.classList.toggle('toggle-on',!!s.autoStop); }
  const lvl=getActiveLevel();
  const prog=computeProgression(getSessions(),s,lvl);
  document.getElementById('sp-level').textContent=`${lvl} — ${LEVEL_NAMES[lvl]}`;
  const unit=lvl===3?'reps':'s';
  document.getElementById('sp-target').textContent=prog.targetVal+unit;
  document.getElementById('sp-qual-days').textContent=prog.qualDays;
  const pct=Math.round((prog.daysIntoStep/s.daysPerStep)*100);
  document.getElementById('sp-bar').style.width=pct+'%';
  document.getElementById('sp-bar-label').textContent=
    `${prog.daysIntoStep} / ${s.daysPerStep} qualifying days → next +${s.stepSec}${unit}`;
  [1,2,3].forEach(n=>{ document.getElementById(`lvl-btn-${n}`).classList.toggle('active-level',n===lvl); });
  updateDelayBtn();
}

// ═══════════════════════════════════════════════════
//  HISTORY
// ═══════════════════════════════════════════════════
function renderHistory(){
  const sessions=getSessions(), s=getSettings(), lvl=getActiveLevel();
  const prog=computeProgression(sessions,s,lvl);
  // streak uses current-level sessions
  const lvlSess=sessions.filter(x=>(x.level||1)===lvl);
  const counts={}; lvlSess.forEach(x=>{ const k=dayKey(new Date(x.ts)); counts[k]=(counts[k]||0)+1; });
  let streak=0, dd=new Date(); dd.setHours(0,0,0,0);
  if((counts[dayKey(dd)]||0)<s.minHangsPerDay){ dd.setDate(dd.getDate()-1); if((counts[dayKey(dd)]||0)<s.minHangsPerDay){streak=0;dd=null;} }
  if(dd) while((counts[dayKey(dd)]||0)>=s.minHangsPerDay){streak++;dd.setDate(dd.getDate()-1);}
  const unit=lvl===3?'reps':'s';
  const best=lvlSess.length?lvl===3?Math.max(...lvlSess.map(x=>x.duration)):((Math.max(...lvlSess.map(x=>x.duration))/1000).toFixed(1)):'0';
  document.getElementById('stats-row').innerHTML=`
    <div class="stat-card"><div class="stat-value">${prog.targetVal}${unit}</div><div class="stat-label">Target</div></div>
    <div class="stat-card"><div class="stat-value">${streak}</div><div class="stat-label">Streak</div></div>
    <div class="stat-card"><div class="stat-value">${best}${unit}</div><div class="stat-label">Best</div></div>`;

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
        if(c>=s.minHangsPerDay+1)                       cell.classList.add('bonus');
        else if(c>=s.minHangsPerDay)                    cell.classList.add('full');
        else if(c>0&&c>=Math.ceil(s.minHangsPerDay/2)) cell.classList.add('has-2');
        else if(c>0)                                    cell.classList.add('has-1');
        else if(isPast&&c===0)                          cell.classList.add('missed');
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
  if(!sessions.length){el.innerHTML=`<div class="empty-state">No sessions yet.<br>Start your first hang ↑</div>`;return;}
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
    const item=document.createElement('div'); item.className='session-item';
    item.innerHTML=`
      <div style="display:flex;align-items:center;gap:8px">
        <div class="session-lvl-pip" style="background:${color}"></div>
        <div><div class="session-date">${dateStr} · ${timeStr}</div></div>
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
  const lvl=parseInt(document.getElementById('add-level').value);
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
  document.getElementById(name+'-screen').classList.add('active');
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
  const date = new Date().toISOString().slice(0,10);
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
      if(!confirm(`Restore ${data.sessions.length} sessions from ${data.exportedAt ? new Date(data.exportedAt).toLocaleDateString() : 'backup'}? This replaces current data.`)){
        event.target.value=''; return;
      }
      saveSessions(data.sessions);
      if(data.settings) saveSettings({...DEFAULTS,...data.settings});
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
refreshTimerUI();

// ═══════════════════════════════════════════════════
//  SERVICE WORKER + UPDATE DETECTION
// ═══════════════════════════════════════════════════
let _swWaiting = null;

function applyUpdate() {
  if (_swWaiting) {
    _swWaiting.postMessage('SKIP_WAITING');
    _swWaiting = null;
  }
  document.getElementById('update-banner').classList.remove('visible');
}

function dismissUpdate() {
  document.getElementById('update-banner').classList.remove('visible');
}

function _showUpdateBanner(worker) {
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
