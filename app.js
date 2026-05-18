/* ─────────────────────────────────────────────
   Cozy Mood Tracker · app.js
   ───────────────────────────────────────────── */

// ───── constants ─────
const MOODS = [
  { key: 'happy',    icon: '🐰', img: 'assets/moods/happy.png',    label: 'happy'    },
  { key: 'excited',  icon: '🦄', img: 'assets/moods/excited.png',  label: 'excited'  },
  { key: 'calm',     icon: '🐻', img: 'assets/moods/calm.png',     label: 'calm'     },
  { key: 'sleepy',   icon: '🐨', img: 'assets/moods/sleepy.png',   label: 'sleepy'   },
  { key: 'tired',    icon: '🐼', img: 'assets/moods/tired.png',    label: 'tired'    },
  { key: 'sad',      icon: '🐳', img: 'assets/moods/sad.png',      label: 'sad'      },
  { key: 'angry',    icon: '🐯', img: 'assets/moods/angry.png',    label: 'angry'    },
  { key: 'sick',     icon: '🐥', img: 'assets/moods/sick.png',     label: 'sick'     },
  { key: 'love',     icon: '🐹', img: 'assets/moods/love.png',     label: 'in love'  },
  { key: 'meh',      icon: '🐱', img: 'assets/moods/meh.png',      label: 'meh'      },
  { key: 'anxious',  icon: '🐸', img: 'assets/moods/anxious.png',  label: 'anxious'  },
  { key: 'great',    icon: '🦊', img: 'assets/moods/great.png',    label: 'great'    },
];

// helpers to find a mood by either its icon (legacy) or img path (new)
function findMoodByValue(v) {
  if (!v) return null;
  return MOODS.find(m => m.icon === v || m.img === v) || null;
}

// renders a mood value (img path OR emoji) as HTML
function moodHtml(v, size) {
  if (!v) return '';
  const m = findMoodByValue(v);
  if (m && m.img) {
    const sz = size ? `style="width:${size}px;height:${size}px;"` : '';
    return `<img src="${m.img}" alt="${m.label}" class="mood-img" ${sz} draggable="false" onerror="this.replaceWith(document.createTextNode('${m.icon}'));">`;
  }
  // custom sticker (emoji string) or legacy emoji
  return escapeHtml(v);
}

// approximate "vibe score" used for mood graph + summaries
const MOOD_SCORE = {
  great: 5, happy: 5, excited: 5, love: 5,
  calm: 4,
  meh: 3, sleepy: 3, tired: 3,
  sad: 2, anxious: 2, sick: 2,
  angry: 1,
};

const DEFAULT_HABITS = [
  { id: 'games',   name: 'played games', icon: '🎮' },
  { id: 'water',   name: 'stayed hydrated', icon: '💧' },
  { id: 'sleep',   name: '6-7 hours of sleep', icon: '😴' },
];

const THEMES = [
  { id: 'pink',   color: '#f7a8b8' },
  { id: 'blue',   color: '#8ec5ff' },
  { id: 'green',  color: '#9ed29a' },
  { id: 'purple', color: '#c2a3ec' },
  { id: 'peach',  color: '#ffb088' },
];

const MEAL_LIST = [
  { id: 'b', icon: '🍳', label: 'breakfast' },
  { id: 'l', icon: '🥗', label: 'lunch' },
  { id: 's', icon: '🍪', label: 'snack' },
  { id: 'd', icon: '🍜', label: 'dinner' },
];

const STORAGE_KEY = 'cozy-mood-tracker-v1';

// ───── state ─────
let state = loadState();

// utility: today key
const todayKey = () => fmtDate(new Date());

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseDate(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); }

function defaultState() {
  return {
    days: {},          // { 'YYYY-MM-DD': { mood, note, habits:{id:'done'|'skip'|null}, water, sleep, steps, cal, meals:{b,l,s,d}, productivity, todos:[], journal, special } }
    monthNotes: {},    // { 'YYYY-MM': '...' }
    futureNotes: [],   // [ { id, text, date, done } ]
    habits: DEFAULT_HABITS.slice(),
    customStickers: [],
    settings: {
      theme: 'pink',
      dark: false,
      reminder: { enabled: false, time: '21:00' },
    },
    viewMonth: { y: new Date().getFullYear(), m: new Date().getMonth() },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultState(), parsed, {
      settings: Object.assign(defaultState().settings, parsed.settings || {}),
    });
  } catch (e) {
    console.warn('Failed to load state', e);
    return defaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { console.warn('save failed', e); }
  // schedule cloud auto-sync if enabled
  if (window.Cloud && window.Cloud.scheduleSync) window.Cloud.scheduleSync();
}

// expose state for the cloud module
window.getCozyState = () => state;
window.setCozyState = (s) => {
  state = Object.assign(defaultState(), s, {
    settings: Object.assign(defaultState().settings, s?.settings || {}),
  });
  saveState();
  applyTheme();
  renderAll();
};

function ensureDay(key) {
  if (!state.days[key]) {
    state.days[key] = {
      mood: null, note: '', habits: {}, water: 0, sleep: 0,
      steps: 0, cal: 0, meals: {}, productivity: 0,
      todos: [], journal: '', special: false,
    };
  }
  return state.days[key];
}

// ───── DOM helpers ─────
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 1800);
}

// ───── theme ─────
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.settings.theme);
  document.documentElement.setAttribute('data-dark', state.settings.dark ? 'true' : 'false');
  $('#darkModeChk').checked = state.settings.dark;
  $$('#themeRow .swatch').forEach(s => s.classList.toggle('active', s.dataset.theme === state.settings.theme));
  $('#darkToggle').classList.toggle('on', !!state.settings.dark);
}

function updateBellState() {
  $('#notifyToggle').classList.toggle('on', !!state.settings.reminder.enabled);
}

function buildThemeRow() {
  const row = $('#themeRow');
  row.innerHTML = '';
  THEMES.forEach(t => {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.dataset.theme = t.id;
    b.style.background = t.color;
    b.title = t.id;
    b.addEventListener('click', () => {
      state.settings.theme = t.id;
      saveState(); applyTheme();
    });
    row.appendChild(b);
  });
}

// ───── tabs ─────
function initTabs() {
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab-btn').forEach(b => b.classList.remove('active'));
      $$('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $('#tab-' + btn.dataset.tab).classList.add('active');
      // scroll active tab into view (so it isn't clipped on the right edge)
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      // re-render charts when stats becomes visible
      if (btn.dataset.tab === 'stats') renderStats();
      if (btn.dataset.tab === 'archive') renderArchive();
      if (btn.dataset.tab === 'settings') renderSettings();
    });
  });
}

