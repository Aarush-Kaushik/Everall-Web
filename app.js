/* ═══════════════════════════════════════════════════════════════
   EVERALL — app.js
   Complete offline productivity app
   All data stored in LocalStorage, modular class-per-module design
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ══════════════════════════════════════════════════
// STORAGE HELPERS
// ══════════════════════════════════════════════════
const Storage = {
  load(key, fallback = null) {
    try {
      const v = localStorage.getItem('everall_' + key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  save(key, data) {
    try { localStorage.setItem('everall_' + key, JSON.stringify(data)); } catch(e) { console.error('Storage error', e); }
  },
  clear(key) { localStorage.removeItem('everall_' + key); }
};

// ══════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function pad(n) { return String(n).padStart(2,'0'); }
function today() { return new Date().toISOString().slice(0,10); }
function fmt(sec) { return `${pad(Math.floor(sec/3600))}:${pad(Math.floor(sec/60)%60)}:${pad(sec%60)}`; }
function fmtMs(ms) { const s=Math.floor(ms/1000),m=Math.floor(ms/60000); return `${pad(m)}:${pad(s%60)}.${pad(Math.floor((ms%1000)/10))}`; }
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function dayName(d) { return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]; }
function monthName(m) { return ['January','February','March','April','May','June','July','August','September','October','November','December'][m]; }

let toastTimer;
function showToast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = type ? `show ${type}` : 'show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', 3000);
}

function openModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-content').innerHTML = '';
}

// ══════════════════════════════════════════════════
// NAVIGATION CONFIG
// ══════════════════════════════════════════════════
const NAV = [
  { section: 'Overview' },
  { id: 'dashboard',    label: 'Dashboard',     icon: '⬡' },
  { id: 'analytics',    label: 'Analytics',     icon: '📊' },
  { section: 'Time' },
  { id: 'clock',        label: 'Clock & Timers', icon: '⏰' },
  { section: 'Productivity' },
  { id: 'todo',         label: 'To-Do List',    icon: '✅' },
  { id: 'habits',       label: 'Habits',        icon: '🔥' },
  { id: 'goals',        label: 'Goals',         icon: '🎯' },
  { id: 'wishlist',     label: 'Wishlist',      icon: '⭐' },
  { id: 'notes',        label: 'Notes',         icon: '📝' },
  { section: 'Planning' },
  { id: 'calendar',     label: 'Calendar',      icon: '📅' },
  { id: 'study',        label: 'Study Planner', icon: '📚' },
  { section: 'Finance' },
  { id: 'finance',      label: 'Finance',       icon: '💰' },
  { section: 'Health' },
  { id: 'health',       label: 'Health',        icon: '💪' },
  { section: 'Fun' },
  { id: 'games',        label: 'Games',         icon: '🎮' },
  { section: 'Tools' },
  { id: 'utilities',    label: 'Utilities',     icon: '🔧' },
  { section: 'Misc' },
  { id: 'settings',     label: 'Settings',      icon: '⚙️' },
];

// ══════════════════════════════════════════════════
// MAIN APP CLASS
// ══════════════════════════════════════════════════
class App {
  constructor() {
    this.currentModule = 'dashboard';
    this.clockInterval = null;
    this.buildSidebar();
    this.bindNav();
    this.navigate('dashboard');
    this.startTopClock();
    this.applySettings();
    document.getElementById('sidebar-toggle').onclick = () => this.toggleSidebar();
    document.getElementById('modal-close').onclick = closeModal;
    document.getElementById('modal-overlay').addEventListener('click', e => { if(e.target.id==='modal-overlay') closeModal(); });
    document.getElementById('theme-toggle').onclick = () => this.cycleTheme();
  }

  buildSidebar() {
    const nav = document.getElementById('nav-list');
    nav.innerHTML = NAV.map(item => {
      if(item.section) return `<div class="nav-section-label">${item.section}</div>`;
      return `<div class="nav-item" data-id="${item.id}"><span class="nav-icon">${item.icon}</span><span class="nav-label">${item.label}</span></div>`;
    }).join('');
  }

  bindNav() {
    document.getElementById('nav-list').addEventListener('click', e => {
      const item = e.target.closest('.nav-item');
      if(item) this.navigate(item.dataset.id);
    });
  }

  navigate(id) {
    this.currentModule = id;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.id === id));
    const navItem = NAV.find(n => n.id === id);
    document.getElementById('topbar-title').textContent = navItem?.label || id;
    const container = document.getElementById('module-container');
    container.innerHTML = '<div class="fade-in">' + (Modules[id]?.render() || '<p>Module not found</p>') + '</div>';
    Modules[id]?.init?.();
    // Track time spent
    TimeModule.logModuleTime(id);
  }

  toggleSidebar() {
    document.body.classList.toggle('sidebar-collapsed');
  }

  startTopClock() {
    const el = document.getElementById('topbar-clock');
    const tick = () => {
      const now = new Date();
      el.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    };
    tick(); setInterval(tick, 1000);
  }

  applySettings() {
    const s = Storage.load('settings', {});
    if(s.theme === 'light') document.body.classList.add('theme-light');
    if(s.accent) document.documentElement.style.setProperty('--accent', s.accent);
    if(s.accentDim) document.documentElement.style.setProperty('--accent-dim', s.accentDim);
  }

  cycleTheme() {
    const isLight = document.body.classList.toggle('theme-light');
    const s = Storage.load('settings', {});
    s.theme = isLight ? 'light' : 'dark';
    Storage.save('settings', s);
    showToast(isLight ? '☀️ Light mode' : '🌙 Dark mode');
  }
}

// ══════════════════════════════════════════════════
// MODULE: DASHBOARD
// ══════════════════════════════════════════════════
const DashboardModule = {
  render() {
    const todos = Storage.load('todos', []);
    const habits = Storage.load('habits', []);
    const expenses = Storage.load('expenses', []);
    const income = Storage.load('income', []);
    const notes = Storage.load('notes', []);
    const completed = todos.filter(t => t.done).length;
    const activeHabits = habits.filter(h => h.streak > 0).length;
    const thisMonth = new Date().toISOString().slice(0,7);
    const totalExp = expenses.filter(e=>e.date.startsWith(thisMonth)).reduce((s,e)=>s+e.amount,0);
    const totalInc = income.filter(i=>i.date.startsWith(thisMonth)).reduce((s,i)=>s+i.amount,0);
    const now = new Date();
    const greet = now.getHours()<12?'Good morning':'now.getHours()<17'?'Good afternoon':'Good evening';
    const greetText = now.getHours()<12?'Good morning':now.getHours()<17?'Good afternoon':'Good evening';
    return `
    <div class="dash-welcome">🌟 ${greetText}!</div>
    <div class="dash-date text-muted">${now.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
    <div class="dash-grid">
      <div class="dash-card" onclick="app.navigate('todo')"><div class="dash-card-icon">✅</div><div class="dash-card-val">${todos.length - completed}</div><div class="dash-card-label">Tasks Remaining</div></div>
      <div class="dash-card" onclick="app.navigate('habits')"><div class="dash-card-icon">🔥</div><div class="dash-card-val">${activeHabits}</div><div class="dash-card-label">Active Streaks</div></div>
      <div class="dash-card" onclick="app.navigate('notes')"><div class="dash-card-icon">📝</div><div class="dash-card-val">${notes.length}</div><div class="dash-card-label">Notes Saved</div></div>
      <div class="dash-card" onclick="app.navigate('finance')"><div class="dash-card-icon">💰</div><div class="dash-card-val">$${(totalInc-totalExp).toFixed(0)}</div><div class="dash-card-label">Month Balance</div></div>
      <div class="dash-card" onclick="app.navigate('todo')"><div class="dash-card-icon">🏆</div><div class="dash-card-val">${completed}</div><div class="dash-card-label">Tasks Done</div></div>
      <div class="dash-card" onclick="app.navigate('goals')"><div class="dash-card-icon">🎯</div><div class="dash-card-val">${Storage.load('goals',[]).length}</div><div class="dash-card-label">Active Goals</div></div>
    </div>
    <div class="section-title">Quick Actions</div>
    <div class="flex gap-8 flex-wrap">
      <button class="btn btn-primary" onclick="app.navigate('todo')">➕ Add Task</button>
      <button class="btn btn-secondary" onclick="app.navigate('notes')">📝 New Note</button>
      <button class="btn btn-secondary" onclick="app.navigate('clock')">⏱ Start Timer</button>
      <button class="btn btn-secondary" onclick="app.navigate('finance')">💸 Log Expense</button>
    </div>`;
  },
  init() {}
};

// ══════════════════════════════════════════════════
// MODULE: CLOCK & TIMERS
// ══════════════════════════════════════════════════
const TimeModule = {
  _swInterval: null, _swMs: 0, _swRunning: false, _swLaps: [],
  _cdInterval: null, _cdRemain: 0, _cdRunning: false,
  _pomoInterval: null, _pomoRunning: false, _pomoSec: 0,
  _pomoMode: 'work', _pomoSession: 0, _pomoConfig: { work:25, shortBreak:5, longBreak:15, sessions:4 },
  _alarms: [],
  _alarmCheckInterval: null,
  _analogInterval: null,
  _sessionStart: Date.now(),
  _moduleLog: {},

  logModuleTime(id) {
    const log = Storage.load('module_time', {});
    if(!log[id]) log[id] = 0;
    Storage.save('module_time', log);
  },

  render() {
    const now = new Date();
    this._alarms = Storage.load('alarms', []);
    return `
    <div class="module-header"><div><div class="module-title">⏰ Clock & Timers</div><div class="module-subtitle">Time management tools</div></div></div>

    <!-- Live Clock -->
    <div class="card">
      <div class="card-title">Live Clock</div>
      <div style="display:flex;gap:32px;align-items:center;flex-wrap:wrap;">
        <div>
          <div id="digital-clock" class="timer-display accent" style="font-size:48px;margin:0"></div>
          <div id="clock-date" class="text-muted text-center mt-8" style="font-size:13px;"></div>
        </div>
        <canvas id="analog-clock" width="160" height="160" style="border-radius:50%;"></canvas>
      </div>
    </div>

    <!-- Stopwatch -->
    <div class="card">
      <div class="card-title">Stopwatch</div>
      <div id="sw-display" class="timer-display">00:00.00</div>
      <div class="timer-controls">
        <button id="sw-start" class="btn btn-primary">▶ Start</button>
        <button id="sw-pause" class="btn btn-secondary" disabled>⏸ Pause</button>
        <button id="sw-lap"   class="btn btn-secondary" disabled>🏁 Lap</button>
        <button id="sw-reset" class="btn btn-secondary">↺ Reset</button>
      </div>
      <div id="lap-list" class="mt-8"></div>
    </div>

    <!-- Countdown -->
    <div class="card">
      <div class="card-title">Countdown Timer</div>
      <div class="input-group">
        <input id="cd-min" type="number" class="input" placeholder="Min" min="0" max="999" style="width:80px">
        <input id="cd-sec" type="number" class="input" placeholder="Sec" min="0" max="59" style="width:80px">
        <button id="cd-set" class="btn btn-secondary">Set</button>
      </div>
      <div id="cd-display" class="timer-display">00:00</div>
      <div class="timer-controls">
        <button id="cd-start" class="btn btn-primary">▶ Start</button>
        <button id="cd-pause" class="btn btn-secondary" disabled>⏸ Pause</button>
        <button id="cd-reset" class="btn btn-secondary">↺ Reset</button>
      </div>
    </div>

    <!-- Pomodoro -->
    <div class="card">
      <div class="card-title">Pomodoro Timer</div>
      <div class="pomo-mode" id="pomo-dots"></div>
      <div id="pomo-label" class="text-center text-muted text-sm mb-8">Work Session</div>
      <div id="pomo-display" class="timer-display">25:00</div>
      <div class="input-group" style="justify-content:center;gap:16px;flex-wrap:wrap;">
        <label class="text-muted text-sm">Work: <input id="pomo-work" type="number" class="input" value="${this._pomoConfig.work}" style="width:60px;display:inline-block"> min</label>
        <label class="text-muted text-sm">Break: <input id="pomo-break" type="number" class="input" value="${this._pomoConfig.shortBreak}" style="width:60px;display:inline-block"> min</label>
        <label class="text-muted text-sm">Long Break: <input id="pomo-long" type="number" class="input" value="${this._pomoConfig.longBreak}" style="width:60px;display:inline-block"> min</label>
        <label class="text-muted text-sm">Sessions: <input id="pomo-sessions" type="number" class="input" value="${this._pomoConfig.sessions}" style="width:60px;display:inline-block"></label>
      </div>
      <div class="timer-controls">
        <button id="pomo-start" class="btn btn-primary">▶ Start</button>
        <button id="pomo-pause" class="btn btn-secondary" disabled>⏸ Pause</button>
        <button id="pomo-reset" class="btn btn-secondary">↺ Reset</button>
      </div>
      <div class="text-center text-muted text-sm mt-8">Sessions completed: <span id="pomo-count" class="text-accent font-mono">${this._pomoSession}</span></div>
    </div>

    <!-- Alarms -->
    <div class="card">
      <div class="card-title">Alarms</div>
      <div class="input-group">
        <input id="alarm-time" type="time" class="input" style="width:130px">
        <input id="alarm-label" type="text" class="input" placeholder="Label (optional)">
        <button id="alarm-add" class="btn btn-primary">Add</button>
      </div>
      <div id="alarm-list" class="item-list mt-8"></div>
    </div>`;
  },

  init() {
    // Digital clock
    clearInterval(this._analogInterval);
    const tick = () => {
      const now = new Date();
      const dc = document.getElementById('digital-clock');
      const dd = document.getElementById('clock-date');
      if(dc) {
        dc.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        if(dd) dd.textContent = now.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
      }
      this.drawAnalog(now);
      this.checkAlarms(now);
    };
    tick();
    this._analogInterval = setInterval(tick, 1000);

    // Stopwatch
    const swDisp = () => document.getElementById('sw-display').textContent = fmtMs(this._swMs);
    document.getElementById('sw-start').onclick = () => {
      this._swRunning = true;
      let last = Date.now();
      this._swInterval = setInterval(() => { this._swMs += Date.now()-last; last=Date.now(); swDisp(); }, 50);
      document.getElementById('sw-start').disabled = true;
      document.getElementById('sw-pause').disabled = false;
      document.getElementById('sw-lap').disabled = false;
    };
    document.getElementById('sw-pause').onclick = () => {
      clearInterval(this._swInterval); this._swRunning = false;
      document.getElementById('sw-start').disabled = false;
      document.getElementById('sw-pause').disabled = true;
    };
    document.getElementById('sw-lap').onclick = () => {
      this._swLaps.push(this._swMs);
      const list = document.getElementById('lap-list');
      list.innerHTML = this._swLaps.map((t,i) => `<div class="lap-item"><span>Lap ${i+1}</span><span>${fmtMs(t)}</span></div>`).join('');
    };
    document.getElementById('sw-reset').onclick = () => {
      clearInterval(this._swInterval); this._swMs = 0; this._swRunning = false; this._swLaps = [];
      swDisp(); document.getElementById('lap-list').innerHTML = '';
      document.getElementById('sw-start').disabled = false;
      document.getElementById('sw-pause').disabled = true;
      document.getElementById('sw-lap').disabled = true;
    };

    // Countdown
    const cdDisp = () => {
      const m=Math.floor(this._cdRemain/60), s=this._cdRemain%60;
      const el = document.getElementById('cd-display');
      if(el) el.textContent = `${pad(m)}:${pad(s)}`;
    };
    cdDisp();
    document.getElementById('cd-set').onclick = () => {
      const m = parseInt(document.getElementById('cd-min').value)||0;
      const s = parseInt(document.getElementById('cd-sec').value)||0;
      this._cdRemain = m*60+s; cdDisp();
    };
    document.getElementById('cd-start').onclick = () => {
      if(!this._cdRemain) return;
      this._cdRunning = true;
      clearInterval(this._cdInterval);
      this._cdInterval = setInterval(() => {
        this._cdRemain--;
        cdDisp();
        if(this._cdRemain <= 0) {
          clearInterval(this._cdInterval); this._cdRunning = false;
          showToast('⏰ Countdown done!', 'success');
          if(Notification.permission === 'granted') new Notification('Everall', { body:'Countdown finished!' });
        }
      }, 1000);
      document.getElementById('cd-start').disabled = true;
      document.getElementById('cd-pause').disabled = false;
    };
    document.getElementById('cd-pause').onclick = () => {
      clearInterval(this._cdInterval); this._cdRunning = false;
      document.getElementById('cd-start').disabled = false;
      document.getElementById('cd-pause').disabled = true;
    };
    document.getElementById('cd-reset').onclick = () => {
      clearInterval(this._cdInterval); this._cdRemain = 0; this._cdRunning = false; cdDisp();
      document.getElementById('cd-start').disabled = false;
      document.getElementById('cd-pause').disabled = true;
    };

    // Pomodoro
    this.renderPomoDots();
    const pomoCfg = () => {
      this._pomoConfig.work = parseInt(document.getElementById('pomo-work').value)||25;
      this._pomoConfig.shortBreak = parseInt(document.getElementById('pomo-break').value)||5;
      this._pomoConfig.longBreak = parseInt(document.getElementById('pomo-long').value)||15;
      this._pomoConfig.sessions = parseInt(document.getElementById('pomo-sessions').value)||4;
    };
    const pomoDisp = () => {
      const m=Math.floor(this._pomoSec/60), s=this._pomoSec%60;
      const el=document.getElementById('pomo-display'); if(el) el.textContent=`${pad(m)}:${pad(s)}`;
    };
    const pomoNextMode = () => {
      if(this._pomoMode==='work') {
        this._pomoSession++;
        document.getElementById('pomo-count').textContent = this._pomoSession;
        this.renderPomoDots();
        if(this._pomoSession % this._pomoConfig.sessions === 0) {
          this._pomoMode='longBreak'; this._pomoSec=this._pomoConfig.longBreak*60;
          document.getElementById('pomo-label').textContent='Long Break 🎉';
        } else {
          this._pomoMode='shortBreak'; this._pomoSec=this._pomoConfig.shortBreak*60;
          document.getElementById('pomo-label').textContent='Short Break ☕';
        }
      } else {
        this._pomoMode='work'; this._pomoSec=this._pomoConfig.work*60;
        document.getElementById('pomo-label').textContent='Work Session 🎯';
      }
      showToast(this._pomoMode==='work'?'Time to work!':'Take a break!', 'success');
      pomoDisp();
    };
    if(!this._pomoSec) { this._pomoSec = this._pomoConfig.work*60; pomoDisp(); }
    document.getElementById('pomo-start').onclick = () => {
      pomoCfg(); if(!this._pomoSec) this._pomoSec=this._pomoConfig.work*60;
      this._pomoRunning=true;
      this._pomoInterval = setInterval(()=>{
        this._pomoSec--;
        if(this._pomoSec<=0) { clearInterval(this._pomoInterval); pomoNextMode(); } else pomoDisp();
      }, 1000);
      document.getElementById('pomo-start').disabled=true;
      document.getElementById('pomo-pause').disabled=false;
    };
    document.getElementById('pomo-pause').onclick = () => {
      clearInterval(this._pomoInterval); this._pomoRunning=false;
      document.getElementById('pomo-start').disabled=false;
      document.getElementById('pomo-pause').disabled=true;
    };
    document.getElementById('pomo-reset').onclick = () => {
      clearInterval(this._pomoInterval); this._pomoRunning=false; this._pomoMode='work'; this._pomoSec=this._pomoConfig.work*60;
      this._pomoSession=0; pomoDisp();
      document.getElementById('pomo-label').textContent='Work Session 🎯';
      document.getElementById('pomo-count').textContent='0';
      document.getElementById('pomo-start').disabled=false;
      document.getElementById('pomo-pause').disabled=true;
      this.renderPomoDots();
    };

    // Alarms
    this.renderAlarms();
    document.getElementById('alarm-add').onclick = () => {
      const t=document.getElementById('alarm-time').value;
      const l=document.getElementById('alarm-label').value||'Alarm';
      if(!t) return showToast('Set a time first','error');
      this._alarms.push({id:uid(),time:t,label:l,active:true});
      Storage.save('alarms',this._alarms); this.renderAlarms();
      showToast('✅ Alarm set for '+t);
    };
    Notification.requestPermission?.();
  },

  renderPomoDots() {
    const el=document.getElementById('pomo-dots'); if(!el) return;
    el.innerHTML = Array.from({length:this._pomoConfig.sessions}).map((_,i)=>`<div class="pomo-dot ${i<this._pomoSession%this._pomoConfig.sessions?'done':''}"></div>`).join('');
  },

  renderAlarms() {
    const el=document.getElementById('alarm-list'); if(!el) return;
    if(!this._alarms.length) { el.innerHTML='<div class="empty-state"><div class="empty-state-icon">⏰</div>No alarms set</div>'; return; }
    el.innerHTML = this._alarms.map(a=>`
    <div class="list-item">
      <div class="checkbox ${a.active?'checked':''}">✓</div>
      <span class="font-mono text-accent">${a.time}</span>
      <span>${escHtml(a.label)}</span>
      <div class="item-actions">
        <button class="btn btn-icon btn-ghost" onclick="TimeModule.deleteAlarm('${a.id}')">🗑</button>
      </div>
    </div>`).join('');
  },

  deleteAlarm(id) {
    this._alarms = this._alarms.filter(a=>a.id!==id);
    Storage.save('alarms',this._alarms); this.renderAlarms();
  },

  checkAlarms(now) {
    const cur = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if(now.getSeconds()!==0) return;
    this._alarms.forEach(a=>{
      if(a.active && a.time===cur) {
        showToast(`⏰ Alarm: ${a.label}`, 'success');
        if(Notification.permission==='granted') new Notification('Everall Alarm', {body:a.label});
      }
    });
  },

  drawAnalog(now) {
    const canvas = document.getElementById('analog-clock'); if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const W=160,H=160,cx=80,cy=80,r=72;
    ctx.clearRect(0,0,W,H);
    // Face
    ctx.beginPath(); ctx.arc(cx,cy,r,0,2*Math.PI);
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--surface2').trim();
    ctx.fill();
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--border2').trim();
    ctx.lineWidth=2; ctx.stroke();
    // Ticks
    for(let i=0;i<12;i++){
      const a=i/12*2*Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx+Math.sin(a)*(r-8), cy-Math.cos(a)*(r-8));
      ctx.lineTo(cx+Math.sin(a)*(r-2), cy-Math.cos(a)*(r-2));
      ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue('--text3').trim();
      ctx.lineWidth=1.5; ctx.stroke();
    }
    const hr=now.getHours()%12, min=now.getMinutes(), sec=now.getSeconds();
    const drawHand=(angle,len,width,color)=>{
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.lineTo(cx+Math.sin(angle)*len, cy-Math.cos(angle)*len);
      ctx.strokeStyle=color; ctx.lineWidth=width; ctx.lineCap='round'; ctx.stroke();
    };
    const textColor = getComputedStyle(document.body).getPropertyValue('--text').trim();
    const accentColor = getComputedStyle(document.body).getPropertyValue('--accent').trim();
    drawHand((hr + min/60)/12*2*Math.PI, r*0.5, 4, textColor);
    drawHand((min + sec/60)/60*2*Math.PI, r*0.72, 3, textColor);
    drawHand(sec/60*2*Math.PI, r*0.82, 1.5, accentColor);
    ctx.beginPath(); ctx.arc(cx,cy,4,0,2*Math.PI); ctx.fillStyle=accentColor; ctx.fill();
  }
};

// ══════════════════════════════════════════════════
// MODULE: TO-DO LIST
// ══════════════════════════════════════════════════
const TodoModule = {
  render() {
    const todos = Storage.load('todos', []);
    const total = todos.length, done = todos.filter(t=>t.done).length;
    return `
    <div class="module-header">
      <div><div class="module-title">✅ To-Do List</div><div class="module-subtitle">${done} of ${total} completed</div></div>
      <button class="btn btn-primary" onclick="TodoModule.openAdd()">➕ Add Task</button>
    </div>
    <!-- Filter bar -->
    <div class="input-group mb-16">
      <input id="todo-search" type="text" class="input" placeholder="Search tasks..." oninput="TodoModule.render2()">
      <select id="todo-filter" class="select" style="width:120px" onchange="TodoModule.render2()">
        <option value="">All</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <select id="todo-status" class="select" style="width:120px" onchange="TodoModule.render2()">
        <option value="">All</option>
        <option value="active">Active</option>
        <option value="done">Done</option>
      </select>
    </div>
    <div id="todo-list"></div>
    <!-- Stats -->
    <div class="card mt-16">
      <div class="card-title">Stats</div>
      <div class="card-grid-3">
        <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Total</div></div>
        <div class="stat-card"><div class="stat-value text-green">${done}</div><div class="stat-label">Completed</div></div>
        <div class="stat-card"><div class="stat-value text-accent">${total-done}</div><div class="stat-label">Remaining</div></div>
      </div>
    </div>`;
  },

  render2() {
    const todos = Storage.load('todos',[]);
    const q = (document.getElementById('todo-search')?.value||'').toLowerCase();
    const f = document.getElementById('todo-filter')?.value||'';
    const s = document.getElementById('todo-status')?.value||'';
    const filtered = todos.filter(t=>{
      if(q && !t.text.toLowerCase().includes(q)) return false;
      if(f && t.priority!==f) return false;
      if(s==='active' && t.done) return false;
      if(s==='done' && !t.done) return false;
      return true;
    });
    const el=document.getElementById('todo-list');
    if(!el) return;
    if(!filtered.length) { el.innerHTML='<div class="empty-state"><div class="empty-state-icon">✅</div>No tasks found</div>'; return; }
    el.innerHTML = `<div class="item-list">${filtered.map(t=>this.renderItem(t)).join('')}</div>`;
  },

  renderItem(t) {
    const priColor = {high:'badge-red',medium:'badge-amber',low:'badge-green'}[t.priority]||'badge-gray';
    const subs = (t.subtasks||[]);
    return `
    <div class="list-item ${t.done?'completed':''}" id="todo-${t.id}">
      <div class="checkbox ${t.done?'checked':''}" onclick="TodoModule.toggle('${t.id}')">✓</div>
      <div style="flex:1">
        <div class="item-text" style="font-weight:500">${escHtml(t.text)}</div>
        ${t.due?`<div class="text-sm text-muted">📅 ${t.due}</div>`:''}
        ${subs.length?`<div class="text-sm text-muted mt-8">${subs.filter(s=>s.done).length}/${subs.length} subtasks</div>`:''}
      </div>
      <span class="badge ${priColor} capitalize">${t.priority}</span>
      ${t.recurring?`<span class="badge badge-blue">${t.recurring}</span>`:''}
      <div class="item-actions">
        <button class="btn btn-icon btn-ghost" onclick="TodoModule.openEdit('${t.id}')">✏️</button>
        <button class="btn btn-icon btn-ghost btn-danger" onclick="TodoModule.delete('${t.id}')">🗑</button>
      </div>
    </div>`;
  },

  init() { this.render2(); },

  toggle(id) {
    const todos = Storage.load('todos',[]);
    const t = todos.find(t=>t.id===id); if(t) t.done=!t.done;
    Storage.save('todos',todos); this.render2();
  },

  delete(id) {
    Storage.save('todos', Storage.load('todos',[]).filter(t=>t.id!==id));
    this.render2(); showToast('Task deleted');
  },

  openAdd() {
    openModal(`
    <div class="section-title">Add Task</div>
    <div class="form-group"><label class="form-label">Task</label><input id="m-task" class="input" placeholder="What needs to be done?"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Priority</label>
        <select id="m-priority" class="select"><option value="medium">Medium</option><option value="high">High</option><option value="low">Low</option></select>
      </div>
      <div class="form-group"><label class="form-label">Due Date</label><input id="m-due" class="input" type="datetime-local"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Recurring</label>
        <select id="m-recur" class="select"><option value="">None</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Subtasks (one per line)</label><textarea id="m-subs" class="input" rows="3" placeholder="Subtask 1&#10;Subtask 2"></textarea></div>
    <button class="btn btn-primary w-full" onclick="TodoModule.save()">Add Task</button>`);
  },

  openEdit(id) {
    const todos = Storage.load('todos',[]);
    const t = todos.find(t=>t.id===id); if(!t) return;
    openModal(`
    <div class="section-title">Edit Task</div>
    <div class="form-group"><label class="form-label">Task</label><input id="m-task" class="input" value="${escHtml(t.text)}"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Priority</label>
        <select id="m-priority" class="select">
          ${['medium','high','low'].map(p=>`<option value="${p}" ${t.priority===p?'selected':''}>${p}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label class="form-label">Due</label><input id="m-due" class="input" type="datetime-local" value="${t.due||''}"></div>
    </div>
    <div class="form-group"><label class="form-label">Recurring</label>
      <select id="m-recur" class="select"><option value="" ${!t.recurring?'selected':''}>None</option><option value="daily" ${t.recurring==='daily'?'selected':''}>Daily</option><option value="weekly" ${t.recurring==='weekly'?'selected':''}>Weekly</option></select>
    </div>
    <div class="form-group"><label class="form-label">Subtasks</label><textarea id="m-subs" class="input" rows="3">${(t.subtasks||[]).map(s=>s.text).join('\n')}</textarea></div>
    <button class="btn btn-primary w-full" onclick="TodoModule.saveEdit('${id}')">Update</button>`);
  },

  save() {
    const text = document.getElementById('m-task').value.trim();
    if(!text) return showToast('Enter a task','error');
    const subsRaw = document.getElementById('m-subs').value.trim();
    const subtasks = subsRaw ? subsRaw.split('\n').filter(Boolean).map(s=>({id:uid(),text:s,done:false})) : [];
    const todos = Storage.load('todos',[]);
    todos.unshift({id:uid(),text,priority:document.getElementById('m-priority').value,due:document.getElementById('m-due').value,recurring:document.getElementById('m-recur').value,subtasks,done:false,created:today()});
    Storage.save('todos',todos); closeModal(); this.render2(); showToast('✅ Task added!','success');
  },

  saveEdit(id) {
    const text = document.getElementById('m-task').value.trim();
    if(!text) return showToast('Enter a task','error');
    const subsRaw = document.getElementById('m-subs').value.trim();
    const subtasks = subsRaw ? subsRaw.split('\n').filter(Boolean).map(s=>({id:uid(),text:s,done:false})) : [];
    const todos = Storage.load('todos',[]);
    const t = todos.find(t=>t.id===id);
    if(t) { t.text=text; t.priority=document.getElementById('m-priority').value; t.due=document.getElementById('m-due').value; t.recurring=document.getElementById('m-recur').value; t.subtasks=subtasks; }
    Storage.save('todos',todos); closeModal(); this.render2(); showToast('✅ Task updated!','success');
  }
};

// ══════════════════════════════════════════════════
// MODULE: HABITS
// ══════════════════════════════════════════════════
const HabitModule = {
  render() {
    const habits = Storage.load('habits',[]);
    return `
    <div class="module-header">
      <div><div class="module-title">🔥 Habit Tracker</div><div class="module-subtitle">Build consistency</div></div>
      <button class="btn btn-primary" onclick="HabitModule.openAdd()">➕ Add Habit</button>
    </div>
    <div class="text-muted text-sm mb-16">Today: <strong class="text-accent">${new Date().toLocaleDateString('en-US',{weekday:'long'})}</strong></div>
    <div id="habit-list"></div>`;
  },

  render2() {
    const habits = Storage.load('habits',[]);
    const el = document.getElementById('habit-list');
    if(!el) return;
    if(!habits.length) { el.innerHTML='<div class="empty-state"><div class="empty-state-icon">🔥</div>Add your first habit!</div>'; return; }
    el.innerHTML = habits.map(h=>{
      const donePct = h.history ? Math.round((Object.values(h.history).filter(Boolean).length / Math.max(Object.keys(h.history).length,1))*100) : 0;
      return `
      <div class="habit-row">
        <div class="checkbox ${h.doneToday?'checked':''}" onclick="HabitModule.toggle('${h.id}')">✓</div>
        <div style="flex:1">
          <div style="font-weight:600">${escHtml(h.name)}</div>
          <div class="progress-bar mt-8" style="width:160px"><div class="progress-fill" style="width:${donePct}%"></div></div>
        </div>
        <div class="habit-streak"><span class="streak-flame">🔥</span>${h.streak||0} day${h.streak!==1?'s':''}</div>
        <div class="item-actions" style="opacity:1">
          <button class="btn btn-icon btn-ghost btn-danger" onclick="HabitModule.delete('${h.id}')">🗑</button>
        </div>
      </div>`;
    }).join('');
  },

  init() {
    this.syncToday();
    this.render2();
  },

  syncToday() {
    const habits = Storage.load('habits',[]);
    const t = today();
    let changed = false;
    habits.forEach(h=>{
      if(!h.lastDate) h.lastDate = t;
      if(h.lastDate !== t) {
        // New day — check if yesterday was skipped
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
        const yStr = yesterday.toISOString().slice(0,10);
        if(h.lastDate < yStr) { h.streak=0; } // Skipped
        h.doneToday = false;
        h.lastDate = t;
        changed = true;
      }
      if(!h.history) h.history = {};
    });
    if(changed) Storage.save('habits',habits);
  },

  toggle(id) {
    const habits = Storage.load('habits',[]);
    const h = habits.find(h=>h.id===id); if(!h) return;
    h.doneToday = !h.doneToday;
    if(!h.history) h.history={};
    h.history[today()] = h.doneToday;
    if(h.doneToday) h.streak = (h.streak||0)+1;
    else h.streak = Math.max(0,(h.streak||1)-1);
    Storage.save('habits',habits); this.render2();
  },

  delete(id) {
    Storage.save('habits', Storage.load('habits',[]).filter(h=>h.id!==id));
    this.render2(); showToast('Habit removed');
  },

  openAdd() {
    openModal(`
    <div class="section-title">Add Habit</div>
    <div class="form-group"><label class="form-label">Habit Name</label><input id="m-habit" class="input" placeholder="e.g. Drink water, Exercise..."></div>
    <button class="btn btn-primary w-full" onclick="HabitModule.save()">Add Habit</button>`);
  },

  save() {
    const name = document.getElementById('m-habit').value.trim();
    if(!name) return showToast('Enter a habit name','error');
    const habits = Storage.load('habits',[]);
    habits.push({id:uid(),name,streak:0,doneToday:false,lastDate:today(),history:{}});
    Storage.save('habits',habits); closeModal(); this.init(); showToast('🔥 Habit added!','success');
  }
};

// ══════════════════════════════════════════════════
// MODULE: GOALS
// ══════════════════════════════════════════════════
const GoalsModule = {
  render() {
    const goals = Storage.load('goals',[]);
    return `
    <div class="module-header">
      <div><div class="module-title">🎯 Goals & Milestones</div><div class="module-subtitle">Track your progress</div></div>
      <button class="btn btn-primary" onclick="GoalsModule.openAdd()">➕ Add Goal</button>
    </div>
    <div id="goal-list"></div>`;
  },
  render2() {
    const goals = Storage.load('goals',[]);
    const el=document.getElementById('goal-list'); if(!el) return;
    if(!goals.length){el.innerHTML='<div class="empty-state"><div class="empty-state-icon">🎯</div>Add your first goal!</div>';return;}
    el.innerHTML=goals.map(g=>{
      const pct=Math.min(100,Math.round((g.current/g.target)*100));
      return `
      <div class="card">
        <div class="flex-between mb-8">
          <div><div style="font-weight:700;font-size:16px">${escHtml(g.name)}</div>
            <div class="text-sm text-muted">${escHtml(g.description||'')}</div>
          </div>
          <div class="flex gap-8">
            <button class="btn btn-sm btn-secondary" onclick="GoalsModule.openUpdate('${g.id}')">Update</button>
            <button class="btn btn-sm btn-danger" onclick="GoalsModule.delete('${g.id}')">Delete</button>
          </div>
        </div>
        <div class="flex-between text-sm mb-8">
          <span class="font-mono text-accent">${g.current} / ${g.target} ${escHtml(g.unit||'')}</span>
          <span class="badge ${pct>=100?'badge-green':'badge-amber'}">${pct}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill ${pct>=100?'green':''}" style="width:${pct}%"></div></div>
        ${g.deadline?`<div class="text-sm text-muted mt-8">📅 Deadline: ${g.deadline}</div>`:''}
      </div>`;
    }).join('');
  },
  init(){this.render2();},
  openAdd(){
    openModal(`<div class="section-title">Add Goal</div>
    <div class="form-group"><label class="form-label">Goal Name</label><input id="m-gname" class="input" placeholder="e.g. Save $1000"></div>
    <div class="form-group"><label class="form-label">Description</label><input id="m-gdesc" class="input" placeholder="Optional"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Target</label><input id="m-gtarget" class="input" type="number" placeholder="100"></div>
      <div class="form-group"><label class="form-label">Unit</label><input id="m-gunit" class="input" placeholder="$, km, pages..."></div>
    </div>
    <div class="form-group"><label class="form-label">Deadline</label><input id="m-gdeadline" class="input" type="date"></div>
    <button class="btn btn-primary w-full" onclick="GoalsModule.save()">Add Goal</button>`);
  },
  openUpdate(id){
    const g=Storage.load('goals',[]).find(g=>g.id===id); if(!g) return;
    openModal(`<div class="section-title">Update Progress: ${escHtml(g.name)}</div>
    <div class="form-group"><label class="form-label">Current Progress</label><input id="m-gcurrent" class="input" type="number" value="${g.current}"></div>
    <button class="btn btn-primary w-full" onclick="GoalsModule.updateProgress('${id}')">Update</button>`);
  },
  save(){
    const name=document.getElementById('m-gname').value.trim();
    if(!name) return showToast('Enter a goal name','error');
    const goals=Storage.load('goals',[]);
    goals.push({id:uid(),name,description:document.getElementById('m-gdesc').value,target:parseFloat(document.getElementById('m-gtarget').value)||100,current:0,unit:document.getElementById('m-gunit').value,deadline:document.getElementById('m-gdeadline').value,created:today()});
    Storage.save('goals',goals); closeModal(); this.render2(); showToast('🎯 Goal added!','success');
  },
  updateProgress(id){
    const goals=Storage.load('goals',[]);
    const g=goals.find(g=>g.id===id); if(g) g.current=parseFloat(document.getElementById('m-gcurrent').value)||0;
    Storage.save('goals',goals); closeModal(); this.render2(); showToast('Progress updated!','success');
  },
  delete(id){
    Storage.save('goals',Storage.load('goals',[]).filter(g=>g.id!==id));
    this.render2();
  }
};

// ══════════════════════════════════════════════════
// MODULE: WISHLIST
// ══════════════════════════════════════════════════
const WishlistModule = {
  render(){
    return `
    <div class="module-header">
      <div><div class="module-title">⭐ Wishlist & Savings</div><div class="module-subtitle">Track things you want</div></div>
      <button class="btn btn-primary" onclick="WishlistModule.openAdd()">➕ Add Item</button>
    </div>
    <div id="wish-list"></div>`;
  },
  render2(){
    const items=Storage.load('wishlist',[]);
    const el=document.getElementById('wish-list'); if(!el) return;
    if(!items.length){el.innerHTML='<div class="empty-state"><div class="empty-state-icon">⭐</div>Nothing in your wishlist!</div>';return;}
    el.innerHTML=`<div class="card-grid">${items.map(i=>{
      const pct=Math.min(100,Math.round(((i.saved||0)/i.price)*100));
      return `<div class="card">
        <div class="flex-between mb-8">
          <div style="font-weight:700">${escHtml(i.name)}</div>
          ${i.priority?`<span class="badge badge-amber">${i.priority}</span>`:''}
        </div>
        <div class="flex-between text-sm mb-8">
          <span class="text-muted">Target: <span class="font-mono text-accent">$${i.price}</span></span>
          <span class="text-muted">Saved: <span class="font-mono text-green">$${i.saved||0}</span></span>
        </div>
        <div class="progress-bar mb-8"><div class="progress-fill ${pct>=100?'green':''}" style="width:${pct}%"></div></div>
        <div class="text-center text-sm font-mono ${pct>=100?'text-green':'text-muted'}">${pct}% funded</div>
        <div class="flex gap-8 mt-8">
          <button class="btn btn-sm btn-secondary" onclick="WishlistModule.addSavings('${i.id}')">+ Add Savings</button>
          <button class="btn btn-sm btn-danger" onclick="WishlistModule.delete('${i.id}')">Delete</button>
        </div>
      </div>`;
    }).join('')}</div>`;
  },
  init(){this.render2();},
  openAdd(){
    openModal(`<div class="section-title">Add Wishlist Item</div>
    <div class="form-group"><label class="form-label">Item Name</label><input id="m-wname" class="input" placeholder="e.g. MacBook Pro"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Target Price ($)</label><input id="m-wprice" class="input" type="number" placeholder="999"></div>
      <div class="form-group"><label class="form-label">Priority</label>
        <select id="m-wpri" class="select"><option value="">None</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
      </div>
    </div>
    <button class="btn btn-primary w-full" onclick="WishlistModule.save()">Add to Wishlist</button>`);
  },
  addSavings(id){
    const item=Storage.load('wishlist',[]).find(i=>i.id===id); if(!item) return;
    openModal(`<div class="section-title">Add Savings for: ${escHtml(item.name)}</div>
    <div class="form-group"><label class="form-label">Amount ($)</label><input id="m-wsaved" class="input" type="number" placeholder="50"></div>
    <button class="btn btn-primary w-full" onclick="WishlistModule.updateSavings('${id}')">Save</button>`);
  },
  save(){
    const name=document.getElementById('m-wname').value.trim();
    if(!name) return showToast('Enter an item name','error');
    const items=Storage.load('wishlist',[]);
    items.push({id:uid(),name,price:parseFloat(document.getElementById('m-wprice').value)||0,saved:0,priority:document.getElementById('m-wpri').value,added:today()});
    Storage.save('wishlist',items); closeModal(); this.render2(); showToast('⭐ Added to wishlist!','success');
  },
  updateSavings(id){
    const items=Storage.load('wishlist',[]);
    const i=items.find(i=>i.id===id); if(i) i.saved=(i.saved||0)+parseFloat(document.getElementById('m-wsaved').value)||0;
    Storage.save('wishlist',items); closeModal(); this.render2(); showToast('💰 Savings updated!','success');
  },
  delete(id){
    Storage.save('wishlist',Storage.load('wishlist',[]).filter(i=>i.id!==id));
    this.render2();
  }
};

// ══════════════════════════════════════════════════
// MODULE: NOTES
// ══════════════════════════════════════════════════
const NotesModule = {
  _activeId: null,
  render(){
    return `
    <div class="module-header">
      <div><div class="module-title">📝 Notes</div></div>
      <div class="flex gap-8">
        <input id="note-search" type="text" class="input" placeholder="Search notes..." style="width:200px" oninput="NotesModule.renderSidebar()">
        <button class="btn btn-primary" onclick="NotesModule.newNote()">➕ New</button>
      </div>
    </div>
    <div class="notes-layout">
      <div class="notes-sidebar" id="note-sidebar"></div>
      <div class="notes-editor" id="note-editor">
        <div class="empty-state"><div class="empty-state-icon">📝</div>Select or create a note</div>
      </div>
    </div>`;
  },
  renderSidebar(){
    const notes=Storage.load('notes',[]);
    const q=(document.getElementById('note-search')?.value||'').toLowerCase();
    const el=document.getElementById('note-sidebar'); if(!el) return;
    const filtered=notes.filter(n=>!q||n.title.toLowerCase().includes(q)||n.content.toLowerCase().includes(q));
    if(!filtered.length){el.innerHTML='<div class="text-muted text-sm text-center" style="padding:20px">No notes</div>';return;}
    el.innerHTML=filtered.map(n=>`
    <div class="note-item ${this._activeId===n.id?'active':''}" onclick="NotesModule.openNote('${n.id}')">
      <div class="note-title-sm">${escHtml(n.title||'Untitled')}</div>
      <div class="note-date-sm">${n.updated||n.created||''}</div>
      ${n.tag?`<span class="badge badge-amber text-sm">${escHtml(n.tag)}</span>`:''}
    </div>`).join('');
  },
  openNote(id){
    this._activeId=id;
    const notes=Storage.load('notes',[]);
    const n=notes.find(n=>n.id===id); if(!n) return;
    const editor=document.getElementById('note-editor'); if(!editor) return;
    editor.innerHTML=`
      <div class="flex-between mb-8">
        <input id="note-title-in" class="input" value="${escHtml(n.title||'')}" placeholder="Note title" style="font-weight:700;font-size:16px">
        <div class="flex gap-8">
          <input id="note-tag-in" class="input" value="${escHtml(n.tag||'')}" placeholder="Tag" style="width:100px">
          <button class="btn btn-primary btn-sm" onclick="NotesModule.saveNote('${id}')">Save</button>
          <button class="btn btn-danger btn-sm" onclick="NotesModule.delete('${id}')">Delete</button>
        </div>
      </div>
      <textarea id="note-content-area" class="input" style="flex:1;min-height:320px;background:transparent;border:none;resize:none;font-size:14px;line-height:1.7" placeholder="Start writing...">${escHtml(n.content||'')}</textarea>`;
    this.renderSidebar();
  },
  newNote(){
    const notes=Storage.load('notes',[]);
    const n={id:uid(),title:'',content:'',tag:'',created:today(),updated:today()};
    notes.unshift(n); Storage.save('notes',notes);
    this.openNote(n.id); this.renderSidebar();
  },
  saveNote(id){
    const notes=Storage.load('notes',[]);
    const n=notes.find(n=>n.id===id); if(!n) return;
    n.title=document.getElementById('note-title-in')?.value||'Untitled';
    n.content=document.getElementById('note-content-area')?.value||'';
    n.tag=document.getElementById('note-tag-in')?.value||'';
    n.updated=today();
    Storage.save('notes',notes); this.renderSidebar(); showToast('📝 Note saved!','success');
  },
  delete(id){
    Storage.save('notes',Storage.load('notes',[]).filter(n=>n.id!==id));
    this._activeId=null;
    document.getElementById('note-editor').innerHTML='<div class="empty-state"><div class="empty-state-icon">📝</div>Note deleted</div>';
    this.renderSidebar(); showToast('Note deleted');
  },
  init(){this.renderSidebar();}
};

// ══════════════════════════════════════════════════
// MODULE: CALENDAR
// ══════════════════════════════════════════════════
const CalendarModule = {
  _year: new Date().getFullYear(),
  _month: new Date().getMonth(),
  render(){
    return `
    <div class="module-header">
      <div><div class="module-title">📅 Calendar</div></div>
      <button class="btn btn-primary" onclick="CalendarModule.openAdd()">➕ Add Event</button>
    </div>
    <div class="card">
      <div class="flex-between mb-16">
        <button class="btn btn-ghost" onclick="CalendarModule.prevMonth()">◀ Prev</button>
        <span id="cal-label" style="font-weight:700;font-size:16px"></span>
        <button class="btn btn-ghost" onclick="CalendarModule.nextMonth()">Next ▶</button>
      </div>
      <div id="cal-grid"></div>
    </div>
    <div class="card">
      <div class="card-title">Upcoming Events</div>
      <div id="event-list"></div>
    </div>`;
  },
  renderCal(){
    const events=Storage.load('events',[]);
    const el=document.getElementById('cal-grid'); if(!el) return;
    document.getElementById('cal-label').textContent=`${monthName(this._month)} ${this._year}`;
    const first=new Date(this._year,this._month,1).getDay();
    const days=new Date(this._year,this._month+1,0).getDate();
    const prevDays=new Date(this._year,this._month,0).getDate();
    const today=new Date();
    let html=`<div class="cal-header-day">Sun</div><div class="cal-header-day">Mon</div><div class="cal-header-day">Tue</div><div class="cal-header-day">Wed</div><div class="cal-header-day">Thu</div><div class="cal-header-day">Fri</div><div class="cal-header-day">Sat</div>`;
    for(let i=first-1;i>=0;i--) html+=`<div class="cal-day other-month">${prevDays-i}</div>`;
    for(let d=1;d<=days;d++){
      const dateStr=`${this._year}-${pad(this._month+1)}-${pad(d)}`;
      const hasEv=events.some(e=>e.date===dateStr);
      const isToday=today.getFullYear()===this._year&&today.getMonth()===this._month&&today.getDate()===d;
      html+=`<div class="cal-day ${isToday?'today':''} ${hasEv?'has-event':''}" onclick="CalendarModule.showDay('${dateStr}')">${d}</div>`;
    }
    const remaining=(7-((first+days)%7))%7;
    for(let i=1;i<=remaining;i++) html+=`<div class="cal-day other-month">${i}</div>`;
    el.innerHTML=html;
    this.renderEventList();
  },
  renderEventList(){
    const events=Storage.load('events',[]);
    const el=document.getElementById('event-list'); if(!el) return;
    const upcoming=events.filter(e=>e.date>=today()).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,10);
    if(!upcoming.length){el.innerHTML='<div class="empty-state"><div>No upcoming events</div></div>';return;}
    el.innerHTML=upcoming.map(e=>`
    <div class="list-item">
      <div style="font-size:18px">${e.color||'📅'}</div>
      <div style="flex:1">
        <div style="font-weight:600">${escHtml(e.title)}</div>
        <div class="text-sm text-muted">${e.date}${e.time?' at '+e.time:''}</div>
      </div>
      ${e.category?`<span class="badge badge-blue">${escHtml(e.category)}</span>`:''}
      <div class="item-actions"><button class="btn btn-icon btn-ghost btn-danger" onclick="CalendarModule.deleteEvent('${e.id}')">🗑</button></div>
    </div>`).join('');
  },
  showDay(dateStr){
    const events=Storage.load('events',[]).filter(e=>e.date===dateStr);
    openModal(`<div class="section-title">📅 ${dateStr}</div>
    ${events.length?events.map(e=>`<div class="list-item"><div style="font-weight:600">${escHtml(e.title)}</div><div class="text-sm text-muted">${e.time||''}</div><button class="btn btn-sm btn-danger" onclick="CalendarModule.deleteEvent('${e.id}');closeModal()">Delete</button></div>`).join(''):'<div class="text-muted text-center">No events</div>'}
    <hr class="divider">
    <div class="section-title">Add Event</div>
    <input id="m-etitle" class="input mb-8" placeholder="Event title">
    <div class="form-row">
      <input id="m-etime" type="time" class="input">
      <input id="m-ecat" class="input" placeholder="Category">
    </div>
    <button class="btn btn-primary w-full mt-8" onclick="CalendarModule.saveEvent('${dateStr}')">Add Event</button>`);
  },
  openAdd(){
    openModal(`<div class="section-title">Add Event</div>
    <div class="form-group"><label class="form-label">Title</label><input id="m-etitle" class="input" placeholder="Event title"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Date</label><input id="m-edate" type="date" class="input"></div>
      <div class="form-group"><label class="form-label">Time</label><input id="m-etime" type="time" class="input"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Category</label><input id="m-ecat" class="input" placeholder="Work, Personal..."></div>
      <div class="form-group"><label class="form-label">Icon</label>
        <select id="m-ecolor" class="select"><option value="📅">📅 Default</option><option value="🎂">🎂 Birthday</option><option value="💼">💼 Work</option><option value="🏥">🏥 Health</option><option value="✈️">✈️ Travel</option></select>
      </div>
    </div>
    <button class="btn btn-primary w-full" onclick="CalendarModule.saveEvent(document.getElementById('m-edate').value)">Add Event</button>`);
  },
  saveEvent(date){
    const title=document.getElementById('m-etitle')?.value.trim();
    if(!title||!date) return showToast('Fill in title and date','error');
    const events=Storage.load('events',[]);
    events.push({id:uid(),title,date,time:document.getElementById('m-etime')?.value||'',category:document.getElementById('m-ecat')?.value||'',color:document.getElementById('m-ecolor')?.value||'📅'});
    Storage.save('events',events); closeModal(); this.renderCal(); showToast('📅 Event added!','success');
  },
  deleteEvent(id){
    Storage.save('events',Storage.load('events',[]).filter(e=>e.id!==id));
    this.renderCal(); closeModal();
  },
  prevMonth(){ this._month--; if(this._month<0){this._month=11;this._year--;} this.renderCal(); },
  nextMonth(){ this._month++; if(this._month>11){this._month=0;this._year++;} this.renderCal(); },
  init(){ this.renderCal(); }
};

// ══════════════════════════════════════════════════
// MODULE: STUDY PLANNER
// ══════════════════════════════════════════════════
const StudyModule = {
  render(){
    return `
    <div class="module-header">
      <div><div class="module-title">📚 Study Planner</div></div>
      <button class="btn btn-primary" onclick="StudyModule.openAdd()">➕ Add Subject</button>
    </div>
    <div id="study-grid" class="card-grid"></div>
    <!-- Exam Countdowns -->
    <div class="module-header mt-16">
      <div><div class="module-title" style="font-size:18px">🎓 Exam Countdowns</div></div>
      <button class="btn btn-secondary" onclick="StudyModule.openAddExam()">➕ Add Exam</button>
    </div>
    <div id="exam-list" class="item-list"></div>`;
  },
  renderSubjects(){
    const subjects=Storage.load('subjects',[]);
    const el=document.getElementById('study-grid'); if(!el) return;
    if(!subjects.length){el.innerHTML='<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">📚</div>Add a subject to start!</div>';return;}
    el.innerHTML=subjects.map(s=>`
    <div class="subject-card">
      <div class="flex-between mb-8">
        <div class="subject-name">${escHtml(s.name)}</div>
        <button class="btn btn-icon btn-ghost btn-danger" onclick="StudyModule.deleteSubject('${s.id}')">🗑</button>
      </div>
      <div class="subject-hours">${(s.hours||0).toFixed(1)}h</div>
      <div class="text-sm text-muted mb-8">Total study time</div>
      <div class="input-group">
        <input id="log-h-${s.id}" class="input" type="number" placeholder="Hours" min="0" step="0.25" style="width:80px">
        <button class="btn btn-sm btn-primary" onclick="StudyModule.logSession('${s.id}')">Log</button>
      </div>
    </div>`).join('');
  },
  renderExams(){
    const exams=Storage.load('exams',[]);
    const el=document.getElementById('exam-list'); if(!el) return;
    if(!exams.length){el.innerHTML='<div class="empty-state"><div>No exams added</div></div>';return;}
    const now=new Date();
    el.innerHTML=exams.map(e=>{
      const diff=Math.ceil((new Date(e.date)-now)/(1000*86400));
      return `<div class="list-item">
        <div style="font-size:20px">📝</div>
        <div style="flex:1"><div style="font-weight:600">${escHtml(e.name)}</div><div class="text-sm text-muted">${e.date}</div></div>
        <span class="badge ${diff<=3?'badge-red':diff<=7?'badge-amber':'badge-green'}">${diff<=0?'Today!':diff+' days'}</span>
        <button class="btn btn-icon btn-ghost btn-danger" onclick="StudyModule.deleteExam('${e.id}')">🗑</button>
      </div>`;
    }).join('');
  },
  openAdd(){
    openModal(`<div class="section-title">Add Subject</div>
    <input id="m-subject" class="input" placeholder="Subject name">
    <button class="btn btn-primary w-full mt-8" onclick="StudyModule.saveSubject()">Add Subject</button>`);
  },
  openAddExam(){
    openModal(`<div class="section-title">Add Exam</div>
    <div class="form-group"><label class="form-label">Exam Name</label><input id="m-exam" class="input" placeholder="e.g. Math Final"></div>
    <div class="form-group"><label class="form-label">Date</label><input id="m-examdate" class="input" type="date"></div>
    <button class="btn btn-primary w-full" onclick="StudyModule.saveExam()">Add Exam</button>`);
  },
  saveSubject(){
    const name=document.getElementById('m-subject').value.trim(); if(!name) return;
    const s=Storage.load('subjects',[]); s.push({id:uid(),name,hours:0,sessions:[]});
    Storage.save('subjects',s); closeModal(); this.renderSubjects();
  },
  saveExam(){
    const name=document.getElementById('m-exam').value.trim(),date=document.getElementById('m-examdate').value;
    if(!name||!date) return;
    const e=Storage.load('exams',[]); e.push({id:uid(),name,date}); Storage.save('exams',e);
    closeModal(); this.renderExams();
  },
  logSession(id){
    const h=parseFloat(document.getElementById(`log-h-${id}`)?.value)||0; if(!h) return;
    const s=Storage.load('subjects',[]); const sub=s.find(s=>s.id===id); if(sub) sub.hours=(sub.hours||0)+h;
    Storage.save('subjects',s); this.renderSubjects(); showToast(`📚 Logged ${h}h!`,'success');
  },
  deleteSubject(id){Storage.save('subjects',Storage.load('subjects',[]).filter(s=>s.id!==id));this.renderSubjects();},
  deleteExam(id){Storage.save('exams',Storage.load('exams',[]).filter(e=>e.id!==id));this.renderExams();},
  init(){this.renderSubjects();this.renderExams();}
};

// ══════════════════════════════════════════════════
// MODULE: FINANCE
// ══════════════════════════════════════════════════
const FinanceModule = {
  _tab: 'overview',
  render(){
    return `
    <div class="module-header"><div><div class="module-title">💰 Finance</div></div></div>
    <div class="tabs" id="finance-tabs">
      <div class="tab ${this._tab==='overview'?'active':''}" onclick="FinanceModule.switchTab('overview')">Overview</div>
      <div class="tab ${this._tab==='expenses'?'active':''}" onclick="FinanceModule.switchTab('expenses')">Expenses</div>
      <div class="tab ${this._tab==='income'?'active':''}" onclick="FinanceModule.switchTab('income')">Income</div>
      <div class="tab ${this._tab==='subs'?'active':''}" onclick="FinanceModule.switchTab('subs')">Subscriptions</div>
      <div class="tab ${this._tab==='savings'?'active':''}" onclick="FinanceModule.switchTab('savings')">Savings</div>
    </div>
    <div id="finance-panel"></div>`;
  },
  switchTab(tab){
    this._tab=tab;
    document.querySelectorAll('#finance-tabs .tab').forEach(t=>t.classList.toggle('active',t.textContent.toLowerCase()===tab||t.textContent==='Overview'&&tab==='overview'||(t.textContent.toLowerCase().includes(tab.slice(0,4)))));
    document.querySelectorAll('#finance-tabs .tab').forEach(t=>{
      const map={overview:'Overview',expenses:'Expenses',income:'Income',subs:'Subscriptions',savings:'Savings'};
      t.classList.toggle('active',map[tab]===t.textContent);
    });
    this.renderTab();
  },
  renderTab(){
    const el=document.getElementById('finance-panel'); if(!el) return;
    if(this._tab==='overview') el.innerHTML=this.renderOverview();
    else if(this._tab==='expenses') el.innerHTML=this.renderExpenses();
    else if(this._tab==='income') el.innerHTML=this.renderIncome();
    else if(this._tab==='subs') el.innerHTML=this.renderSubs();
    else if(this._tab==='savings') el.innerHTML=this.renderSavingsGoals();
  },
  renderOverview(){
    const thisMonth=new Date().toISOString().slice(0,7);
    const exp=Storage.load('expenses',[]).filter(e=>e.date.startsWith(thisMonth));
    const inc=Storage.load('income',[]).filter(i=>i.date.startsWith(thisMonth));
    const totalExp=exp.reduce((s,e)=>s+e.amount,0);
    const totalInc=inc.reduce((s,i)=>s+i.amount,0);
    const net=totalInc-totalExp;
    // Category breakdown
    const cats={};
    exp.forEach(e=>{cats[e.category]=(cats[e.category]||0)+e.amount;});
    return `
    <div class="finance-grid">
      <div class="finance-stat positive"><div class="stat-value">$${totalInc.toFixed(2)}</div><div class="stat-label">Income this month</div></div>
      <div class="finance-stat negative"><div class="stat-value">$${totalExp.toFixed(2)}</div><div class="stat-label">Expenses this month</div></div>
      <div class="finance-stat ${net>=0?'positive':'negative'}"><div class="stat-value">$${net.toFixed(2)}</div><div class="stat-label">Net Balance</div></div>
    </div>
    <div class="card">
      <div class="card-title">Expense by Category</div>
      ${Object.keys(cats).length?Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>{
        const pct=Math.round((amt/totalExp)*100);
        return `<div class="mb-8"><div class="flex-between text-sm mb-8"><span>${escHtml(cat)}</span><span class="font-mono">$${amt.toFixed(2)} (${pct}%)</span></div><div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div></div>`;
      }).join(''):'<div class="empty-state">No expenses this month</div>'}
    </div>`;
  },
  renderExpenses(){
    const expenses=Storage.load('expenses',[]).sort((a,b)=>b.date.localeCompare(a.date));
    return `
    <div class="card">
      <div class="flex-between mb-16">
        <div class="card-title">Expenses</div>
        <button class="btn btn-primary btn-sm" onclick="FinanceModule.openAddExpense()">➕ Add</button>
      </div>
      ${expenses.length?`<div class="item-list">${expenses.slice(0,50).map(e=>`
      <div class="list-item">
        <div style="flex:1">
          <div style="font-weight:600">${escHtml(e.description)}</div>
          <div class="text-sm text-muted">${e.date} · ${escHtml(e.category)}</div>
        </div>
        <span class="font-mono text-red">-$${e.amount.toFixed(2)}</span>
        <div class="item-actions"><button class="btn btn-icon btn-ghost btn-danger" onclick="FinanceModule.deleteExpense('${e.id}')">🗑</button></div>
      </div>`).join('')}</div>`:'<div class="empty-state">No expenses logged</div>'}
    </div>`;
  },
  renderIncome(){
    const income=Storage.load('income',[]).sort((a,b)=>b.date.localeCompare(a.date));
    return `
    <div class="card">
      <div class="flex-between mb-16">
        <div class="card-title">Income</div>
        <button class="btn btn-primary btn-sm" onclick="FinanceModule.openAddIncome()">➕ Add</button>
      </div>
      ${income.length?`<div class="item-list">${income.slice(0,50).map(i=>`
      <div class="list-item">
        <div style="flex:1"><div style="font-weight:600">${escHtml(i.source)}</div><div class="text-sm text-muted">${i.date}</div></div>
        <span class="font-mono text-green">+$${i.amount.toFixed(2)}</span>
        <div class="item-actions"><button class="btn btn-icon btn-ghost btn-danger" onclick="FinanceModule.deleteIncome('${i.id}')">🗑</button></div>
      </div>`).join('')}</div>`:'<div class="empty-state">No income logged</div>'}
    </div>`;
  },
  renderSubs(){
    const subs=Storage.load('subscriptions',[]);
    const monthlyTotal=subs.reduce((s,sub)=>{
      if(sub.freq==='monthly') return s+sub.cost;
      if(sub.freq==='yearly') return s+sub.cost/12;
      if(sub.freq==='weekly') return s+sub.cost*4.33;
      return s+sub.cost;
    },0);
    return `
    <div class="card">
      <div class="flex-between mb-16">
        <div class="card-title">Subscriptions — <span class="text-accent font-mono">$${monthlyTotal.toFixed(2)}/mo</span></div>
        <button class="btn btn-primary btn-sm" onclick="FinanceModule.openAddSub()">➕ Add</button>
      </div>
      ${subs.length?`<div class="item-list">${subs.map(s=>`
      <div class="list-item">
        <div style="flex:1"><div style="font-weight:600">${escHtml(s.name)}</div></div>
        <span class="badge badge-amber capitalize">${s.freq}</span>
        <span class="font-mono text-accent">$${s.cost.toFixed(2)}</span>
        <div class="item-actions"><button class="btn btn-icon btn-ghost btn-danger" onclick="FinanceModule.deleteSub('${s.id}')">🗑</button></div>
      </div>`).join('')}</div>`:'<div class="empty-state">No subscriptions</div>'}
    </div>`;
  },
  renderSavingsGoals(){
    const goals=Storage.load('savingsGoals',[]);
    return `
    <div class="card">
      <div class="flex-between mb-16">
        <div class="card-title">Savings Goals</div>
        <button class="btn btn-primary btn-sm" onclick="FinanceModule.openAddSavingsGoal()">➕ Add</button>
      </div>
      ${goals.length?goals.map(g=>{const pct=Math.min(100,Math.round((g.saved/g.target)*100));return`
      <div class="mb-16">
        <div class="flex-between mb-8"><span style="font-weight:600">${escHtml(g.name)}</span><span class="font-mono text-sm">$${g.saved}/$${g.target}</span></div>
        <div class="progress-bar mb-8"><div class="progress-fill ${pct>=100?'green':''}" style="width:${pct}%"></div></div>
        <div class="flex gap-8">
          <input id="sv-add-${g.id}" class="input" type="number" placeholder="Add $" style="width:100px">
          <button class="btn btn-sm btn-secondary" onclick="FinanceModule.addToSavings('${g.id}')">Add</button>
          <button class="btn btn-sm btn-danger" onclick="FinanceModule.deleteSavingsGoal('${g.id}')">Delete</button>
        </div>
      </div>`;}).join(''):'<div class="empty-state">No savings goals</div>'}
    </div>`;
  },
  openAddExpense(){
    openModal(`<div class="section-title">Add Expense</div>
    <div class="form-group"><label class="form-label">Description</label><input id="m-edesc" class="input" placeholder="Coffee, Rent..."></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Amount ($)</label><input id="m-eamt" class="input" type="number" placeholder="0.00" step="0.01"></div>
      <div class="form-group"><label class="form-label">Category</label>
        <select id="m-ecat" class="select"><option>Food</option><option>Transport</option><option>Entertainment</option><option>Health</option><option>Shopping</option><option>Bills</option><option>Other</option></select>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Date</label><input id="m-edate" class="input" type="date" value="${today()}"></div>
    <button class="btn btn-primary w-full" onclick="FinanceModule.saveExpense()">Add Expense</button>`);
  },
  openAddIncome(){
    openModal(`<div class="section-title">Add Income</div>
    <div class="form-group"><label class="form-label">Source</label><input id="m-isrc" class="input" placeholder="Salary, Freelance..."></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Amount ($)</label><input id="m-iamt" class="input" type="number" step="0.01"></div>
      <div class="form-group"><label class="form-label">Date</label><input id="m-idate" class="input" type="date" value="${today()}"></div>
    </div>
    <button class="btn btn-primary w-full" onclick="FinanceModule.saveIncome()">Add Income</button>`);
  },
  openAddSub(){
    openModal(`<div class="section-title">Add Subscription</div>
    <div class="form-group"><label class="form-label">Service</label><input id="m-sname" class="input" placeholder="Netflix, Spotify..."></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Cost ($)</label><input id="m-scost" class="input" type="number" step="0.01"></div>
      <div class="form-group"><label class="form-label">Frequency</label>
        <select id="m-sfreq" class="select"><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="weekly">Weekly</option></select>
      </div>
    </div>
    <button class="btn btn-primary w-full" onclick="FinanceModule.saveSub()">Add</button>`);
  },
  openAddSavingsGoal(){
    openModal(`<div class="section-title">New Savings Goal</div>
    <div class="form-group"><label class="form-label">Goal Name</label><input id="m-sgname" class="input" placeholder="Emergency Fund..."></div>
    <div class="form-group"><label class="form-label">Target ($)</label><input id="m-sgtarget" class="input" type="number" placeholder="1000"></div>
    <button class="btn btn-primary w-full" onclick="FinanceModule.saveSavingsGoal()">Create Goal</button>`);
  },
  saveExpense(){
    const desc=document.getElementById('m-edesc').value.trim(),amt=parseFloat(document.getElementById('m-eamt').value);
    if(!desc||isNaN(amt)) return showToast('Fill all fields','error');
    const expenses=Storage.load('expenses',[]);
    expenses.push({id:uid(),description:desc,amount:amt,category:document.getElementById('m-ecat').value,date:document.getElementById('m-edate').value||today()});
    Storage.save('expenses',expenses); closeModal(); this.renderTab(); showToast('💸 Expense logged!','success');
  },
  saveIncome(){
    const src=document.getElementById('m-isrc').value.trim(),amt=parseFloat(document.getElementById('m-iamt').value);
    if(!src||isNaN(amt)) return showToast('Fill all fields','error');
    const income=Storage.load('income',[]);
    income.push({id:uid(),source:src,amount:amt,date:document.getElementById('m-idate').value||today()});
    Storage.save('income',income); closeModal(); this.renderTab(); showToast('💰 Income logged!','success');
  },
  saveSub(){
    const name=document.getElementById('m-sname').value.trim(),cost=parseFloat(document.getElementById('m-scost').value);
    if(!name||isNaN(cost)) return showToast('Fill all fields','error');
    const subs=Storage.load('subscriptions',[]);
    subs.push({id:uid(),name,cost,freq:document.getElementById('m-sfreq').value});
    Storage.save('subscriptions',subs); closeModal(); this.renderTab();
  },
  saveSavingsGoal(){
    const name=document.getElementById('m-sgname').value.trim(),target=parseFloat(document.getElementById('m-sgtarget').value);
    if(!name||isNaN(target)) return showToast('Fill all fields','error');
    const goals=Storage.load('savingsGoals',[]);
    goals.push({id:uid(),name,target,saved:0});
    Storage.save('savingsGoals',goals); closeModal(); this.renderTab();
  },
  addToSavings(id){
    const goals=Storage.load('savingsGoals',[]);
    const g=goals.find(g=>g.id===id); if(!g) return;
    const add=parseFloat(document.getElementById(`sv-add-${id}`)?.value)||0;
    g.saved=Math.min(g.target,(g.saved||0)+add);
    Storage.save('savingsGoals',goals); this.renderTab();
  },
  deleteExpense(id){Storage.save('expenses',Storage.load('expenses',[]).filter(e=>e.id!==id));this.renderTab();},
  deleteIncome(id){Storage.save('income',Storage.load('income',[]).filter(i=>i.id!==id));this.renderTab();},
  deleteSub(id){Storage.save('subscriptions',Storage.load('subscriptions',[]).filter(s=>s.id!==id));this.renderTab();},
  deleteSavingsGoal(id){Storage.save('savingsGoals',Storage.load('savingsGoals',[]).filter(g=>g.id!==id));this.renderTab();},
  init(){ this._tab='overview'; this.renderTab(); }
};

// ══════════════════════════════════════════════════
// MODULE: HEALTH
// ══════════════════════════════════════════════════
const HealthModule = {
  render(){
    const data=Storage.load('health',{water:0,waterGoal:8,steps:0,sleep:0,workouts:[],challenges:[]});
    const cups=data.water||0, goal=data.waterGoal||8;
    return `
    <div class="module-header"><div><div class="module-title">💪 Health & Lifestyle</div></div></div>
    <div class="health-grid">
      <!-- Water -->
      <div class="card">
        <div class="card-title">💧 Water Intake</div>
        <div class="text-center mb-8"><span class="font-mono" style="font-size:32px;color:var(--blue)">${cups}</span><span class="text-muted">/${goal} cups</span></div>
        <div class="progress-bar mb-8"><div class="progress-fill blue" style="width:${Math.min(100,(cups/goal)*100)}%"></div></div>
        <div id="water-cups" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px"></div>
        <div class="flex gap-8">
          <button class="btn btn-secondary btn-sm" onclick="HealthModule.addWater()">+ Cup</button>
          <button class="btn btn-ghost btn-sm" onclick="HealthModule.resetWater()">Reset</button>
          <input id="water-goal-in" class="input btn-sm" type="number" value="${goal}" style="width:60px" placeholder="Goal">
          <button class="btn btn-ghost btn-sm" onclick="HealthModule.setWaterGoal()">Set</button>
        </div>
      </div>
      <!-- Steps -->
      <div class="card">
        <div class="card-title">🚶 Step Tracker</div>
        <div class="font-mono text-accent" style="font-size:36px;text-align:center">${data.steps||0}</div>
        <div class="text-muted text-center text-sm mb-8">steps today</div>
        <div class="input-group">
          <input id="step-in" class="input" type="number" placeholder="Add steps">
          <button class="btn btn-primary btn-sm" onclick="HealthModule.addSteps()">Add</button>
        </div>
        <button class="btn btn-ghost btn-sm w-full mt-8" onclick="HealthModule.resetSteps()">Reset Today</button>
      </div>
      <!-- Sleep -->
      <div class="card">
        <div class="card-title">🌙 Sleep Tracker</div>
        <div class="font-mono text-accent" style="font-size:36px;text-align:center">${data.sleep||0}h</div>
        <div class="text-muted text-center text-sm mb-8">last night</div>
        <div class="input-group">
          <input id="sleep-in" class="input" type="number" placeholder="Hours slept" step="0.5">
          <button class="btn btn-primary btn-sm" onclick="HealthModule.logSleep()">Log</button>
        </div>
      </div>
    </div>
    <!-- Meditation Timer -->
    <div class="card mt-8">
      <div class="card-title">🧘 Meditation Timer</div>
      <div class="flex gap-8 mb-8">
        ${[5,10,15,20,30].map(m=>`<button class="btn btn-secondary btn-sm" onclick="HealthModule.startMeditation(${m})">${m} min</button>`).join('')}
      </div>
      <div id="med-display" class="timer-display" style="font-size:40px">00:00</div>
      <div class="timer-controls">
        <button id="med-pause" class="btn btn-secondary hidden">⏸ Pause</button>
        <button id="med-stop" class="btn btn-danger hidden" onclick="HealthModule.stopMeditation()">■ Stop</button>
      </div>
    </div>
    <!-- Workout Logger -->
    <div class="card mt-8">
      <div class="card-title">🏋️ Workout Logger</div>
      <div class="input-group">
        <input id="wo-type" class="input" placeholder="Type (Running, Gym...)">
        <input id="wo-dur" class="input" type="number" placeholder="Minutes" style="width:100px">
        <button class="btn btn-primary btn-sm" onclick="HealthModule.logWorkout()">Log</button>
      </div>
      <div id="workout-list" class="item-list mt-8"></div>
    </div>
    <!-- 30-day Challenge -->
    <div class="card mt-8">
      <div class="card-title">🏆 30-Day Challenge</div>
      <div class="flex gap-8 mb-8">
        <input id="challenge-name" class="input" placeholder="Challenge name">
        <button class="btn btn-primary btn-sm" onclick="HealthModule.addChallenge()">Start</button>
      </div>
      <div id="challenge-list"></div>
    </div>`;
  },
  renderWaterCups(){
    const data=Storage.load('health',{water:0,waterGoal:8});
    const el=document.getElementById('water-cups'); if(!el) return;
    el.innerHTML=Array.from({length:data.waterGoal||8}).map((_,i)=>`<div class="water-cup ${i<data.water?'filled':''}">💧</div>`).join('');
  },
  renderWorkouts(){
    const data=Storage.load('health',{workouts:[]});
    const el=document.getElementById('workout-list'); if(!el) return;
    const ws=data.workouts||[];
    if(!ws.length){el.innerHTML='<div class="text-muted text-sm">No workouts logged</div>';return;}
    el.innerHTML=ws.slice(-5).reverse().map(w=>`
    <div class="list-item">
      <span>🏋️</span><div style="flex:1"><div style="font-weight:600">${escHtml(w.type)}</div><div class="text-sm text-muted">${w.date}</div></div>
      <span class="font-mono">${w.duration} min</span>
    </div>`).join('');
  },
  renderChallenges(){
    const data=Storage.load('health',{challenges:[]});
    const el=document.getElementById('challenge-list'); if(!el) return;
    const cs=data.challenges||[];
    if(!cs.length){el.innerHTML='<div class="text-muted text-sm">No challenges started</div>';return;}
    el.innerHTML=cs.map(c=>{
      const done=(c.days||[]).filter(Boolean).length;
      return `<div class="mb-12">
        <div class="flex-between mb-8"><span style="font-weight:600">${escHtml(c.name)}</span><span class="text-sm text-muted">${done}/30 days</span></div>
        <div style="display:flex;flex-wrap:wrap;gap:3px">${Array.from({length:30}).map((_,i)=>`<div style="width:22px;height:22px;border-radius:3px;cursor:pointer;background:${(c.days||[])[i]?'var(--accent)':'var(--surface3)'};border:1px solid var(--border)" onclick="HealthModule.toggleChallenge('${c.id}',${i})"></div>`).join('')}</div>
      </div>`;
    }).join('');
  },
  _medInterval: null,
  _medSec: 0,
  startMeditation(min){
    clearInterval(this._medInterval);
    this._medSec=min*60;
    const disp=document.getElementById('med-display');
    document.getElementById('med-pause').classList.remove('hidden');
    document.getElementById('med-stop').classList.remove('hidden');
    let paused=false;
    document.getElementById('med-pause').onclick=()=>{paused=!paused;document.getElementById('med-pause').textContent=paused?'▶ Resume':'⏸ Pause';};
    this._medInterval=setInterval(()=>{
      if(paused) return;
      this._medSec--;
      const m=Math.floor(this._medSec/60),s=this._medSec%60;
      if(disp) disp.textContent=`${pad(m)}:${pad(s)}`;
      if(this._medSec<=0){clearInterval(this._medInterval);showToast('🧘 Meditation complete!','success');}
    },1000);
  },
  stopMeditation(){
    clearInterval(this._medInterval);
    const disp=document.getElementById('med-display'); if(disp) disp.textContent='00:00';
    document.getElementById('med-pause').classList.add('hidden');
    document.getElementById('med-stop').classList.add('hidden');
  },
  addWater(){
    const data=Storage.load('health',{water:0,waterGoal:8,steps:0,sleep:0,workouts:[],challenges:[]});
    data.water=Math.min(data.waterGoal,(data.water||0)+1);
    Storage.save('health',data); this.renderWaterCups();
    const el=document.querySelector('.font-mono[style*="32px"]'); if(el) el.textContent=data.water;
  },
  resetWater(){
    const data=Storage.load('health',{water:0,waterGoal:8});
    data.water=0; Storage.save('health',data); this.renderWaterCups();
    const el=document.querySelector('.font-mono[style*="32px"]'); if(el) el.textContent='0';
  },
  setWaterGoal(){
    const data=Storage.load('health',{water:0,waterGoal:8});
    data.waterGoal=parseInt(document.getElementById('water-goal-in')?.value)||8;
    Storage.save('health',data); this.renderWaterCups();
  },
  addSteps(){
    const s=parseInt(document.getElementById('step-in')?.value)||0;
    const data=Storage.load('health',{steps:0}); data.steps=(data.steps||0)+s;
    Storage.save('health',data);
    const el=document.querySelector('.font-mono[style*="36px"]'); if(el) el.textContent=data.steps;
  },
  resetSteps(){
    const data=Storage.load('health',{steps:0}); data.steps=0; Storage.save('health',data);
    const el=document.querySelector('.font-mono[style*="36px"]'); if(el) el.textContent='0';
  },
  logSleep(){
    const h=parseFloat(document.getElementById('sleep-in')?.value)||0;
    const data=Storage.load('health',{sleep:0}); data.sleep=h; Storage.save('health',data);
    showToast(`🌙 Logged ${h}h sleep`,'success');
  },
  logWorkout(){
    const type=document.getElementById('wo-type')?.value.trim();
    const dur=parseInt(document.getElementById('wo-dur')?.value)||0;
    if(!type||!dur) return;
    const data=Storage.load('health',{workouts:[]});
    if(!data.workouts) data.workouts=[];
    data.workouts.push({id:uid(),type,duration:dur,date:today()});
    Storage.save('health',data); this.renderWorkouts();
    showToast('🏋️ Workout logged!','success');
  },
  addChallenge(){
    const name=document.getElementById('challenge-name')?.value.trim(); if(!name) return;
    const data=Storage.load('health',{challenges:[]});
    if(!data.challenges) data.challenges=[];
    data.challenges.push({id:uid(),name,days:Array(30).fill(false)});
    Storage.save('health',data); this.renderChallenges();
  },
  toggleChallenge(id,day){
    const data=Storage.load('health',{challenges:[]});
    const c=data.challenges?.find(c=>c.id===id); if(c){c.days[day]=!c.days[day];}
    Storage.save('health',data); this.renderChallenges();
  },
  init(){this.renderWaterCups();this.renderWorkouts();this.renderChallenges();}
};

// ══════════════════════════════════════════════════
// MODULE: GAMES & ENTERTAINMENT
// ══════════════════════════════════════════════════
const GamesModule = {
  _tab: 'ttt',
  render(){
    return `
    <div class="module-header"><div><div class="module-title">🎮 Games & Entertainment</div></div></div>
    <div class="tabs">
      <div class="tab active" onclick="GamesModule.switchTab('ttt',this)">Tic Tac Toe</div>
      <div class="tab" onclick="GamesModule.switchTab('react',this)">Reaction Test</div>
      <div class="tab" onclick="GamesModule.switchTab('type',this)">Typing Speed</div>
      <div class="tab" onclick="GamesModule.switchTab('dice',this)">Dice & Coin</div>
      <div class="tab" onclick="GamesModule.switchTab('clicker',this)">Clicker</div>
      <div class="tab" onclick="GamesModule.switchTab('quote',this)">Quotes</div>
    </div>
    <div id="game-panel"></div>`;
  },
  switchTab(tab,el){
    document.querySelectorAll('.tabs .tab').forEach(t=>t.classList.remove('active'));
    if(el) el.classList.add('active');
    this._tab=tab; this.renderGame();
  },
  renderGame(){
    const el=document.getElementById('game-panel'); if(!el) return;
    if(this._tab==='ttt') el.innerHTML=this.tttRender();
    else if(this._tab==='react') el.innerHTML=this.reactRender();
    else if(this._tab==='type') el.innerHTML=this.typeRender();
    else if(this._tab==='dice') el.innerHTML=this.diceRender();
    else if(this._tab==='clicker') el.innerHTML=this.clickerRender();
    else if(this._tab==='quote') el.innerHTML=this.quoteRender();
    if(this._tab==='ttt') this.tttInit();
    if(this._tab==='react') this.reactInit();
    if(this._tab==='type') this.typeInit();
    if(this._tab==='clicker') this.clickerInit();
    if(this._tab==='quote') this.quoteNext();
  },

  // ─── Tic Tac Toe ────────────────────────────
  _tttBoard: Array(9).fill(''),
  _tttTurn: 'X',
  tttRender(){
    return `<div class="card text-center">
      <div id="ttt-status" class="text-accent font-mono mb-8">Player X's turn</div>
      <div class="ttt-grid" id="ttt-board">
        ${Array(9).fill('').map((_,i)=>`<div class="ttt-cell" data-i="${i}"></div>`).join('')}
      </div>
      <button class="btn btn-secondary mt-16" onclick="GamesModule.tttReset()">New Game</button>
    </div>`;
  },
  tttInit(){
    this._tttBoard=Array(9).fill(''); this._tttTurn='X';
    document.getElementById('ttt-board').addEventListener('click',e=>{
      const cell=e.target.closest('.ttt-cell'); if(!cell) return;
      const i=parseInt(cell.dataset.i);
      if(this._tttBoard[i]) return;
      this._tttBoard[i]=this._tttTurn;
      cell.textContent=this._tttTurn;
      cell.classList.add(this._tttTurn.toLowerCase());
      const winner=this.tttCheck();
      const status=document.getElementById('ttt-status');
      if(winner){status.textContent=`Player ${winner} wins! 🎉`;return;}
      if(!this._tttBoard.includes('')){status.textContent='Draw! 🤝';return;}
      this._tttTurn=this._tttTurn==='X'?'O':'X';
      status.textContent=`Player ${this._tttTurn}'s turn`;
    });
  },
  tttCheck(){
    const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for(const [a,b,c] of wins) if(this._tttBoard[a]&&this._tttBoard[a]===this._tttBoard[b]&&this._tttBoard[b]===this._tttBoard[c]) return this._tttBoard[a];
    return null;
  },
  tttReset(){this.tttRender(); this.tttInit(); document.getElementById('ttt-board').outerHTML; this.renderGame();},

  // ─── Reaction Test ──────────────────────────
  _reactState: 'wait',
  _reactStart: 0,
  _reactTimeout: null,
  reactRender(){
    return `<div class="card text-center">
      <div id="react-box" style="width:100%;height:200px;border-radius:var(--radius);background:var(--surface2);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;font-weight:600;transition:background 0.15s" onclick="GamesModule.reactClick()">
        Click to start
      </div>
      <div id="react-result" class="font-mono text-accent mt-16" style="font-size:20px"></div>
      <div id="react-best" class="text-muted text-sm mt-8"></div>
    </div>`;
  },
  reactInit(){this._reactState='wait';},
  reactClick(){
    const box=document.getElementById('react-box');
    const res=document.getElementById('react-result');
    if(this._reactState==='wait'){
      box.style.background='var(--red)'; box.textContent='Wait for green...';
      this._reactState='waiting';
      const delay=1500+Math.random()*3000;
      this._reactTimeout=setTimeout(()=>{
        box.style.background='var(--green)'; box.textContent='CLICK NOW!';
        this._reactState='ready'; this._reactStart=Date.now();
      },delay);
    } else if(this._reactState==='waiting'){
      clearTimeout(this._reactTimeout);
      box.style.background='var(--surface2)'; box.textContent='Too early! Click to try again.';
      this._reactState='wait'; res.textContent='';
    } else if(this._reactState==='ready'){
      const ms=Date.now()-this._reactStart;
      const best=Math.min(ms,Storage.load('reactionBest',9999));
      Storage.save('reactionBest',best);
      box.style.background='var(--surface2)'; box.textContent='Click to try again';
      res.textContent=`${ms}ms`;
      document.getElementById('react-best').textContent=`Best: ${best}ms`;
      this._reactState='wait';
    }
  },

  // ─── Typing Speed ───────────────────────────
  _typeStart:0, _typeRunning:false,
  _typeSentences:['The quick brown fox jumps over the lazy dog','Pack my box with five dozen liquor jugs','How vexingly quick daft zebras jump','The five boxing wizards jump quickly','Sphinx of black quartz, judge my vow'],
  typeRender(){
    const s=this._typeSentences[Math.floor(Math.random()*this._typeSentences.length)];
    return `<div class="card">
      <div class="card-title">Typing Speed Test</div>
      <div id="type-target" class="font-mono mb-8" style="font-size:16px;padding:12px;background:var(--surface3);border-radius:var(--radius-sm);line-height:1.8">${escHtml(s)}</div>
      <input id="type-input" class="input mb-8" placeholder="Start typing..." oninput="GamesModule.typeCheck()">
      <div class="flex gap-12">
        <div class="stat-card"><div class="stat-value" id="type-wpm">0</div><div class="stat-label">WPM</div></div>
        <div class="stat-card"><div class="stat-value" id="type-acc">100%</div><div class="stat-label">Accuracy</div></div>
        <div class="stat-card"><div class="stat-value" id="type-time">0s</div><div class="stat-label">Time</div></div>
      </div>
      <button class="btn btn-secondary mt-8" onclick="GamesModule.typeReset()">Reset</button>
    </div>`;
  },
  typeInit(){this._typeRunning=false;this._typeStart=0;},
  typeCheck(){
    const inp=document.getElementById('type-input');
    const target=document.getElementById('type-target').textContent;
    const val=inp.value;
    if(!this._typeRunning&&val.length>0){this._typeRunning=true;this._typeStart=Date.now();}
    const elapsed=(Date.now()-this._typeStart)/60000;
    const words=val.trim().split(/\s+/).length;
    const wpm=elapsed>0?Math.round(words/elapsed):0;
    let correct=0;
    for(let i=0;i<val.length;i++) if(val[i]===target[i]) correct++;
    const acc=val.length?Math.round((correct/val.length)*100):100;
    document.getElementById('type-wpm').textContent=wpm;
    document.getElementById('type-acc').textContent=acc+'%';
    document.getElementById('type-time').textContent=Math.floor((Date.now()-this._typeStart)/1000)+'s';
    if(val===target){showToast(`🎉 Done! ${wpm} WPM, ${acc}% accuracy`,'success');}
  },
  typeReset(){this.renderGame();},

  // ─── Dice & Coin ────────────────────────────
  diceRender(){
    return `<div class="card text-center">
      <div id="dice-result" style="font-size:80px;margin:20px 0">🎲</div>
      <div class="flex gap-8" style="justify-content:center;flex-wrap:wrap">
        ${[4,6,8,10,12,20].map(d=>`<button class="btn btn-secondary" onclick="GamesModule.rollDice(${d})">d${d}</button>`).join('')}
        <button class="btn btn-primary" onclick="GamesModule.flipCoin()">🪙 Flip Coin</button>
      </div>
      <div id="dice-history" class="mt-16 text-muted text-sm"></div>
    </div>`;
  },
  _diceHist:[],
  rollDice(sides){
    const r=Math.floor(Math.random()*sides)+1;
    document.getElementById('dice-result').textContent=r;
    this._diceHist.unshift(`d${sides}: ${r}`);
    document.getElementById('dice-history').textContent=this._diceHist.slice(0,5).join(' · ');
  },
  flipCoin(){
    const r=Math.random()>0.5?'Heads 🪙':'Tails 🪙';
    document.getElementById('dice-result').textContent=Math.random()>0.5?'🟡':'⚪';
    this._diceHist.unshift(r);
    document.getElementById('dice-history').textContent=this._diceHist.slice(0,5).join(' · ');
  },

  // ─── Idle Clicker ───────────────────────────
  _clicks:0, _cps:0, _autoInterval:null,
  clickerRender(){
    const data=Storage.load('clicker',{points:0,upgrades:{auto:0,multiplier:1}});
    return `<div class="card text-center">
      <div id="clicker-pts" class="font-mono" style="font-size:40px;color:var(--accent)">${data.points}</div>
      <div class="text-muted mb-16">points</div>
      <div id="click-btn" style="width:120px;height:120px;border-radius:50%;background:var(--accent);margin:0 auto 20px;display:flex;align-items:center;justify-content:center;font-size:40px;cursor:pointer;transition:transform 0.05s;user-select:none" onclick="GamesModule.doClick()" onmousedown="this.style.transform='scale(0.92)'" onmouseup="this.style.transform='scale(1)'">⭐</div>
      <div class="flex gap-8" style="justify-content:center">
        <button class="btn btn-secondary" onclick="GamesModule.buyUpgrade('auto')">🤖 Auto-click (${data.upgrades.auto}) — ${Math.pow(2,data.upgrades.auto)*10} pts</button>
        <button class="btn btn-secondary" onclick="GamesModule.buyUpgrade('multiplier')">✖️ Multiplier (${data.upgrades.multiplier}x) — ${data.upgrades.multiplier*50} pts</button>
      </div>
    </div>`;
  },
  clickerInit(){
    clearInterval(this._autoInterval);
    const tick=()=>{
      const data=Storage.load('clicker',{points:0,upgrades:{auto:0,multiplier:1}});
      if(data.upgrades.auto>0){
        data.points+=data.upgrades.auto*data.upgrades.multiplier;
        Storage.save('clicker',data);
        const el=document.getElementById('clicker-pts'); if(el) el.textContent=data.points;
      }
    };
    this._autoInterval=setInterval(tick,1000);
  },
  doClick(){
    const data=Storage.load('clicker',{points:0,upgrades:{auto:0,multiplier:1}});
    data.points+=data.upgrades.multiplier||1;
    Storage.save('clicker',data);
    const el=document.getElementById('clicker-pts'); if(el) el.textContent=data.points;
  },
  buyUpgrade(type){
    const data=Storage.load('clicker',{points:0,upgrades:{auto:0,multiplier:1}});
    if(type==='auto'){const cost=Math.pow(2,data.upgrades.auto)*10;if(data.points<cost)return showToast('Not enough points!','error');data.points-=cost;data.upgrades.auto++;} 
    else if(type==='multiplier'){const cost=data.upgrades.multiplier*50;if(data.points<cost)return showToast('Not enough points!','error');data.points-=cost;data.upgrades.multiplier++;}
    Storage.save('clicker',data); this.renderGame();
  },

  // ─── Quotes ─────────────────────────────────
  _quotes:[
    "The only way to do great work is to love what you do. — Steve Jobs",
    "In the middle of every difficulty lies opportunity. — Albert Einstein",
    "It does not matter how slowly you go as long as you do not stop. — Confucius",
    "Success is not final, failure is not fatal: it is the courage to continue that counts. — Churchill",
    "You miss 100% of the shots you don't take. — Wayne Gretzky",
    "The future belongs to those who believe in the beauty of their dreams. — Eleanor Roosevelt",
    "Believe you can and you're halfway there. — Theodore Roosevelt",
    "Whether you think you can or think you can't, you're right. — Henry Ford",
    "Strive not to be a success, but rather to be of value. — Albert Einstein",
    "The mind is everything. What you think you become. — Buddha",
    "Happiness is not something ready made. It comes from your own actions. — Dalai Lama",
    "Life is what happens to you while you're busy making other plans. — John Lennon",
    "The best time to plant a tree was 20 years ago. The second best time is now. — Chinese Proverb",
  ],
  quoteRender(){
    return `<div class="card text-center">
      <div id="quote-text" style="font-size:18px;line-height:1.7;font-style:italic;padding:20px 0;color:var(--text)"></div>
      <button class="btn btn-primary mt-8" onclick="GamesModule.quoteNext()">Next Quote ↻</button>
    </div>`;
  },
  quoteNext(){
    const el=document.getElementById('quote-text'); if(!el) return;
    const q=this._quotes[Math.floor(Math.random()*this._quotes.length)];
    el.textContent=`"${q}"`;
  },

  init(){ this.renderGame(); }
};

// ══════════════════════════════════════════════════
// MODULE: ANALYTICS
// ══════════════════════════════════════════════════
const AnalyticsModule = {
  render(){
    const todos=Storage.load('todos',[]);
    const habits=Storage.load('habits',[]);
    const expenses=Storage.load('expenses',[]);
    const income=Storage.load('income',[]);
    const subjects=Storage.load('subjects',[]);
    const notes=Storage.load('notes',[]);
    const done=todos.filter(t=>t.done).length;
    const thisMonth=new Date().toISOString().slice(0,7);
    const monthExp=expenses.filter(e=>e.date.startsWith(thisMonth)).reduce((s,e)=>s+e.amount,0);
    const monthInc=income.filter(i=>i.date.startsWith(thisMonth)).reduce((s,i)=>s+i.amount,0);
    const totalStudy=subjects.reduce((s,sub)=>s+(sub.hours||0),0);
    const bestStreak=habits.reduce((m,h)=>Math.max(m,h.streak||0),0);
    const completionRate=todos.length?Math.round((done/todos.length)*100):0;

    // Category spending breakdown
    const cats={};
    expenses.filter(e=>e.date.startsWith(thisMonth)).forEach(e=>{cats[e.category]=(cats[e.category]||0)+e.amount;});

    return `
    <div class="module-header"><div><div class="module-title">📊 Analytics Dashboard</div></div></div>
    <div class="dash-grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
      <div class="stat-card"><div class="stat-value">${todos.length}</div><div class="stat-label">Total Tasks</div></div>
      <div class="stat-card"><div class="stat-value text-green">${done}</div><div class="stat-label">Completed</div></div>
      <div class="stat-card"><div class="stat-value">${completionRate}%</div><div class="stat-label">Completion Rate</div></div>
      <div class="stat-card"><div class="stat-value">${habits.length}</div><div class="stat-label">Active Habits</div></div>
      <div class="stat-card"><div class="stat-value text-accent">${bestStreak}</div><div class="stat-label">Best Streak</div></div>
      <div class="stat-card"><div class="stat-value">${notes.length}</div><div class="stat-label">Notes</div></div>
      <div class="stat-card"><div class="stat-value text-green">$${monthInc.toFixed(0)}</div><div class="stat-label">Income (mo)</div></div>
      <div class="stat-card"><div class="stat-value text-red">$${monthExp.toFixed(0)}</div><div class="stat-label">Expenses (mo)</div></div>
      <div class="stat-card"><div class="stat-value ${monthInc-monthExp>=0?'text-green':'text-red'}">$${(monthInc-monthExp).toFixed(0)}</div><div class="stat-label">Net Balance</div></div>
      <div class="stat-card"><div class="stat-value">${totalStudy.toFixed(1)}h</div><div class="stat-label">Study Hours</div></div>
    </div>

    <!-- Task completion bar -->
    <div class="card">
      <div class="card-title">Task Completion</div>
      <div class="flex-between text-sm mb-8"><span>${done} done</span><span>${todos.length-done} remaining</span></div>
      <div class="progress-bar" style="height:12px"><div class="progress-fill green" style="width:${completionRate}%"></div></div>
      <div class="text-center text-sm text-muted mt-8">${completionRate}% complete</div>
    </div>

    <!-- Spending by category -->
    <div class="card">
      <div class="card-title">Spending This Month by Category</div>
      ${monthExp>0?Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>{
        const pct=Math.round((amt/monthExp)*100);
        const colors=['var(--accent)','var(--indigo)','var(--green)','var(--blue)','var(--pink)','var(--purple)'];
        const color=colors[Object.keys(cats).indexOf(cat)%colors.length];
        return `<div class="mb-10">
          <div class="flex-between text-sm mb-4"><span>${escHtml(cat)}</span><span class="font-mono">$${amt.toFixed(2)} (${pct}%)</span></div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>
        </div>`;
      }).join(''):'<div class="empty-state">No spending data this month</div>'}
    </div>

    <!-- Habits overview -->
    <div class="card">
      <div class="card-title">Habit Streaks</div>
      ${habits.length?habits.map(h=>`
      <div class="flex-between mb-8">
        <span>${escHtml(h.name)}</span>
        <span class="font-mono text-accent">🔥 ${h.streak||0} days</span>
      </div>`).join(''):'<div class="empty-state">No habits tracked</div>'}
    </div>

    <!-- Study breakdown -->
    <div class="card">
      <div class="card-title">Study Hours by Subject</div>
      ${subjects.length?subjects.map(s=>{
        const pct=totalStudy?Math.round(((s.hours||0)/totalStudy)*100):0;
        return `<div class="mb-8">
          <div class="flex-between text-sm mb-4"><span>${escHtml(s.name)}</span><span class="font-mono">${(s.hours||0).toFixed(1)}h</span></div>
          <div class="progress-bar"><div class="progress-fill blue" style="width:${pct}%"></div></div>
        </div>`;
      }).join(''):'<div class="empty-state">No study sessions logged</div>'}
    </div>`;
  },
  init(){}
};

// ══════════════════════════════════════════════════
// MODULE: UTILITIES
// ══════════════════════════════════════════════════
const UtilitiesModule = {
  _tab: 'calc',
  render(){
    return `
    <div class="module-header"><div><div class="module-title">🔧 Utilities & Tools</div></div></div>
    <div class="tabs" id="util-tabs">
      <div class="tab active" onclick="UtilitiesModule.switchTab('calc',this)">Calculator</div>
      <div class="tab" onclick="UtilitiesModule.switchTab('convert',this)">Unit Convert</div>
      <div class="tab" onclick="UtilitiesModule.switchTab('currency',this)">Currency</div>
      <div class="tab" onclick="UtilitiesModule.switchTab('password',this)">Password Gen</div>
      <div class="tab" onclick="UtilitiesModule.switchTab('text',this)">Text Tools</div>
      <div class="tab" onclick="UtilitiesModule.switchTab('color',this)">Colors</div>
      <div class="tab" onclick="UtilitiesModule.switchTab('qr',this)">QR Code</div>
      <div class="tab" onclick="UtilitiesModule.switchTab('random',this)">Random Picker</div>
    </div>
    <div id="util-panel"></div>`;
  },
  switchTab(tab,el){
    document.querySelectorAll('#util-tabs .tab').forEach(t=>t.classList.remove('active'));
    if(el) el.classList.add('active');
    this._tab=tab; this.renderTab();
  },
  renderTab(){
    const el=document.getElementById('util-panel'); if(!el) return;
    const tabs={
      calc: this.renderCalc.bind(this),
      convert: this.renderConvert.bind(this),
      currency: this.renderCurrency.bind(this),
      password: this.renderPassword.bind(this),
      text: this.renderText.bind(this),
      color: this.renderColor.bind(this),
      qr: this.renderQR.bind(this),
      random: this.renderRandom.bind(this),
    };
    el.innerHTML=(tabs[this._tab]||(() => ''))();
    if(this._tab==='calc') this.initCalc();
    if(this._tab==='color') this.initColor();
  },

  // ─── Calculator ─────────────────────────────
  _calcExpr: '',
  renderCalc(){
    return `<div class="card" style="max-width:360px;margin:0 auto">
      <div id="calc-display" style="background:var(--surface3);border-radius:var(--radius-sm);padding:16px;font-family:var(--mono);font-size:24px;text-align:right;min-height:60px;word-break:break-all;margin-bottom:8px">0</div>
      <div id="calc-expr" style="text-align:right;font-family:var(--mono);font-size:12px;color:var(--text2);margin-bottom:12px;min-height:18px"></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">
        ${['C','+/-','%','/','7','8','9','*','4','5','6','-','1','2','3','+','0','.','DEL','='].map(b=>`<button class="btn ${['='].includes(b)?'btn-primary':b==='C'?'btn-danger':'btn-secondary'}" style="font-size:15px;padding:12px" onclick="UtilitiesModule.calcBtn('${b}')">${b}</button>`).join('')}
      </div>
      <div class="divider"></div>
      <div class="section-title">Scientific</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${['sin','cos','tan','√','x²','xʸ','log','ln','π','e','(',')',].map(b=>`<button class="btn btn-secondary btn-sm" onclick="UtilitiesModule.calcSci('${b}')">${b}</button>`).join('')}
      </div>
    </div>`;
  },
  _calcVal: '0', _calcPrev: '', _calcOp: '', _calcNew: true,
  initCalc(){},
  calcBtn(b){
    const disp=()=>{const el=document.getElementById('calc-display');if(el)el.textContent=this._calcVal;};
    const exprUpd=(v)=>{const el=document.getElementById('calc-expr');if(el)el.textContent=v;};
    if(b==='C'){this._calcVal='0';this._calcPrev='';this._calcOp='';this._calcNew=true;exprUpd('');disp();return;}
    if(b==='DEL'){this._calcVal=this._calcVal.length>1?this._calcVal.slice(0,-1):'0';disp();return;}
    if(b==='+/-'){this._calcVal=String(-parseFloat(this._calcVal));disp();return;}
    if(b==='%'){this._calcVal=String(parseFloat(this._calcVal)/100);disp();return;}
    if(['div','mul','sub','+'].includes(b)){
      this._calcPrev=this._calcVal;
      const opMap={'div':'/','mul':'*','sub':'-','+':'+'};this._calcOp=opMap[b]||b;
      this._calcNew=true;exprUpd(this._calcPrev+' '+b);return;
    }
    if(b==='='){
      if(!this._calcOp) return;
      try{
        const r=eval(`${parseFloat(this._calcPrev)} ${this._calcOp} ${parseFloat(this._calcVal)}`);
        exprUpd(`${this._calcPrev} ${this._calcOp} ${this._calcVal} =`);
        this._calcVal=String(Math.round(r*1e10)/1e10);
        this._calcOp='';this._calcNew=true;disp();
      }catch{this._calcVal='Error';disp();}
      return;
    }
    if(b==='.'){
      if(this._calcNew){this._calcVal='0.';this._calcNew=false;}
      else if(!this._calcVal.includes('.')) this._calcVal+='.';
      disp();return;
    }
    if(this._calcNew){this._calcVal=b;this._calcNew=false;}
    else this._calcVal=this._calcVal==='0'?b:this._calcVal+b;
    disp();
  },
  calcSci(b){
    const v=parseFloat(this._calcVal);
    const map={sin:Math.sin(v*(Math.PI/180)),cos:Math.cos(v*(Math.PI/180)),tan:Math.tan(v*(Math.PI/180)),'√':Math.sqrt(v),'x²':v*v,log:Math.log10(v),ln:Math.log(v),'π':Math.PI,e:Math.E};
    if(b==='xʸ'){this._calcPrev=this._calcVal;this._calcOp='**';this._calcNew=true;return;}
    if(b==='('||b===')') return;
    if(map[b]!==undefined) this._calcVal=String(Math.round(map[b]*1e10)/1e10);
    const el=document.getElementById('calc-display'); if(el) el.textContent=this._calcVal;
  },

  // ─── Unit Converter ─────────────────────────
  renderConvert(){
    return `<div class="card">
      <div class="form-row">
        <div><label class="form-label">Category</label>
          <select id="uc-type" class="select" onchange="UtilitiesModule.ucConvert()">
            <option value="length">Length</option><option value="weight">Weight</option><option value="temp">Temperature</option><option value="area">Area</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div><label class="form-label">Value</label><input id="uc-val" class="input" type="number" placeholder="0" oninput="UtilitiesModule.ucConvert()"></div>
        <div><label class="form-label">From</label><select id="uc-from" class="select" onchange="UtilitiesModule.ucConvert()"></select></div>
        <div><label class="form-label">To</label><select id="uc-to" class="select" onchange="UtilitiesModule.ucConvert()"></select></div>
      </div>
      <div id="uc-result" class="font-mono" style="font-size:28px;color:var(--accent);text-align:center;padding:20px"></div>
    </div>`;
  },
  _ucUnits:{
    length:{m:1,km:0.001,cm:100,mm:1000,mi:0.000621371,yd:1.09361,ft:3.28084,inch:39.3701},
    weight:{kg:1,g:1000,lb:2.20462,oz:35.274,mg:1e6,t:0.001},
    area:{m2:1,km2:1e-6,cm2:1e4,ft2:10.7639,yd2:1.19599,acre:0.000247105,ha:0.0001},
  },
  ucConvert(){
    const type=document.getElementById('uc-type')?.value||'length';
    const fromSel=document.getElementById('uc-from');
    const toSel=document.getElementById('uc-to');
    if(!fromSel||!toSel) return;
    
    // Preserve current selections before updating
    const prevFrom=fromSel.value;
    const prevTo=toSel.value;
    
    // Update only the options, not the entire select element
    let unitList=[];
    if(type==='temp'){
      unitList=['C','F','K'];
    } else {
      unitList=Object.keys(this._ucUnits[type]||{});
    }
    
    fromSel.innerHTML=unitList.map(u=>`<option value="${u}">${u}</option>`).join('');
    toSel.innerHTML=unitList.map(u=>`<option value="${u}">${u}</option>`).join('');
    
    // Restore previous selections if they still exist, otherwise use first option
    if(unitList.includes(prevFrom)) fromSel.value=prevFrom;
    if(unitList.includes(prevTo)) toSel.value=prevTo;
    
    const val=parseFloat(document.getElementById('uc-val')?.value)||0;
    const from=fromSel.value, to=toSel.value;
    let result;
    if(type==='temp'){
      let c=from==='C'?val:from==='F'?(val-32)*5/9:val-273.15;
      result=to==='C'?c:to==='F'?c*9/5+32:c+273.15;
    } else {
      const units=this._ucUnits[type];
      result=(val/units[from])*units[to];
    }
    const el=document.getElementById('uc-result');
    if(el) el.textContent=`${val} ${from} = ${Math.round(result*1e6)/1e6} ${to}`;
  },

  // ─── Currency ───────────────────────────────
  renderCurrency(){
    const rates={USD:1,EUR:0.92,GBP:0.79,JPY:149.5,CAD:1.36,AUD:1.52,INR:83.1,CNY:7.24,BRL:4.97,MXN:17.1,CHF:0.88,SGD:1.34,HKD:7.82,SEK:10.3,NOK:10.4,DKK:6.88,ZAR:18.7,AED:3.67,SAR:3.75,NZD:1.63};
    const options=Object.keys(rates).map(c=>`<option>${c}</option>`).join('');
    return `<div class="card">
      <div class="text-muted text-sm mb-16">ℹ️ Fixed rates (offline, approximate)</div>
      <div class="form-row">
        <div><label class="form-label">Amount</label><input id="cc-amt" class="input" type="number" value="1" oninput="UtilitiesModule.ccConvert()"></div>
        <div><label class="form-label">From</label><select id="cc-from" class="select" onchange="UtilitiesModule.ccConvert()">${options}</select></div>
        <div><label class="form-label">To</label><select id="cc-to" class="select" onchange="UtilitiesModule.ccConvert()"><option>EUR</option>${options}</select></div>
      </div>
      <div id="cc-result" class="font-mono text-accent" style="font-size:28px;text-align:center;padding:20px"></div>
    </div>`;
  },
  _ccRates:{USD:1,EUR:0.92,GBP:0.79,JPY:149.5,CAD:1.36,AUD:1.52,INR:83.1,CNY:7.24,BRL:4.97,MXN:17.1,CHF:0.88,SGD:1.34,HKD:7.82,SEK:10.3,NOK:10.4,DKK:6.88,ZAR:18.7,AED:3.67,SAR:3.75,NZD:1.63},
  ccConvert(){
    const amt=parseFloat(document.getElementById('cc-amt')?.value)||1;
    const from=document.getElementById('cc-from')?.value||'USD';
    const to=document.getElementById('cc-to')?.value||'EUR';
    const usd=amt/this._ccRates[from];
    const result=usd*this._ccRates[to];
    const el=document.getElementById('cc-result');
    if(el) el.textContent=`${amt} ${from} = ${result.toFixed(2)} ${to}`;
  },

  // ─── Password Generator ──────────────────────
  renderPassword(){
    return `<div class="card">
      <div class="form-row">
        <div><label class="form-label">Length</label><input id="pw-len" class="input" type="number" value="16" min="4" max="128"></div>
      </div>
      <div class="mb-8">
        <label class="flex gap-8 mb-8" style="align-items:center"><input id="pw-upper" type="checkbox" checked> Uppercase (A-Z)</label>
        <label class="flex gap-8 mb-8" style="align-items:center"><input id="pw-lower" type="checkbox" checked> Lowercase (a-z)</label>
        <label class="flex gap-8 mb-8" style="align-items:center"><input id="pw-num" type="checkbox" checked> Numbers (0-9)</label>
        <label class="flex gap-8" style="align-items:center"><input id="pw-sym" type="checkbox" checked> Symbols (!@#$...)</label>
      </div>
      <button class="btn btn-primary w-full" onclick="UtilitiesModule.genPassword()">Generate</button>
      <div id="pw-result" class="font-mono mt-8" style="background:var(--surface3);padding:12px;border-radius:var(--radius-sm);word-break:break-all;cursor:pointer" onclick="navigator.clipboard.writeText(this.textContent);showToast('Copied!','success')"></div>
      <div id="pw-strength" class="text-center text-sm mt-8"></div>
    </div>`;
  },
  genPassword(){
    const len=parseInt(document.getElementById('pw-len')?.value)||16;
    let chars='';
    if(document.getElementById('pw-upper')?.checked) chars+='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if(document.getElementById('pw-lower')?.checked) chars+='abcdefghijklmnopqrstuvwxyz';
    if(document.getElementById('pw-num')?.checked) chars+='0123456789';
    if(document.getElementById('pw-sym')?.checked) chars+='!@#$%^&*()_+-=[]{}|;:,.<>?';
    if(!chars){showToast('Select at least one type','error');return;}
    let pw='';
    for(let i=0;i<len;i++) pw+=chars[Math.floor(Math.random()*chars.length)];
    const el=document.getElementById('pw-result'); if(el) el.textContent=pw;
    const strength=len>=20&&chars.length>60?'💪 Very Strong':len>=12&&chars.length>50?'✅ Strong':len>=8?'⚠️ Moderate':'❌ Weak';
    const sel=document.getElementById('pw-strength'); if(sel) sel.textContent=strength;
  },

  // ─── Text Tools ─────────────────────────────
  renderText(){
    return `<div class="card">
      <textarea id="text-in" class="input" rows="6" placeholder="Enter or paste text here..."></textarea>
      <div class="flex gap-8 flex-wrap mt-8 mb-8">
        <button class="btn btn-secondary btn-sm" onclick="UtilitiesModule.textOp('upper')">UPPER</button>
        <button class="btn btn-secondary btn-sm" onclick="UtilitiesModule.textOp('lower')">lower</button>
        <button class="btn btn-secondary btn-sm" onclick="UtilitiesModule.textOp('title')">Title Case</button>
        <button class="btn btn-secondary btn-sm" onclick="UtilitiesModule.textOp('reverse')">Reverse</button>
        <button class="btn btn-secondary btn-sm" onclick="UtilitiesModule.textOp('trim')">Trim</button>
        <button class="btn btn-secondary btn-sm" onclick="UtilitiesModule.textOp('b64enc')">Base64 Enc</button>
        <button class="btn btn-secondary btn-sm" onclick="UtilitiesModule.textOp('b64dec')">Base64 Dec</button>
        <button class="btn btn-secondary btn-sm" onclick="UtilitiesModule.textOp('jsonFmt')">Format JSON</button>
        <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText(document.getElementById('text-in').value);showToast('Copied!')">Copy</button>
      </div>
      <div id="text-stats" class="text-muted text-sm mb-8"></div>
      <textarea id="text-out" class="input" rows="4" placeholder="Output..." readonly></textarea>
    </div>`;
  },
  textOp(op){
    const inp=document.getElementById('text-in')?.value||'';
    let out=inp;
    if(op==='upper') out=inp.toUpperCase();
    else if(op==='lower') out=inp.toLowerCase();
    else if(op==='title') out=inp.replace(/\w\S*/g,t=>t.charAt(0).toUpperCase()+t.slice(1).toLowerCase());
    else if(op==='reverse') out=inp.split('').reverse().join('');
    else if(op==='trim') out=inp.split('\n').map(l=>l.trim()).join('\n');
    else if(op==='b64enc') try{out=btoa(unescape(encodeURIComponent(inp)))}catch{out='Error'}
    else if(op==='b64dec') try{out=decodeURIComponent(escape(atob(inp)))}catch{out='Error: invalid base64'}
    else if(op==='jsonFmt') try{out=JSON.stringify(JSON.parse(inp),null,2)}catch{out='Error: invalid JSON'}
    const outEl=document.getElementById('text-out'); if(outEl) outEl.value=out;
    // Stats
    const words=inp.trim()?inp.trim().split(/\s+/).length:0;
    const statsEl=document.getElementById('text-stats');
    if(statsEl) statsEl.textContent=`Words: ${words} · Chars: ${inp.length} · Lines: ${inp.split('\n').length}`;
    if(op==='upper'||op==='lower'||op==='title'||op==='reverse'||op==='trim'){
      const textIn=document.getElementById('text-in');
      if(textIn) textIn.value=out;
    }
  },

  // ─── Color Palette ───────────────────────────
  renderColor(){
    return `<div class="card">
      <div class="form-row">
        <div><label class="form-label">Pick Color</label><input id="color-pick" type="color" value="#f59e0b" class="input" style="height:42px;padding:2px" oninput="UtilitiesModule.updateColor()"></div>
        <div><label class="form-label">Hex</label><input id="color-hex" class="input font-mono" placeholder="#f59e0b" oninput="UtilitiesModule.hexUpdate()"></div>
      </div>
      <div id="color-preview" style="width:100%;height:80px;border-radius:var(--radius);margin:12px 0;background:#f59e0b;transition:background 0.2s"></div>
      <div id="color-info" class="font-mono text-sm text-muted"></div>
      <div class="divider"></div>
      <div class="card-title">Generated Palette</div>
      <button class="btn btn-secondary mb-8" onclick="UtilitiesModule.genPalette()">Generate Palette</button>
      <div id="palette-row" class="swatch-row"></div>
      <div class="divider"></div>
      <div class="card-title">Gradient Preview</div>
      <div class="flex gap-8 mb-8">
        <input id="grad-c1" type="color" value="#6366f1" class="input" style="height:42px;padding:2px;width:80px">
        <input id="grad-c2" type="color" value="#f59e0b" class="input" style="height:42px;padding:2px;width:80px">
        <button class="btn btn-secondary" onclick="UtilitiesModule.previewGrad()">Preview</button>
        <button class="btn btn-ghost btn-sm" onclick="UtilitiesModule.copyGrad()">Copy CSS</button>
      </div>
      <div id="grad-preview" style="height:60px;border-radius:var(--radius);background:linear-gradient(135deg,#6366f1,#f59e0b)"></div>
    </div>`;
  },
  initColor(){
    setTimeout(()=>this.updateColor(),50);
  },
  updateColor(){
    const c=document.getElementById('color-pick')?.value||'#f59e0b';
    const prev=document.getElementById('color-preview'); if(prev) prev.style.background=c;
    const hexEl=document.getElementById('color-hex'); if(hexEl) hexEl.value=c;
    this.showColorInfo(c);
  },
  hexUpdate(){
    const hex=document.getElementById('color-hex')?.value;
    if(/^#[0-9a-fA-F]{6}$/.test(hex)){
      const pick=document.getElementById('color-pick'); if(pick) pick.value=hex;
      const prev=document.getElementById('color-preview'); if(prev) prev.style.background=hex;
      this.showColorInfo(hex);
    }
  },
  showColorInfo(hex){
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    const el=document.getElementById('color-info');
    if(el) el.textContent=`HEX: ${hex.toUpperCase()} · RGB: rgb(${r},${g},${b}) · HSL: ${this.rgbToHsl(r,g,b)}`;
  },
  rgbToHsl(r,g,b){
    r/=255;g/=255;b/=255;
    const max=Math.max(r,g,b),min=Math.min(r,g,b);let h,s,l=(max+min)/2;
    if(max===min){h=s=0;}else{const d=max-min;s=l>0.5?d/(2-max-min):d/(max+min);
      if(max===r)h=((g-b)/d+(g<b?6:0))/6;else if(max===g)h=((b-r)/d+2)/6;else h=((r-g)/d+4)/6;}
    return `hsl(${Math.round(h*360)},${Math.round(s*100)}%,${Math.round(l*100)}%)`;
  },
  genPalette(){
    const base=document.getElementById('color-pick')?.value||'#f59e0b';
    const r=parseInt(base.slice(1,3),16),g=parseInt(base.slice(3,5),16),b=parseInt(base.slice(5,7),16);
    const colors=[base];
    for(let i=1;i<6;i++){
      const factor=0.7+i*0.06;
      colors.push(`rgb(${Math.min(255,Math.round(r*factor))},${Math.min(255,Math.round(g*factor))},${Math.min(255,Math.round(b*factor))})`);
    }
    const el=document.getElementById('palette-row');
    if(el) el.innerHTML=colors.map(c=>`<div class="swatch" style="background:${c}" title="${c}" onclick="navigator.clipboard.writeText('${c}');showToast('Copied: ${c}')"></div>`).join('');
  },
  previewGrad(){
    const c1=document.getElementById('grad-c1')?.value||'#6366f1';
    const c2=document.getElementById('grad-c2')?.value||'#f59e0b';
    const el=document.getElementById('grad-preview'); if(el) el.style.background=`linear-gradient(135deg,${c1},${c2})`;
  },
  copyGrad(){
    const c1=document.getElementById('grad-c1')?.value;
    const c2=document.getElementById('grad-c2')?.value;
    navigator.clipboard.writeText(`background: linear-gradient(135deg, ${c1}, ${c2});`);
    showToast('CSS copied!','success');
  },

  // ─── QR Code ─────────────────────────────────
  renderQR(){
    return `<div class="card">
      <div class="text-muted text-sm mb-8">ℹ️ Requires internet to load QR library</div>
      <div class="input-group">
        <input id="qr-text" class="input" placeholder="Enter URL or text...">
        <button class="btn btn-primary" onclick="UtilitiesModule.genQR()">Generate</button>
      </div>
      <div id="qr-result" class="text-center mt-16" style="min-height:100px"></div>
    </div>`;
  },
  genQR(){
    const text=document.getElementById('qr-text')?.value; if(!text) return;
    const el=document.getElementById('qr-result'); if(!el) return;
    el.innerHTML='';
    if(typeof QRCode==='undefined'){el.innerHTML='<div class="text-muted">QR library not loaded (requires internet on first load). Try refreshing.</div>';return;}
    new QRCode(el,{text,width:200,height:200,colorDark:'#000',colorLight:'#fff'});
  },

  // ─── Random Picker ───────────────────────────
  renderRandom(){
    return `<div class="card">
      <div class="section-title">Pick from list</div>
      <div class="form-group"><label class="form-label">Items (one per line)</label><textarea id="rp-items" class="input" rows="5" placeholder="Alice&#10;Bob&#10;Charlie&#10;Dave"></textarea></div>
      <button class="btn btn-primary" onclick="UtilitiesModule.pickRandom()">Pick One!</button>
      <div id="rp-result" class="font-mono text-accent mt-16" style="font-size:32px;text-align:center"></div>
      <hr class="divider">
      <div class="section-title">Random Number</div>
      <div class="flex gap-8">
        <input id="rn-min" class="input" type="number" value="1" placeholder="Min" style="width:100px">
        <span class="text-muted" style="line-height:38px">to</span>
        <input id="rn-max" class="input" type="number" value="100" placeholder="Max" style="width:100px">
        <button class="btn btn-primary" onclick="UtilitiesModule.pickNum()">Roll</button>
      </div>
      <div id="rn-result" class="font-mono text-accent mt-8" style="font-size:36px;text-align:center"></div>
    </div>`;
  },
  pickRandom(){
    const items=document.getElementById('rp-items')?.value.split('\n').filter(l=>l.trim());
    if(!items?.length) return showToast('Add some items first','error');
    const pick=items[Math.floor(Math.random()*items.length)].trim();
    const el=document.getElementById('rp-result'); if(el) el.textContent='🎯 '+pick;
  },
  pickNum(){
    const min=parseInt(document.getElementById('rn-min')?.value)||1;
    const max=parseInt(document.getElementById('rn-max')?.value)||100;
    const r=Math.floor(Math.random()*(max-min+1))+min;
    const el=document.getElementById('rn-result'); if(el) el.textContent=r;
  },

  init(){ this.renderTab(); }
};