// ───── month calendar ─────
function getMonthName(m) {
  return ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'][m];
}

function renderCalendar() {
  const { y, m } = state.viewMonth;
  $('#monthNum').textContent = String(m + 1).padStart(2, '0');
  $('#monthYear').textContent = y;
  $('#monthName').textContent = getMonthName(m);
  $('#monthJump').value = `${y}-${String(m + 1).padStart(2, '0')}`;

  const grid = $('#calendarGrid');
  grid.innerHTML = '';
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  // monday-start offset
  let startDow = first.getDay() - 1; // sun=0 -> -1 (i.e. 6)
  if (startDow < 0) startDow = 6;
  // empty cells before
  for (let i = 0; i < startDow; i++) {
    const c = document.createElement('div');
    c.className = 'cell empty';
    grid.appendChild(c);
  }
  const today = todayKey();
  const todayD = new Date(); todayD.setHours(0, 0, 0, 0);

  for (let d = 1; d <= last.getDate(); d++) {
    const dt = new Date(y, m, d);
    const key = fmtDate(dt);
    const data = state.days[key];
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.key = key;
    if (key === today) cell.classList.add('today');
    if (dt > todayD) cell.classList.add('future');

    const num = document.createElement('div');
    num.className = 'day-num';
    num.textContent = d;
    cell.appendChild(num);

    const moodEl = document.createElement('div');
    moodEl.className = 'mood';
    if (data && data.mood) moodEl.innerHTML = moodHtml(data.mood);
    cell.appendChild(moodEl);

    if (data && data.note) {
      const n = document.createElement('span');
      n.className = 'has-note';
      n.textContent = '📝';
      cell.appendChild(n);
    }

    // small habit indicators
    if (data && data.habits) {
      const ind = document.createElement('div');
      ind.className = 'indicator-row';
      state.habits.forEach(h => {
        const v = data.habits[h.id];
        if (v) {
          const dot = document.createElement('span');
          dot.className = 'indicator' + (v === 'skip' ? ' bad' : '');
          ind.appendChild(dot);
        }
      });
      if (ind.childNodes.length) cell.appendChild(ind);
    }

    cell.addEventListener('click', () => openDayModal(key));
    grid.appendChild(cell);
  }

  // weekly summary
  renderWeeklySummary();
  renderMoodOfMonth();
}

function renderWeeklySummary() {
  const { y, m } = state.viewMonth;
  const last = new Date(y, m + 1, 0).getDate();
  const wrap = $('#weeklySummary');
  wrap.innerHTML = '';
  let weekStart = 1;
  let weekIdx = 1;
  while (weekStart <= last) {
    const weekEnd = Math.min(weekStart + 6, last);
    let scoreSum = 0, n = 0;
    let bestMood = '';
    const moodCounts = {};
    for (let d = weekStart; d <= weekEnd; d++) {
      const key = fmtDate(new Date(y, m, d));
      const data = state.days[key];
      if (data && data.mood) {
        const moodKey = findMoodByValue(data.mood)?.key;
        if (moodKey) {
          scoreSum += MOOD_SCORE[moodKey] || 3;
          n++;
        }
        moodCounts[data.mood] = (moodCounts[data.mood] || 0) + 1;
      }
    }
    const avg = n ? (scoreSum / n) : 0;
    const top = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];
    bestMood = top ? top[0] : '·';

    const pill = document.createElement('div');
    pill.className = 'week-pill';
    pill.innerHTML = `<b>W${weekIdx}</b> <span class="we">${moodHtml(bestMood, 18)}</span> <span class="hint">avg ${avg.toFixed(1)}/5</span>`;
    wrap.appendChild(pill);

    weekStart = weekEnd + 1;
    weekIdx++;
  }
}

function renderMoodOfMonth() {
  const { y, m } = state.viewMonth;
  const last = new Date(y, m + 1, 0).getDate();
  const moodCounts = {};
  let scoreSum = 0, n = 0;
  for (let d = 1; d <= last; d++) {
    const key = fmtDate(new Date(y, m, d));
    const data = state.days[key];
    if (data && data.mood) {
      moodCounts[data.mood] = (moodCounts[data.mood] || 0) + 1;
      const mk = findMoodByValue(data.mood)?.key;
      if (mk) { scoreSum += MOOD_SCORE[mk] || 3; n++; }
    }
  }
  const top = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];
  const ic = top ? top[0] : null;
  $('#moodOfMonth').innerHTML = ic ? moodHtml(ic, 56) : '🌷';
  if (!n) { $('#moodOfMonthText').textContent = 'log moods to see the vibe'; return; }
  const avg = scoreSum / n;
  let label = 'a calm month';
  if (avg >= 4.4) label = 'a wonderful month! ✨';
  else if (avg >= 3.6) label = 'a sweet & happy month';
  else if (avg >= 2.8) label = 'a mixed but okay month';
  else if (avg >= 2) label = 'a tough month, be gentle';
  else label = 'a heavy month, take care';
  $('#moodOfMonthText').textContent = label;
}

// ───── habits sidebar ─────
function renderHabits() {
  const wrap = $('#habitList');
  wrap.innerHTML = '';
  const { y, m } = state.viewMonth;
  const last = new Date(y, m + 1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);

  state.habits.forEach(h => {
    const row = document.createElement('div');
    row.className = 'habit-row';
    const streak = computeStreak(h.id);

    const head = document.createElement('div');
    head.className = 'habit-head';
    head.innerHTML = `<div class="habit-name">${h.icon} <span>${escapeHtml(h.name)}</span></div>
      <div class="hr-actions">
        <span class="habit-streak" title="current streak">🔥 ${streak}d</span>
      </div>`;
    row.appendChild(head);

    const dots = document.createElement('div');
    dots.className = 'habit-dots';
    for (let d = 1; d <= last; d++) {
      const dt = new Date(y, m, d);
      const key = fmtDate(dt);
      const data = state.days[key];
      const v = data && data.habits ? data.habits[h.id] : null;
      const dot = document.createElement('div');
      dot.className = 'habit-dot' + (v === 'done' ? ' done' : v === 'skip' ? ' skip' : '');
      if (dt > today) dot.classList.add('future');
      dot.textContent = v === 'done' ? '✓' : v === 'skip' ? '✗' : '';
      dot.title = `${key} · ${v || 'tap to log'}`;
      if (dt <= today) {
        dot.addEventListener('click', () => {
          const day = ensureDay(key);
          const cur = day.habits[h.id];
          day.habits[h.id] = cur === 'done' ? 'skip' : cur === 'skip' ? null : 'done';
          saveState();
          renderHabits(); renderCalendar();
        });
      }
      dots.appendChild(dot);
    }
    row.appendChild(dots);
    wrap.appendChild(row);
  });
}

function computeStreak(habitId) {
  let streak = 0;
  let d = new Date();
  d.setHours(0,0,0,0);
  while (true) {
    const k = fmtDate(d);
    const day = state.days[k];
    if (day && day.habits && day.habits[habitId] === 'done') {
      streak++;
      d.setDate(d.getDate() - 1);
    } else { break; }
  }
  return streak;
}

// ───── mood picker ─────
function renderMoodPickers() {
  buildMoodPicker($('#moodPicker'), todayKey(), () => { renderCalendar(); renderTodayMoodSelection(); });
}

function buildMoodPicker(container, dateKey, onChange) {
  container.innerHTML = '';
  const data = state.days[dateKey];
  // each entry: { value, html, label } — value is what's stored; html is the visual
  const allStickers = MOODS.map(m => ({
    value: m.img,
    html: `<img src="${m.img}" alt="${m.label}" draggable="false" onerror="this.replaceWith(document.createTextNode('${m.icon}'));">`,
    label: m.label,
  })).concat(state.customStickers.map(s => ({
    value: s,
    html: escapeHtml(s),
    label: 'custom',
  })));

  // resolve current selection — accept legacy emoji or img path
  const currentMood = data && data.mood;
  const currentResolved = (() => {
    if (!currentMood) return null;
    const m = findMoodByValue(currentMood);
    if (m) return m.img;
    return currentMood; // custom sticker
  })();

  allStickers.forEach(({ value, html, label }) => {
    const b = document.createElement('button');
    b.className = 'mood-pick';
    b.type = 'button';
    b.innerHTML = `<span class="mp-icon">${html}</span><span class="lbl">${label}</span>`;
    if (value === currentResolved) b.classList.add('selected');
    b.addEventListener('click', () => {
      const day = ensureDay(dateKey);
      day.mood = day.mood === value || (findMoodByValue(day.mood) && findMoodByValue(day.mood).img === value)
        ? null
        : value;
      saveState();
      Array.from(container.children).forEach(c => c.classList.remove('selected'));
      if (day.mood) b.classList.add('selected');
      onChange && onChange();
    });
    container.appendChild(b);
  });
}

function renderTodayMoodSelection() {
  // forces re-render of mood picker selected state
  buildMoodPicker($('#moodPicker'), todayKey(), () => { renderCalendar(); renderTodayMoodSelection(); });
}

// ───── month note ─────
function renderMonthNote() {
  const { y, m } = state.viewMonth;
  const key = `${y}-${String(m + 1).padStart(2, '0')}`;
  $('#monthNote').value = state.monthNotes[key] || '';
}

// ───── day modal ─────
function openDayModal(dateKey) {
  $('#dayModal').classList.remove('hidden');
  const dt = parseDate(dateKey);
  $('#dayModalTitle').textContent = dt.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  buildMoodPicker($('#dayMoodPicker'), dateKey, () => { renderCalendar(); });

  const day = ensureDay(dateKey);
  $('#dayNote').value = day.note || '';
  $('#dayNote').oninput = (e) => { day.note = e.target.value; saveState(); renderCalendar(); };

  // habits in modal
  const dh = $('#dayHabits');
  dh.innerHTML = '';
  state.habits.forEach(h => {
    const row = document.createElement('div');
    row.className = 'dh-row';
    const v = day.habits[h.id];
    row.innerHTML = `<span>${h.icon} ${escapeHtml(h.name)}</span>
      <div class="dh-buttons">
        <button data-v="done" class="${v==='done'?'on-good':''}">✓</button>
        <button data-v="skip" class="${v==='skip'?'on-bad':''}">✗</button>
      </div>`;
    row.querySelectorAll('.dh-buttons button').forEach(b => {
      b.addEventListener('click', () => {
        const target = b.dataset.v;
        day.habits[h.id] = day.habits[h.id] === target ? null : target;
        saveState();
        openDayModal(dateKey); // refresh
        renderCalendar(); renderHabits();
      });
    });
    dh.appendChild(row);
  });

  // quick stats
  $('#qWater').value = day.water || 0;
  $('#qSleep').value = day.sleep || 0;
  $('#qSteps').value = day.steps || 0;
  $('#qCal').value = day.cal || 0;
  ['qWater','qSleep','qSteps','qCal'].forEach(id => {
    $('#' + id).oninput = () => {
      day.water = +$('#qWater').value || 0;
      day.sleep = +$('#qSleep').value || 0;
      day.steps = +$('#qSteps').value || 0;
      day.cal = +$('#qCal').value || 0;
      saveState();
    };
  });
}

function closeDayModal() {
  $('#dayModal').classList.add('hidden');
}

// ───── health tab ─────
let healthDate = todayKey();

function setHealthDate(key) {
  healthDate = key;
  $('#healthDate').value = key;
  renderHealth();
}

function renderHealth() {
  const day = ensureDay(healthDate);
  // water
  $('#waterCount').textContent = day.water;
  const cupsRow = $('#waterCups');
  cupsRow.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const c = document.createElement('span');
    c.className = 'cup' + (i < day.water ? ' full' : '');
    c.textContent = '🥤';
    c.addEventListener('click', () => { day.water = i + 1; saveState(); renderHealth(); });
    cupsRow.appendChild(c);
  }
  // sleep
  $('#sleepRange').value = day.sleep;
  $('#sleepHours').textContent = day.sleep;
  $('#sleepBar').style.width = Math.min(100, (day.sleep / 8) * 100) + '%';
  $('#sleepHint').textContent = day.sleep >= 7 ? 'great rest 💤' : day.sleep >= 5 ? 'okay sleep' : 'try to sleep more';
  // steps
  $('#stepInput').value = day.steps || '';
  $('#stepDisplay').textContent = day.steps;
  $('#stepBar').style.width = Math.min(100, (day.steps / 8000) * 100) + '%';
  // cal
  $('#calInput').value = day.cal || '';
  $('#calDisplay').textContent = day.cal;
  $('#calBar').style.width = Math.min(100, (day.cal / 400) * 100) + '%';
  // meals
  const mealsRow = $('#mealsRow');
  mealsRow.innerHTML = '';
  MEAL_LIST.forEach(m => {
    const eaten = !!(day.meals && day.meals[m.id]);
    const el = document.createElement('div');
    el.className = 'meal' + (eaten ? ' eaten' : '');
    el.innerHTML = `<div class="ic">${m.icon}</div><span class="nm">${m.label}</span>`;
    el.addEventListener('click', () => {
      day.meals = day.meals || {};
      day.meals[m.id] = !day.meals[m.id];
      saveState(); renderHealth();
    });
    mealsRow.appendChild(el);
  });
  const eatenCount = Object.values(day.meals || {}).filter(Boolean).length;
  $('#mealsHint').textContent = eatenCount >= 3 ? 'you ate properly today 🌷' : eatenCount === 0 ? 'log your meals' : `${eatenCount} meals logged`;

  // productivity stars
  const sr = $('#productivityStars');
  sr.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const s = document.createElement('span');
    s.className = 'star' + (i <= (day.productivity || 0) ? ' on' : '');
    s.textContent = '⭐';
    s.addEventListener('click', () => {
      day.productivity = day.productivity === i ? 0 : i;
      saveState(); renderHealth();
    });
    sr.appendChild(s);
  }
}