// ══════════════════════════════════════════════════
// MODULE: SETTINGS
// ══════════════════════════════════════════════════
const SettingsModule = {
  render(){
    const s=Storage.load('settings',{theme:'dark',accent:'#f59e0b'});
    const accents=[
      {color:'#f59e0b',dim:'#7a4d07',name:'Amber'},
      {color:'#6366f1',dim:'#2d2f7a',name:'Indigo'},
      {color:'#22c55e',dim:'#0d4a1e',name:'Green'},
      {color:'#38bdf8',dim:'#0e4a66',name:'Sky'},
      {color:'#ec4899',dim:'#6b1040',name:'Pink'},
      {color:'#a855f7',dim:'#4a1070',name:'Purple'},
      {color:'#ef4444',dim:'#6b1414',name:'Red'},
      {color:'#14b8a6',dim:'#0a4a42',name:'Teal'},
    ];
    return `
    <div class="module-header"><div><div class="module-title">⚙️ Settings</div></div></div>
    <div class="card">
      <div class="card-title">Visuals</div>
      <div class="settings-row">
        <div><div class="settings-label">Dark Mode</div><div class="settings-desc">Use dark theme</div></div>
        <div class="toggle-switch ${s.theme!=='light'?'on':''}" onclick="SettingsModule.toggleTheme(this)"><div class="toggle-knob"></div></div>
      </div>
      <div class="settings-row">
        <div><div class="settings-label">Accent Color</div><div class="settings-desc">Main highlight color</div></div>
        <div class="flex gap-8">
          ${accents.map(a=>`<div class="accent-swatch ${s.accent===a.color?'active':''}" style="background:${a.color}" title="${a.name}" onclick="SettingsModule.setAccent('${a.color}','${a.dim}',this)"></div>`).join('')}
          <input type="color" class="input" style="width:32px;height:32px;padding:2px;border-radius:50%" value="${s.accent}" oninput="SettingsModule.setAccent(this.value,'',null)">
        </div>
      </div>
      <div class="settings-row">
        <div><div class="settings-label">Sidebar</div><div class="settings-desc">Collapse/expand navigation</div></div>
        <button class="btn btn-secondary btn-sm" onclick="app.toggleSidebar()">Toggle Sidebar</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Notifications</div>
      <div class="settings-row">
        <div><div class="settings-label">Browser Notifications</div><div class="settings-desc">For alarms and timers</div></div>
        <button class="btn btn-secondary btn-sm" id="notif-btn" onclick="SettingsModule.requestNotif()">
          ${Notification.permission==='granted'?'✅ Enabled':'Request Permission'}
        </button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Data Management</div>
      <div class="settings-row">
        <div><div class="settings-label">Export All Data</div><div class="settings-desc">Download backup as JSON</div></div>
        <button class="btn btn-secondary btn-sm" onclick="SettingsModule.exportData()">Export</button>
      </div>
      <div class="settings-row">
        <div><div class="settings-label">Import Data</div><div class="settings-desc">Restore from JSON backup</div></div>
        <label class="btn btn-secondary btn-sm" style="cursor:pointer">Import<input type="file" accept=".json" style="display:none" onchange="SettingsModule.importData(this)"></label>
      </div>
      <div class="settings-row">
        <div><div class="settings-label">Reset All Data</div><div class="settings-desc text-red">⚠️ Permanently delete all data</div></div>
        <button class="btn btn-danger btn-sm" onclick="SettingsModule.resetAll()">Reset All</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">About Everall</div>
      <div class="settings-row"><div class="settings-label">Version</div><span class="font-mono text-accent">1.0.6</span></div>
      <div class="settings-row"><div class="settings-label">Storage Used</div><span id="storage-size" class="font-mono">${this.storageSize()}</span></div>
      <div class="settings-row"><div class="settings-label">Mode</div><span class="badge badge-green">Fully Offline</span></div>
    </div>`;
  },
  toggleTheme(el){
    el.classList.toggle('on');
    const isLight=!el.classList.contains('on');
    document.body.classList.toggle('theme-light',isLight);
    const s=Storage.load('settings',{}); s.theme=isLight?'light':'dark'; Storage.save('settings',s);
    showToast(isLight?'☀️ Light mode':'🌙 Dark mode');
  },
  setAccent(color,dim,el){
    document.documentElement.style.setProperty('--accent',color);
    if(dim) document.documentElement.style.setProperty('--accent-dim',dim);
    const s=Storage.load('settings',{}); s.accent=color; if(dim) s.accentDim=dim; Storage.save('settings',s);
    document.querySelectorAll('.accent-swatch').forEach(s=>s.classList.remove('active'));
    if(el) el.classList.add('active');
    showToast('Accent color updated');
  },
  requestNotif(){
    Notification.requestPermission().then(p=>{
      const btn=document.getElementById('notif-btn');
      if(btn) btn.textContent=p==='granted'?'✅ Enabled':'❌ Denied';
      showToast(p==='granted'?'Notifications enabled!':'Notifications denied','success');
    });
  },
  storageSize(){
    let total=0;
    for(let k in localStorage){if(k.startsWith('everall_'))total+=localStorage[k].length;}
    return total<1024?`${total} B`:`${(total/1024).toFixed(1)} KB`;
  },
  exportData(){
    const data={};
    for(let k in localStorage){if(k.startsWith('everall_')){try{data[k.replace('everall_','')]=JSON.parse(localStorage[k]);}catch{data[k]=localStorage[k];}}}
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`everall-backup-${today()}.json`; a.click();
    showToast('Data exported!','success');
  },
  importData(input){
    const file=input.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        const data=JSON.parse(e.target.result);
        Object.entries(data).forEach(([k,v])=>Storage.save(k,v));
        showToast('Data imported! Refresh to apply.','success');
      }catch{showToast('Invalid backup file','error');}
    };
    reader.readAsText(file);
  },
  resetAll(){
    if(confirm('Are you sure? This will delete ALL your Everall data permanently.')){
      Object.keys(localStorage).filter(k=>k.startsWith('everall_')).forEach(k=>localStorage.removeItem(k));
      showToast('All data cleared','success');
      app.navigate('dashboard');
    }
  },
  init(){}
};