// ───── todo tab ─────
let todoDate = todayKey();

function setTodoDate(key) {
  todoDate = key;
  $('#todoDate').value = key;
  renderTodos();
}

function renderTodos() {
  const day = ensureDay(todoDate);
  const list = $('#todoList');
  list.innerHTML = '';
  (day.todos || []).forEach(t => {
    const li = document.createElement('li');
    if (t.done) li.classList.add('done');
    li.innerHTML = `
      <input type="checkbox" ${t.done ? 'checked' : ''} />
      <span class="text">${escapeHtml(t.text)}</span>
      <button class="del" aria-label="delete">✕</button>
    `;
    li.querySelector('input').addEventListener('change', () => {
      t.done = !t.done; saveState(); renderTodos();
    });
    li.querySelector('.del').addEventListener('click', () => {
      day.todos = day.todos.filter(x => x.id !== t.id);
      saveState(); renderTodos();
    });
    list.appendChild(li);
  });
  const total = (day.todos || []).length;
  const done = (day.todos || []).filter(t => t.done).length;
  $('#todoProgress').textContent = `${done} / ${total}`;

  // future
  const fl = $('#futureList');
  fl.innerHTML = '';
  state.futureNotes
    .slice()
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .forEach(f => {
      const li = document.createElement('li');
      if (f.done) li.classList.add('done');
      li.innerHTML = `
        <input type="checkbox" ${f.done ? 'checked' : ''} />
        <span class="text">${escapeHtml(f.text)} <span class="meta">${f.date || ''}</span></span>
        <button class="del" aria-label="delete">✕</button>
      `;
      li.querySelector('input').addEventListener('change', () => { f.done = !f.done; saveState(); renderTodos(); });
      li.querySelector('.del').addEventListener('click', () => {
        state.futureNotes = state.futureNotes.filter(x => x.id !== f.id);
        saveState(); renderTodos();
      });
      fl.appendChild(li);
    });
}

// ───── journal ─────
let journalDate = todayKey();
function setJournalDate(key) {
  journalDate = key;
  $('#journalDate').value = key;
  renderJournal();
}
function renderJournal() {
  const day = ensureDay(journalDate);
  $('#journalText').value = day.journal || '';
  $('#journalCount').textContent = (day.journal || '').length;
  $('#specialDay').checked = !!day.special;
  $('#specialBadge').textContent = day.special ? '✨ special day' : '';
}

// ───── stats ─────
let charts = {};

function renderStats() {
  const { y, m } = state.viewMonth;
  const last = new Date(y, m + 1, 0).getDate();
  const labels = [];
  const moodScores = [];
  const habitData = state.habits.map(h => ({ id: h.id, name: h.name, icon: h.icon, dones: 0, skips: 0 }));
  const water = [], sleep = [], steps = [];
  let moodCount = 0, totalScore = 0, journals = 0, todoDone = 0, todoTotal = 0;
  const moodCountByIcon = {};

  for (let d = 1; d <= last; d++) {
    const dt = new Date(y, m, d);
    const key = fmtDate(dt);
    const data = state.days[key];
    labels.push(d);
    if (data) {
      const mk = findMoodByValue(data.mood)?.key;
      const sc = mk ? (MOOD_SCORE[mk] || 3) : null;
      moodScores.push(sc);
      if (sc != null) { totalScore += sc; moodCount++; moodCountByIcon[data.mood] = (moodCountByIcon[data.mood] || 0) + 1; }
      habitData.forEach(h => {
        const v = data.habits[h.id];
        if (v === 'done') h.dones++;
        else if (v === 'skip') h.skips++;
      });
      water.push(data.water || 0);
      sleep.push(data.sleep || 0);
      steps.push(data.steps || 0);
      if (data.journal) journals++;
      (data.todos || []).forEach(t => { todoTotal++; if (t.done) todoDone++; });
    } else {
      moodScores.push(null);
      water.push(0); sleep.push(0); steps.push(0);
    }
  }

  // insight tiles
  const avg = moodCount ? (totalScore / moodCount) : 0;
  const insightHtml = `
    <div class="insight"><div class="ic">😊</div><div class="val">${avg.toFixed(1)}/5</div><div class="lbl">avg mood</div></div>
    <div class="insight"><div class="ic">📅</div><div class="val">${moodCount}/${last}</div><div class="lbl">days logged</div></div>
    <div class="insight"><div class="ic">💧</div><div class="val">${avgArr(water).toFixed(1)}</div><div class="lbl">avg water</div></div>
    <div class="insight"><div class="ic">😴</div><div class="val">${avgArr(sleep).toFixed(1)}h</div><div class="lbl">avg sleep</div></div>
    <div class="insight"><div class="ic">🚶</div><div class="val">${Math.round(avgArr(steps))}</div><div class="lbl">avg steps</div></div>
    <div class="insight"><div class="ic">📖</div><div class="val">${journals}</div><div class="lbl">journals</div></div>
    <div class="insight"><div class="ic">✅</div><div class="val">${todoDone}/${todoTotal}</div><div class="lbl">tasks done</div></div>
  `;
  $('#insightGrid').innerHTML = insightHtml;
  $('#aiSummary').innerHTML = buildSummary(avg, moodCount, last, habitData, water, sleep, moodCountByIcon, todoDone, todoTotal);

  // mood chart
  const ctx = $('#moodChart');
  if (charts.mood) charts.mood.destroy();
  charts.mood = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'mood',
        data: moodScores,
        spanGaps: true,
        tension: 0.35,
        borderColor: getCSS('--primary'),
        backgroundColor: hexFade(getCSS('--primary'), .25),
        pointBackgroundColor: getCSS('--primary'),
        pointRadius: 4,
        fill: true,
      }],
    },
    options: chartOpts({ y: { min: 0, max: 5, ticks: { stepSize: 1 } } }),
  });

  // habit chart
  const hCtx = $('#habitChart');
  if (charts.habit) charts.habit.destroy();
  charts.habit = new Chart(hCtx, {
    type: 'bar',
    data: {
      labels: habitData.map(h => h.icon + ' ' + h.name),
      datasets: [
        { label: 'done', data: habitData.map(h => h.dones), backgroundColor: getCSS('--good') },
        { label: 'missed', data: habitData.map(h => h.skips), backgroundColor: getCSS('--bad') },
      ],
    },
    options: chartOpts({}, { stacked: true }),
  });

  // health chart
  const heCtx = $('#healthChart');
  if (charts.health) charts.health.destroy();
  charts.health = new Chart(heCtx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'water (cups)', data: water, borderColor: getCSS('--accent'), backgroundColor: hexFade(getCSS('--accent'), .2), tension: 0.3, fill: false },
        { label: 'sleep (h)', data: sleep, borderColor: getCSS('--primary'), backgroundColor: hexFade(getCSS('--primary'), .2), tension: 0.3, fill: false },
      ],
    },
    options: chartOpts({}),
  });

  // streaks
  const streakWrap = $('#streakList');
  streakWrap.innerHTML = '';
  state.habits.forEach(h => {
    const s = computeStreak(h.id);
    const div = document.createElement('div');
    div.className = 'streak-item';
    div.innerHTML = `<span>${h.icon} ${escapeHtml(h.name)}</span><span class="num">${s}<small>d</small></span>`;
    streakWrap.appendChild(div);
  });

  // weekly recap
  renderWeeksRecap();
}

function avgArr(a) { const v = a.filter(x => x > 0); if (!v.length) return 0; return v.reduce((p,c)=>p+c,0)/v.length; }

function chartOpts(scales = {}, opts = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: getCSS('--text') } } },
    scales: {
      x: { ticks: { color: getCSS('--text-soft') }, grid: { color: getCSS('--line') }, stacked: !!opts.stacked },
      y: Object.assign({ ticks: { color: getCSS('--text-soft') }, grid: { color: getCSS('--line') }, stacked: !!opts.stacked }, scales.y || {}),
    },
  };
}
function getCSS(v) {
  return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#000';
}
function hexFade(c, a) {
  // accept any color string and approximate
  return c.startsWith('#') ? hexToRgba(c, a) : c;
}
function hexToRgba(hex, a) {
  const h = hex.replace('#','');
  const f = h.length === 3 ? h.split('').map(x => x+x).join('') : h;
  const r = parseInt(f.slice(0,2),16), g = parseInt(f.slice(2,4),16), b = parseInt(f.slice(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}

function buildSummary(avg, count, last, habits, water, sleep, moodCounts, todoDone, todoTotal) {
  if (!count) return 'no entries yet — start logging to get your monthly vibe report!';
  let mood = 'mixed';
  if (avg >= 4.4) mood = 'amazing and bright ✨';
  else if (avg >= 3.6) mood = 'mostly happy and warm 🌷';
  else if (avg >= 2.8) mood = 'a balanced, steady month';
  else if (avg >= 2) mood = 'a bit heavy and stressful';
  else mood = 'really tough — please be kind to yourself 💛';

  const top = Object.entries(moodCounts).sort((a,b)=>b[1]-a[1])[0];
  const topLabel = top ? (findMoodByValue(top[0])?.label || top[0]) : '';
  const topMood = top ? `most often you felt <b>${escapeHtml(topLabel)}</b> ${moodHtml(top[0], 22)} (${top[1]} days). ` : '';

  const bestHabit = habits.slice().sort((a,b)=>b.dones-a.dones)[0];
  const habitLine = bestHabit && bestHabit.dones
    ? `your best habit was ${bestHabit.icon} <b>${escapeHtml(bestHabit.name)}</b> (${bestHabit.dones} days). `
    : '';

  const avgW = avgArr(water), avgS = avgArr(sleep);
  const healthLine = `you averaged ${avgW.toFixed(1)} cups of water and ${avgS.toFixed(1)}h of sleep. `;

  const todoLine = todoTotal ? `tasks: ${todoDone}/${todoTotal} done. ` : '';

  return `this month felt <b>${mood}</b>. ${topMood}${habitLine}${healthLine}${todoLine}you logged ${count}/${last} days · keep blooming 🌸`;
}

function renderWeeksRecap() {
  const { y, m } = state.viewMonth;
  const last = new Date(y, m + 1, 0).getDate();
  const wrap = $('#weeksRecap');
  wrap.innerHTML = '';
  let weekStart = 1, idx = 1;
  while (weekStart <= last) {
    const weekEnd = Math.min(weekStart + 6, last);
    const moods = [];
    let waterSum = 0, sleepSum = 0, n = 0, doneN = 0, totalN = 0;
    for (let d = weekStart; d <= weekEnd; d++) {
      const k = fmtDate(new Date(y, m, d));
      const data = state.days[k];
      if (data) {
        if (data.mood) moods.push(data.mood);
        waterSum += data.water || 0; sleepSum += data.sleep || 0; n++;
        (data.todos || []).forEach(t => { totalN++; if (t.done) doneN++; });
      }
    }
    const row = document.createElement('div');
    row.className = 'week-row';
    row.innerHTML = `
      <div><b>Week ${idx}</b> <span class="hint">(${weekStart}–${weekEnd})</span></div>
      <div class="wmoods">${moods.map(mm => moodHtml(mm, 22)).join('') || '—'}</div>
      <div class="hint">💧 ${(n? waterSum/n :0).toFixed(1)} · 😴 ${(n? sleepSum/n :0).toFixed(1)}h · ✅ ${doneN}/${totalN}</div>
    `;
    wrap.appendChild(row);
    weekStart = weekEnd + 1;
    idx++;
  }
}

// ───── archive ─────
function renderArchive() {
  const wrap = $('#archiveList');
  wrap.innerHTML = '';
  // build month list from data + view month
  const months = new Set();
  Object.keys(state.days).forEach(k => months.add(k.slice(0,7)));
  Object.keys(state.monthNotes).forEach(k => months.add(k));
  const cur = `${state.viewMonth.y}-${String(state.viewMonth.m + 1).padStart(2, '0')}`;
  months.add(cur);

  const sorted = Array.from(months).sort().reverse();
  if (!sorted.length) {
    wrap.innerHTML = '<p class="hint">no archive yet — start logging!</p>';
    return;
  }

  sorted.forEach(mk => {
    const [yy, mm] = mk.split('-').map(Number);
    // find top mood
    const counts = {};
    Object.entries(state.days).forEach(([k, v]) => {
      if (k.startsWith(mk) && v.mood) counts[v.mood] = (counts[v.mood] || 0) + 1;
    });
    const top = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
    const item = document.createElement('div');
    item.className = 'archive-item';
    item.innerHTML = `
      <div class="am">${getMonthName(mm-1).slice(0,3)}</div>
      <div class="ay">${yy}</div>
      <div class="a-mood">${top ? moodHtml(top[0], 36) : '·'}</div>
    `;
    item.addEventListener('click', () => {
      state.viewMonth = { y: yy, m: mm - 1 };
      saveState();
      renderAll();
      $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'calendar'));
      $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-calendar'));
    });
    wrap.appendChild(item);
  });
}