// ══════════════════════════════════════════════════
// MODULE REGISTRY
// ══════════════════════════════════════════════════
const Modules = {
  dashboard:  DashboardModule,
  clock:      TimeModule,
  todo:       TodoModule,
  habits:     HabitModule,
  goals:      GoalsModule,
  wishlist:   WishlistModule,
  notes:      NotesModule,
  calendar:   CalendarModule,
  study:      StudyModule,
  finance:    FinanceModule,
  health:     HealthModule,
  games:      GamesModule,
  analytics:  AnalyticsModule,
  utilities:  UtilitiesModule,
  settings:   SettingsModule,
};

// ══════════════════════════════════════════════════
// BOOTSTRAP
// ══════════════════════════════════════════════════
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new App();
  // Expose modules to global for onclick handlers
  window.app = app;
  window.TimeModule = TimeModule;
  window.TodoModule = TodoModule;
  window.HabitModule = HabitModule;
  window.GoalsModule = GoalsModule;
  window.WishlistModule = WishlistModule;
  window.NotesModule = NotesModule;
  window.CalendarModule = CalendarModule;
  window.StudyModule = StudyModule;
  window.FinanceModule = FinanceModule;
  window.HealthModule = HealthModule;
  window.GamesModule = GamesModule;
  window.AnalyticsModule = AnalyticsModule;
  window.UtilitiesModule = UtilitiesModule;
  window.SettingsModule = SettingsModule;
  window.showToast = showToast;
  window.closeModal = closeModal;
  window.openModal = openModal;
});