// ───── settings ─────
function renderSettings() {
  // custom habits
  const list = $('#customHabitsList');
  list.innerHTML = '';
  state.habits.forEach(h => {
    const row = document.createElement('div');
    row.className = 'habit-mini';
    row.innerHTML = `<span>${h.icon} ${escapeHtml(h.name)}</span><button data-id="${h.id}">remove</button>`;
    row.querySelector('button').addEventListener('click', () => {
      if (state.habits.length <= 1) { toast('keep at least one habit'); return; }
      state.habits = state.habits.filter(x => x.id !== h.id);
      saveState(); renderHabits(); renderSettings(); renderCalendar();
    });
    list.appendChild(row);
  });
  // custom stickers
  const cs = $('#customStickerList');
  cs.innerHTML = '';
  state.customStickers.forEach((s, i) => {
    const el = document.createElement('div');
    el.className = 'cs';
    el.innerHTML = `<span>${s}</span><button>✕</button>`;
    el.querySelector('button').addEventListener('click', () => {
      state.customStickers.splice(i, 1);
      saveState(); renderSettings(); renderMoodPickers();
    });
    cs.appendChild(el);
  });
  $('#reminderEnabled').checked = state.settings.reminder.enabled;
  $('#reminderTime').value = state.settings.reminder.time;
}

// ───── search ─────
function performSearch(q) {
  const out = $('#searchResults');
  out.innerHTML = '';
  if (!q.trim()) return;
  const ql = q.toLowerCase();
  const results = [];
  Object.entries(state.days).forEach(([k, d]) => {
    if (d.note && d.note.toLowerCase().includes(ql)) results.push({ k, type: 'note', text: d.note });
    if (d.journal && d.journal.toLowerCase().includes(ql)) results.push({ k, type: 'journal', text: d.journal });
    (d.todos || []).forEach(t => { if (t.text.toLowerCase().includes(ql)) results.push({ k, type: 'todo', text: t.text }); });
    if (d.mood) {
      const m = findMoodByValue(d.mood);
      const label = (m?.label || '') + ' ' + (m?.key || '');
      if (label.toLowerCase().includes(ql) || (ql.length <= 3 && d.mood.includes(q))) {
        results.push({ k, type: 'mood', text: m ? `${m.label}` : d.mood, moodValue: d.mood });
      }
    }
  });
  Object.entries(state.monthNotes).forEach(([k, v]) => {
    if (v && v.toLowerCase().includes(ql)) results.push({ k, type: 'month note', text: v });
  });

  if (!results.length) {
    out.innerHTML = '<p class="hint" style="padding:8px;">no matches</p>';
    return;
  }
  results.slice(0, 30).forEach(r => {
    const div = document.createElement('div');
    div.className = 'result';
    const visual = r.moodValue ? moodHtml(r.moodValue, 22) + ' ' : '';
    div.innerHTML = `<b>${r.k}</b> <small>${r.type}</small><div>${visual}${escapeHtml(r.text.slice(0, 120))}</div>`;
    div.addEventListener('click', () => {
      if (r.k.length === 7) {
        const [yy, mm] = r.k.split('-').map(Number);
        state.viewMonth = { y: yy, m: mm - 1 };
        renderAll();
      } else {
        const [yy, mm] = r.k.split('-').map(Number);
        state.viewMonth = { y: yy, m: mm - 1 };
        renderAll();
        openDayModal(r.k);
      }
      $('#searchBar').classList.add('hidden');
      document.querySelector('.tab-bar').classList.remove('with-search');
    });
    out.appendChild(div);
  });
}

// ───── export / import ─────
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cozy-mood-backup-${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('exported ✿');
}
function importData(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const obj = JSON.parse(r.result);
      state = Object.assign(defaultState(), obj, { settings: Object.assign(defaultState().settings, obj.settings || {}) });
      saveState(); renderAll(); applyTheme();
      toast('imported ✨');
    } catch (e) { toast('invalid file'); }
  };
  r.readAsText(file);
}
function exportReport() {
  const { y, m } = state.viewMonth;
  const mk = `${y}-${String(m+1).padStart(2,'0')}`;
  const last = new Date(y, m+1, 0).getDate();
  let lines = [];
  lines.push(`# ${getMonthName(m)} ${y} — Cozy Mood Report`);
  lines.push('');
  if (state.monthNotes[mk]) lines.push(`> ${state.monthNotes[mk]}`);
  lines.push('');
  lines.push('## Daily Log');
  for (let d = 1; d <= last; d++) {
    const k = fmtDate(new Date(y, m, d));
    const data = state.days[k];
    if (!data) continue;
    const moodLabel = data.mood ? (findMoodByValue(data.mood)?.label || data.mood) : '';
    let line = `- **${k}**${moodLabel ? ' ['+moodLabel+']' : ''}`;
    if (data.note) line += ` — ${data.note}`;
    if (data.journal) line += `\n  > ${data.journal.replace(/\n/g, ' ')}`;
    const habits = state.habits.map(h => {
      const v = data.habits[h.id];
      return v ? `${h.icon}${v==='done'?'✓':'✗'}` : '';
    }).filter(Boolean).join(' ');
    if (habits) line += ` · ${habits}`;
    if (data.water) line += ` · 💧${data.water}`;
    if (data.sleep) line += ` · 😴${data.sleep}h`;
    if (data.steps) line += ` · 🚶${data.steps}`;
    if (data.cal) line += ` · 🔥${data.cal}`;
    lines.push(line);
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cozy-mood-report-${mk}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('report saved 📄');
}

// ───── reminders ─────
let reminderTimer = null;
function setupReminder() {
  if (reminderTimer) clearInterval(reminderTimer);
  if (!state.settings.reminder.enabled) return;
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  reminderTimer = setInterval(() => {
    const now = new Date();
    const [hh, mm] = state.settings.reminder.time.split(':').map(Number);
    if (now.getHours() === hh && now.getMinutes() === mm) {
      const key = todayKey();
      const day = state.days[key];
      if (!day || !day.mood) {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🌷 Cozy Mood', { body: 'How are you feeling today? Log your mood ✨' });
        } else {
          toast('🌷 time to log your mood today!');
        }
      }
    }
  }, 60 * 1000);
}

// ───── helpers ─────
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ───── master render ─────
function renderAll() {
  renderCalendar();
  renderHabits();
  renderMoodPickers();
  renderMonthNote();
  renderHealth();
  renderTodos();
  renderJournal();
  if ($('#tab-stats').classList.contains('active')) renderStats();
  if ($('#tab-archive').classList.contains('active')) renderArchive();
  if ($('#tab-settings').classList.contains('active')) renderSettings();
}

// ───── cloud UI ─────
async function refreshCloudUI() {
  const Cloud = window.Cloud;
  if (!Cloud) return;
  const card = $('#cloudCard');
  const status = $('#cloudStatus');
  const signedOut = $('#cloudSignedOut');
  const signedIn = $('#cloudSignedIn');

  // Cloud sync hidden entirely if developer hasn't configured backend
  if (!Cloud.isConfigured()) {
    card.classList.add('hidden');
    return;
  }
  card.classList.remove('hidden');

  if (!Cloud.hasLib()) {
    status.textContent = 'loading…';
    status.classList.remove('ok', 'bad');
    setTimeout(refreshCloudUI, 400);
    return;
  }

  if (!Cloud.isReady()) await Cloud.init();

  const u = Cloud.user();
  if (u) {
    status.textContent = '✓ signed in';
    status.classList.add('ok'); status.classList.remove('bad');
    signedOut.classList.add('hidden');
    signedIn.classList.remove('hidden');
    $('#cloudUserEmail').textContent = u.email || u.id;
    $('#cloudAuto').checked = Cloud.isAutoSync();
    const last = Cloud.lastSyncAt();
    $('#cloudLastSync').textContent = last ? `last sync: ${last.toLocaleTimeString()}` : '';
  } else {
    status.textContent = 'signed out';
    status.classList.remove('ok', 'bad');
    signedOut.classList.remove('hidden');
    signedIn.classList.add('hidden');
  }
}

// expose for cloud.js to call back into
window.refreshCloudUI = refreshCloudUI;

function initCloudUI() {
  if (!window.Cloud) {
    setTimeout(initCloudUI, 300);
    return;
  }
  const Cloud = window.Cloud;
  refreshCloudUI();

  $('#cloudSignUp').addEventListener('click', async () => {
    const email = $('#cloudEmail').value.trim();
    const pw = $('#cloudPassword').value;
    if (!email || pw.length < 6) { toast('email + 6+ char password'); return; }
    const r = await Cloud.signUp(email, pw);
    if (r.error) { toast('sign up failed: ' + r.error.message); return; }
    toast('account created ✨ now sign in');
    refreshCloudUI();
  });

  $('#cloudSignIn').addEventListener('click', async () => {
    const email = $('#cloudEmail').value.trim();
    const pw = $('#cloudPassword').value;
    if (!email || !pw) { toast('email + password please'); return; }
    const r = await Cloud.signIn(email, pw);
    if (r.error) { toast('sign in failed: ' + r.error.message); return; }
    toast('signed in ✿');
    $('#cloudEmail').value = '';
    $('#cloudPassword').value = '';
    refreshCloudUI();
    // try to pull on first sign-in
    try {
      const remote = await Cloud.pull();
      if (remote && remote.state) {
        if (confirm('cloud has saved data. download it now? (your current local data will be replaced — export it first if needed)')) {
          window.setCozyState(remote.state);
          toast('downloaded from cloud ✿');
        }
      }
    } catch (e) { console.warn(e); }
  });

  $('#cloudSignOut').addEventListener('click', async () => {
    await Cloud.signOut();
    Cloud.setAutoSync(false);
    toast('signed out');
    refreshCloudUI();
  });

  $('#cloudAuto').addEventListener('change', e => {
    Cloud.setAutoSync(e.target.checked);
    if (e.target.checked) {
      Cloud.scheduleSync();
      toast('auto-sync on');
    } else {
      toast('auto-sync off');
    }
  });

  $('#cloudPush').addEventListener('click', async () => {
    try {
      await Cloud.push();
      toast('uploaded ✿');
      refreshCloudUI();
    } catch (e) {
      toast('upload failed: ' + (e.message || e));
    }
  });

  $('#cloudPull').addEventListener('click', async () => {
    try {
      const remote = await Cloud.pull();
      if (!remote || !remote.state) { toast('nothing in cloud yet'); return; }
      if (!confirm('replace local data with cloud copy?')) return;
      window.setCozyState(remote.state);
      toast('downloaded ✿');
      refreshCloudUI();
    } catch (e) {
      toast('download failed: ' + (e.message || e));
    }
  });
}

// ───── init ─────
function init() {
  buildThemeRow();
  applyTheme();
  initTabs();

  // month nav
  $('#prevMonth').addEventListener('click', () => {
    let { y, m } = state.viewMonth;
    m--; if (m < 0) { m = 11; y--; }
    state.viewMonth = { y, m }; saveState(); renderAll();
  });
  $('#nextMonth').addEventListener('click', () => {
    let { y, m } = state.viewMonth;
    m++; if (m > 11) { m = 0; y++; }
    state.viewMonth = { y, m }; saveState(); renderAll();
  });
  $('#monthJump').addEventListener('change', e => {
    if (!e.target.value) return;
    const [yy, mm] = e.target.value.split('-').map(Number);
    state.viewMonth = { y: yy, m: mm - 1 };
    saveState(); renderAll();
  });

  // header
  $('#searchToggle').addEventListener('click', () => {
    const bar = $('#searchBar');
    bar.classList.toggle('hidden');
    const open = !bar.classList.contains('hidden');
    document.querySelector('.tab-bar').classList.toggle('with-search', open);
    if (open) $('#searchInput').focus();
  });
  $('#searchInput').addEventListener('input', e => performSearch(e.target.value));
  $('#themeToggle').addEventListener('click', () => {
    const idx = THEMES.findIndex(t => t.id === state.settings.theme);
    state.settings.theme = THEMES[(idx + 1) % THEMES.length].id;
    saveState(); applyTheme(); toast('theme · ' + state.settings.theme);
  });
  $('#darkToggle').addEventListener('click', () => {
    state.settings.dark = !state.settings.dark; saveState(); applyTheme();
  });
  $('#darkModeChk').addEventListener('change', e => {
    state.settings.dark = e.target.checked; saveState(); applyTheme();
  });
  $('#notifyToggle').addEventListener('click', async () => {
    const enabling = !state.settings.reminder.enabled;
    if (enabling && 'Notification' in window) {
      if (Notification.permission === 'default') {
        try { await Notification.requestPermission(); } catch (e) {}
      }
    }
    state.settings.reminder.enabled = enabling;
    saveState();
    setupReminder();
    updateBellState();
    toast(enabling ? '🔔 reminders on · ' + state.settings.reminder.time : '🔕 reminders off');
  });
  $('#menuToggle').addEventListener('click', () => {
    document.querySelector('.tab-btn[data-tab="settings"]').click();
  });

  // month note
  $('#monthNote').addEventListener('input', e => {
    const { y, m } = state.viewMonth;
    state.monthNotes[`${y}-${String(m+1).padStart(2,'0')}`] = e.target.value;
    saveState();
  });

  // habit add
  $('#addHabitBtn').addEventListener('click', () => {
    const name = prompt('habit name:'); if (!name) return;
    const icon = prompt('icon (emoji):', '✨') || '✨';
    state.habits.push({ id: uid(), name: name.trim(), icon: icon.trim() });
    saveState(); renderHabits(); renderCalendar();
  });
  $('#customHabitForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#newHabitName').value.trim();
    const icon = $('#newHabitIcon').value.trim() || '✨';
    if (!name) return;
    state.habits.push({ id: uid(), name, icon });
    $('#newHabitName').value = ''; $('#newHabitIcon').value = '';
    saveState(); renderHabits(); renderSettings(); renderCalendar();
  });

  // custom sticker
  $('#addCustomSticker').addEventListener('click', () => {
    const v = $('#customStickerInput').value.trim();
    if (!v) return;
    if (!state.customStickers.includes(v)) state.customStickers.push(v);
    $('#customStickerInput').value = '';
    saveState(); renderMoodPickers();
    toast('sticker added!');
  });

  // day modal
  $('#dayModalClose').addEventListener('click', closeDayModal);
  $('#dayModal').addEventListener('click', e => { if (e.target.id === 'dayModal') closeDayModal(); });

  // health
  $('#healthDate').value = healthDate;
  $('#healthDate').addEventListener('change', e => setHealthDate(e.target.value));
  $('#hPrevDay').addEventListener('click', () => {
    const d = parseDate(healthDate); d.setDate(d.getDate() - 1); setHealthDate(fmtDate(d));
  });
  $('#hNextDay').addEventListener('click', () => {
    const d = parseDate(healthDate); d.setDate(d.getDate() + 1); setHealthDate(fmtDate(d));
  });
  $('#waterPlus').addEventListener('click', () => {
    const day = ensureDay(healthDate); day.water = Math.min(20, (day.water || 0) + 1); saveState(); renderHealth();
  });
  $('#waterMinus').addEventListener('click', () => {
    const day = ensureDay(healthDate); day.water = Math.max(0, (day.water || 0) - 1); saveState(); renderHealth();
  });
  $('#sleepRange').addEventListener('input', e => {
    ensureDay(healthDate).sleep = +e.target.value; saveState(); renderHealth();
  });
  $('#stepInput').addEventListener('input', e => {
    ensureDay(healthDate).steps = +e.target.value || 0; saveState(); renderHealth();
  });
  $('#calInput').addEventListener('input', e => {
    ensureDay(healthDate).cal = +e.target.value || 0; saveState(); renderHealth();
  });

  // todo
  $('#todoDate').value = todoDate;
  $('#todoDate').addEventListener('change', e => setTodoDate(e.target.value));
  $('#tPrevDay').addEventListener('click', () => {
    const d = parseDate(todoDate); d.setDate(d.getDate() - 1); setTodoDate(fmtDate(d));
  });
  $('#tNextDay').addEventListener('click', () => {
    const d = parseDate(todoDate); d.setDate(d.getDate() + 1); setTodoDate(fmtDate(d));
  });
  $('#todoForm').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#todoInput').value.trim(); if (!v) return;
    const day = ensureDay(todoDate);
    day.todos = day.todos || [];
    day.todos.push({ id: uid(), text: v, done: false });
    $('#todoInput').value = '';
    saveState(); renderTodos();
  });
  $('#futureForm').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#futureInput').value.trim(); if (!v) return;
    const date = $('#futureDate').value || '';
    state.futureNotes.push({ id: uid(), text: v, date, done: false });
    $('#futureInput').value = ''; $('#futureDate').value = '';
    saveState(); renderTodos();
  });

  // journal
  $('#journalDate').value = journalDate;
  $('#journalDate').addEventListener('change', e => setJournalDate(e.target.value));
  $('#jPrevDay').addEventListener('click', () => {
    const d = parseDate(journalDate); d.setDate(d.getDate() - 1); setJournalDate(fmtDate(d));
  });
  $('#jNextDay').addEventListener('click', () => {
    const d = parseDate(journalDate); d.setDate(d.getDate() + 1); setJournalDate(fmtDate(d));
  });
  $('#journalText').addEventListener('input', e => {
    const day = ensureDay(journalDate);
    day.journal = e.target.value;
    $('#journalCount').textContent = e.target.value.length;
    saveState();
  });
  $('#specialDay').addEventListener('change', e => {
    const day = ensureDay(journalDate);
    day.special = e.target.checked;
    $('#specialBadge').textContent = day.special ? '✨ special day' : '';
    saveState();
  });

  // reminders
  $('#reminderEnabled').addEventListener('change', e => {
    state.settings.reminder.enabled = e.target.checked;
    saveState(); setupReminder(); updateBellState();
    if (e.target.checked && 'Notification' in window) Notification.requestPermission();
  });
  $('#reminderTime').addEventListener('change', e => {
    state.settings.reminder.time = e.target.value;
    saveState(); setupReminder();
  });
  $('#testReminder').addEventListener('click', async () => {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        try { await Notification.requestPermission(); } catch (e) {}
      }
      if (Notification.permission === 'granted') {
        new Notification('🌷 Cozy Mood', { body: 'this is what your daily reminder will look like ✨' });
        toast('test sent ✿');
        return;
      }
    }
    toast('🌷 notifications blocked · showing in-app toast instead');
  });

  // export / import
  $('#exportJson').addEventListener('click', exportData);
  $('#importJson').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', e => { if (e.target.files[0]) importData(e.target.files[0]); });
  $('#exportReport').addEventListener('click', exportReport);
  $('#clearData').addEventListener('click', () => {
    if (confirm('reset all data? this cannot be undone.')) {
      state = defaultState();
      saveState(); renderAll(); applyTheme();
    }
  });

  // cloud sync
  initCloudUI();

  // keyboard close modal
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDayModal(); });

  // first paint
  renderAll();
  setupReminder();
  updateBellState();

  // register service worker for offline / installable PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed:', err));
  }
}

document.addEventListener('DOMContentLoaded', init);
