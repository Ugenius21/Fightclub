'use strict';

/* =========================================================
   Fightclub – Trainings-, Körpergewicht- und Kalorien-Tracker
   Daten liegen lokal im Browser und werden – wenn angemeldet –
   über Supabase zwischen deinen Geräten synchronisiert.
   ========================================================= */

/** Wird im Profil angezeigt – so lässt sich prüfen, ob die neueste Version geladen ist. */
const APP_VERSION = '7';

const STORE_KEY = 'fightclub-data';
const DRAFT_KEY = 'fightclub-draft';

const COLORS = [
  ['Rot', '#E53935'], ['Blau', '#1E88E5'], ['Grün', '#43A047'], ['Orange', '#FB8C00'], ['Lila', '#8E24AA'],
  ['Türkis', '#00ACC1'], ['Pink', '#D81B60'], ['Gelb', '#FDD835'], ['Braun', '#6D4C41'], ['Grau', '#546E7A'],
];

const SAMPLE_PLANS = [
  ['Push', '#E53935', ['Bankdrücken', 'Schrägbankdrücken', 'Butterfly', 'Schulterdrücken', 'Seitheben', 'Trizepsdrücken']],
  ['Pull', '#43A047', ['Klimmzüge', 'Langhantelrudern', 'Latziehen', 'Face Pulls', 'Bizepscurls']],
  ['Beine', '#1E88E5', ['Kniebeugen', 'Beinpresse', 'Rumänisches Kreuzheben', 'Beinstrecker', 'Beinbeuger', 'Wadenheben']],
];

const POW_WORDS = ['POW!', 'BAM!', 'WUMMS!', 'ZACK!', 'KRACH!', 'BOOM!', 'WHAM!'];

/* =========================================================
   DATEN
   ========================================================= */

function loadData() {
  try { return FCData.normalize(JSON.parse(localStorage.getItem(STORE_KEY))); }
  catch (e) { return FCData.empty(); }
}

let data = loadData();
let draft = null;
try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch (e) { draft = null; }

function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
  catch (e) { alert('Speichern fehlgeschlagen: ' + e.message); }
}
/** Lokal speichern und (falls angemeldet) synchronisieren. */
function save() { persist(); Sync.schedule(); }

function saveDraft() {
  try {
    if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else localStorage.removeItem(DRAFT_KEY);
  } catch (e) { /* ignorieren */ }
}

/** Markiert einen Datensatz als geändert (für den Sync). */
function touch(rec) {
  rec.upd = Math.max(Date.now(), (data.deleted[rec.id] || 0) + 1);
  return rec;
}
function removeRec(coll, id) {
  data[coll] = data[coll].filter((r) => r.id !== id);
  data.deleted[id] = Date.now();
}
function touchSettings() { data.settings.upd = Date.now(); }

Sync.attach({
  getData: () => data,
  setData: (d) => {
    data = d;
    persist();
    const active = document.activeElement;
    if (!(active && /INPUT|TEXTAREA|SELECT/.test(active.tagName)) && $('#sheet').hidden) render();
  },
});

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* =========================================================
   HILFSFUNKTIONEN
   ========================================================= */

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s || '').trim().toLowerCase();
const fmtNum = (n, d = 1) => n == null || !isFinite(n) ? '–' : Number(n).toLocaleString('de-DE', { maximumFractionDigits: d });
const pad = (n) => String(n).padStart(2, '0');
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => dateStr(new Date());
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return dateStr(d); };
const fmtDate = (s, withYear = true) => { const [y, m, d] = s.split('-'); return withYear ? `${d}.${m}.${y}` : `${d}.${m}.`; };
const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const fmtDateLong = (s) => `${WEEKDAYS[parseDate(s).getDay()]}, ${fmtDate(s)}`;
const fmtTime = (sec) => `${Math.floor(sec / 60)}:${pad(Math.floor(sec % 60))}`;

const planById = (id) => data.plans.find((p) => p.id === id);
const planColor = (id) => (planById(id) || {}).color || '#546E7A';
const planName = (id) => (planById(id) || {}).name || 'Gelöschter Plan';

function sortedWorkouts() {
  return [...data.workouts].sort((a, b) => (b.date.localeCompare(a.date)) || ((b.created || 0) - (a.created || 0)));
}

/** Letzter Eintrag einer Übung (nach Name) vor bzw. am angegebenen Datum. */
function lastEntryFor(name, beforeDate, excludeId) {
  const n = norm(name);
  for (const w of sortedWorkouts()) {
    if (w.id === excludeId) continue;
    if (beforeDate && w.date > beforeDate) continue;
    const e = w.entries.find((x) => norm(x.name) === n && x.sets.length);
    if (e) return { workout: w, entry: e };
  }
  return null;
}

function setsSummary(sets) {
  return sets.map((s, i) => `${fmtNum(s.w, 2)}${i ? '' : ' kg'} × ${s.r ?? '–'}`).join(' · ');
}

function stripeBackground(colors) {
  if (colors.length === 1) return colors[0];
  const step = 100 / colors.length;
  return `linear-gradient(135deg, ${colors.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(', ')})`;
}

/* Notizen pro Übung (dauerhaft, z. B. Sitzposition) */
const noteId = (name) => 'n:' + norm(name);
function getNote(name) { const n = data.notes.find((x) => x.id === noteId(name)); return n ? n.text : ''; }
function setNote(name, text) {
  const id = noteId(name);
  const n = data.notes.find((x) => x.id === id);
  text = text.trim();
  if (!text) { if (n) removeRec('notes', id); return; }
  if (n) { n.text = text; n.name = name; touch(n); }
  else data.notes.push(touch({ id, name, text }));
}

function toast(msg) {
  $$('.toast').forEach((x) => x.remove());
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1900);
}

function pow(anchor) {
  const r = anchor.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'pow';
  el.style.left = Math.min(window.innerWidth - 135, Math.max(5, r.left + r.width / 2 - 65)) + 'px';
  el.style.top = Math.max(60, r.top - 85) + 'px';
  const pts = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rad = i % 2 ? 30 : 54;
    pts.push(`${65 + Math.cos(a) * rad * 1.15},${55 + Math.sin(a) * rad * .95}`);
  }
  el.innerHTML = `<svg viewBox="0 0 130 110"><polygon points="${pts.join(' ')}" fill="#ffd23f" stroke="#17120f" stroke-width="3" stroke-linejoin="round"/></svg>
    <span>${POW_WORDS[Math.floor(Math.random() * POW_WORDS.length)]}</span>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

/* Kurzer Ton am Ende der Pause (iOS erlaubt Audio erst nach einem Tipp) */
let audioCtx = null;
function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { audioCtx = null; }
}
function beep() {
  if (!audioCtx || !data.settings.sound) return;
  [0, 0.22, 0.44].forEach((t, i) => {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'square';
    o.frequency.value = i === 2 ? 1175 : 880;
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.15, audioCtx.currentTime + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + t + 0.18);
    o.connect(g).connect(audioCtx.destination);
    o.start(audioCtx.currentTime + t);
    o.stop(audioCtx.currentTime + t + 0.2);
  });
}

async function shareFile(bytesOrText, name, mime) {
  const file = new File([bytesOrText], name, { type: mime });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* =========================================================
   NAVIGATION
   ========================================================= */

const nav = { tab: 'plans', stack: [] };
const current = () => nav.stack[nav.stack.length - 1] || { view: nav.tab };

/** Inhalt nach oben scrollen (die Seite selbst scrollt nicht, nur <main>). */
const scrollTop = () => { $('#view').scrollTop = 0; };

function go(view, params = {}) { nav.stack.push({ view, ...params }); render(); scrollTop(); }
function back() { nav.stack.pop(); render(); scrollTop(); }
function switchTab(tab) { nav.tab = tab; nav.stack = []; render(); scrollTop(); }

$('#backBtn').addEventListener('click', back);
$$('.tabbar button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

function setHeader(title, actionHtml = '') {
  $('#title').textContent = title;
  $('#backBtn').classList.toggle('off', nav.stack.length === 0);
  $('#topAction').innerHTML = actionHtml;
  $$('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === nav.tab));
  requestAnimationFrame(() => document.documentElement.style.setProperty('--topbar-h', $('.topbar').offsetHeight + 'px'));
}

function render() {
  const c = current();
  document.body.classList.toggle('workout-mode', c.view === 'workout');
  document.body.classList.toggle('food-mode', c.view === 'food');
  if (Keypad.isOpen() && Keypad.owner() !== c.view) Keypad.close();
  if (c.view !== 'workout') $('#timerHolder').innerHTML = '';
  const views = { plans: viewPlans, plan: viewPlan, workout: viewWorkout, calendar: viewCalendar, progress: viewProgress, food: viewNutrition, profile: viewProfile };
  (views[c.view] || viewPlans)(c);
}

/* =========================================================
   SHEET (Dialog von unten)
   ========================================================= */

function openSheet(html, onMount) {
  if (Keypad.isOpen()) Keypad.close();
  $('#sheetCard').innerHTML = html;
  $('#sheet').hidden = false;
  $('#sheetCard').scrollTop = 0;
  if (onMount) onMount($('#sheetCard'));
}
function closeSheet() { $('#sheet').hidden = true; $('#sheetCard').innerHTML = ''; }
$('.sheet-backdrop').addEventListener('click', closeSheet);

function colorPicker(selected) {
  return `<div class="colors">${COLORS.map(([n, h]) =>
    `<button type="button" data-color="${h}" aria-label="${n}" class="${h === selected ? 'on' : ''}" style="background:${h}"></button>`).join('')}</div>`;
}
function bindColorPicker(root, onPick) {
  $$('[data-color]', root).forEach((b) => b.addEventListener('click', () => {
    $$('[data-color]', root).forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    onPick(b.dataset.color);
  }));
}

/** Liste per Ziehen am Griff (≡) neu sortieren. */
function reorderSheet(title, items, onSave, extraHtml = '') {
  openSheet(`
    <h2>${esc(title)}</h2>
    <p class="hint">Halte den Griff <b>≡</b> und ziehe die Übung an die gewünschte Stelle.</p>
    <ul class="reorder" id="reorderList">
      ${items.map((it, i) => `<li data-i="${i}"><span class="n">${i + 1}</span><span class="t">${esc(it)}</span><button class="handle" aria-label="Verschieben">≡</button></li>`).join('')}
    </ul>
    ${extraHtml}
    <button class="btn primary" id="reorderSave" style="margin-top:16px">Übernehmen</button>
    <button class="btn danger" id="reorderCancel">Abbrechen</button>
  `, (root) => {
    const list = $('#reorderList', root);
    const renumber = () => $$('li', list).forEach((li, i) => { $('.n', li).textContent = i + 1; });
    $$('.handle', list).forEach((h) => {
      h.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const li = h.closest('li');
        h.setPointerCapture(e.pointerId);
        li.classList.add('dragging');
        // Nur die Nachbarn verschieben – das gezogene Element bleibt im DOM,
        // sonst geht der „Finger“ (Pointer-Capture) verloren.
        const mid = (el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };
        const move = (ev) => {
          const y = ev.clientY;
          let next = li.nextElementSibling;
          while (next && y > mid(next)) { li.before(next); next = li.nextElementSibling; }
          let prev = li.previousElementSibling;
          while (prev && y < mid(prev)) { li.after(prev); prev = li.previousElementSibling; }
          renumber();
        };
        const up = () => {
          li.classList.remove('dragging');
          h.removeEventListener('pointermove', move);
          h.removeEventListener('pointerup', up);
          h.removeEventListener('pointercancel', up);
        };
        h.addEventListener('pointermove', move);
        h.addEventListener('pointerup', up);
        h.addEventListener('pointercancel', up);
      });
    });
    $('#reorderCancel').onclick = closeSheet;
    $('#reorderSave').onclick = () => {
      const order = $$('li', list).map((li) => Number(li.dataset.i));
      const extra = {};
      $$('input[type="checkbox"]', root).forEach((c) => { extra[c.id] = c.checked; });
      closeSheet();
      onSave(order, extra);
    };
  });
}

/* =========================================================
   ZAHLENFELD (statt iOS-Tastatur)
   ========================================================= */

const Keypad = (() => {
  const el = $('#keypad');
  let o = null;
  let idx = 0;
  let fresh = true;
  let buf = '';

  const field = () => o.fields[idx];
  const setHeight = (h) => document.documentElement.style.setProperty('--kp-h', h + 'px');

  function parse(s) {
    if (s === '' || s === ',') return null;
    const n = parseFloat(s.replace(',', '.'));
    return isFinite(n) ? n : null;
  }

  function display() {
    const f = field();
    const v = f.get();
    const txt = !fresh ? (buf || '0') : v == null ? '–' : fmtNum(v, f.decimals ?? 2);
    return `${esc(txt)}<small>${esc(f.unit || '')}</small>`;
  }

  function draw() {
    const f = field();
    const many = o.fields.length > 1;
    el.innerHTML = `<div class="kp-inner">
      <div class="kp-head">
        <div class="kp-title">${o.title ? o.title(f, idx) : `<b>${esc(f.label)}</b>`}</div>
        ${o.onCancel ? '<button class="ibtn" data-k="cancel" aria-label="Abbrechen">✕</button>' : ''}
      </div>
      ${typeof o.extraHtml === 'function' ? o.extraHtml() : (o.extraHtml || '')}
      ${o.chips && many ? `<div class="kp-chips">${o.fields.map((x, i) => `<button data-chip="${i}" class="${i === idx ? 'on' : ''}">${esc(x.label)}<b>${x.get() == null ? '–' : fmtNum(x.get(), x.decimals ?? 1)}</b></button>`).join('')}</div>` : ''}
      <div class="kp-display">
        <button class="kp-step" data-k="minus">−${fmtNum(f.step, 2)}</button>
        <div class="v" id="kpValue">${display()}</div>
        <button class="kp-step" data-k="plus">+${fmtNum(f.step, 2)}</button>
      </div>
      <div class="kp-grid">
        <button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button><button data-k="back" class="muted-key">⌫</button>
        <button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button>
        ${many ? '<button data-k="next" class="next">Weiter ›</button>' : '<button data-k="clear" class="next" style="background:var(--soft);color:var(--ink);text-shadow:none">C</button>'}
        <button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button>
        <button data-k="comma" ${f.int ? 'disabled style="opacity:.3"' : ''}>,</button><button data-k="0">0</button>
        <button data-k="ok" class="ok" style="grid-column: span 2">${esc(o.okLabel || 'Fertig')}</button>
      </div>
    </div>`;
    $$('[data-k]', el).forEach((b) => b.addEventListener('click', () => press(b.dataset.k)));
    $$('[data-chip]', el).forEach((b) => b.addEventListener('click', () => focus(Number(b.dataset.chip))));
    if (o.onDraw) o.onDraw(el);
    requestAnimationFrame(() => setHeight(el.offsetHeight));
  }

  function refreshValue() {
    const v = $('#kpValue', el);
    if (v) v.innerHTML = display();
    const chip = $(`[data-chip="${idx}"] b`, el);
    if (chip) { const x = field().get(); chip.textContent = x == null ? '–' : fmtNum(x, field().decimals ?? 1); }
  }

  function commit(v) {
    field().set(v);
    if (o.onChange) o.onChange(field(), idx);
    refreshValue();
  }

  function press(k) {
    const f = field();
    if (/^\d$/.test(k)) {
      if (fresh) { buf = k; fresh = false; }
      else {
        const dec = buf.split(',')[1];
        if (buf.length >= 6) return;
        if (dec !== undefined && dec.length >= (f.decimals ?? 2)) return;
        buf = buf === '0' ? k : buf + k;
      }
      return commit(parse(buf));
    }
    if (k === 'comma') {
      if (f.int) return;
      if (fresh) { buf = '0,'; fresh = false; }
      else if (!buf.includes(',')) buf = (buf || '0') + ',';
      return refreshValue();
    }
    if (k === 'back') {
      if (fresh) { buf = ''; fresh = false; }
      else buf = buf.slice(0, -1);
      return commit(parse(buf));
    }
    if (k === 'clear') { buf = ''; fresh = false; return commit(null); }
    if (k === 'plus' || k === 'minus') {
      const cur = f.get() ?? (f.fallback ? f.fallback() : 0) ?? 0;
      let v = cur + (k === 'plus' ? f.step : -f.step);
      v = Math.max(0, Math.round(v * 100) / 100);
      fresh = true;
      return commit(v);
    }
    if (k === 'next') {
      if (idx < o.fields.length - 1) return focus(idx + 1);
      return done();
    }
    if (k === 'ok') return done();
    if (k === 'cancel') { const cb = o.onCancel; close(); cb(); }
  }

  function focus(i) {
    idx = Math.max(0, Math.min(o.fields.length - 1, i));
    fresh = true;
    buf = '';
    draw();
    if (o.onFocus) o.onFocus(field(), idx);
  }

  function open(opts, start = 0) {
    if (!$('#sheet').hidden) closeSheet();
    o = opts;
    el.hidden = false;
    focus(start);
  }

  function done() { const cb = o && o.onDone; close(); if (cb) cb(); }

  function close() {
    if (!o) return;
    const cb = o.onClose;
    o = null;
    el.hidden = true;
    el.innerHTML = '';
    setHeight(0);
    if (cb) cb();
  }

  /** Neue Feldliste nach einem Neuzeichnen übernehmen (gleicher Schlüssel bleibt aktiv). */
  function update(fields) {
    if (!o) return;
    const key = field().key;
    o.fields = fields;
    const i = fields.findIndex((f) => f.key === key);
    if (i < 0) return close();
    idx = i;
    if (o.onFocus) o.onFocus(field(), idx);
  }

  /** Wert von außen setzen (z. B. Mengen-Knöpfe „100 g“). */
  function set(v) {
    if (!o) return;
    fresh = true;
    buf = '';
    commit(v);
  }

  return {
    open, close, update, set,
    isOpen: () => !!o,
    owner: () => o && o.owner,
    focusKey: (key) => { if (!o) return false; const i = o.fields.findIndex((f) => f.key === key); if (i < 0) return false; focus(i); return true; },
    currentKey: () => (o ? field().key : null),
  };
})();

/* =========================================================
   TRAINING – START
   ========================================================= */

function viewPlans() {
  setHeader('Fightclub', `<button class="top-chip" id="addPlan">＋ Plan</button>`);
  const v = $('#view');
  const today = todayStr();

  // Wochenübersicht Mo–So
  const monday = addDays(today, -((parseDate(today).getDay() + 6) % 7));
  let weekCount = 0;
  const week = Array.from({ length: 7 }, (_, i) => {
    const ds = addDays(monday, i);
    const ws = data.workouts.filter((w) => w.date === ds);
    weekCount += ws.length;
    const colors = [...new Set(ws.map((w) => planColor(w.planId)))];
    return `<div class="${ds === today ? 'today' : ''}">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][i]}<i style="${colors.length ? `background:${stripeBackground(colors)}` : ''}"></i></div>`;
  }).join('');

  let html = `<div class="hero panel">
    <h2>${weekCount ? `${weekCount} ${weekCount === 1 ? 'Kampf' : 'Kämpfe'} diese Woche!` : 'Bereit für den Kampf?'}</h2>
    <div class="week">${week}</div>
  </div>`;

  if (draft) {
    html += `<button class="resume" id="resume">
      <span style="font-size:34px">🥊</span>
      <div class="grow"><div class="big">Kampf läuft: ${esc(planName(draft.planId))}</div>
      <div class="small">${draft.started ? `<b id="resumeTime">${draft.pausedAt ? '⏸' : '⏱'} ${fmtClock(elapsedMs(draft))}</b> · ` : ''}Tippen zum Weitermachen</div></div>
      <span class="big">›</span></button>`;
  }

  if (!data.plans.length) {
    html += `<div class="empty"><div class="big">🥊</div>
      <p>Willkommen im Fightclub!<br>Leg deinen ersten Trainingsplan an, z. B. „Push“.</p></div>
      <button class="btn primary" id="firstPlan">Plan erstellen</button>
      <button class="btn yellow" id="samples">Beispielpläne laden</button>`;
  } else {
    html += data.plans.map((p) => {
      const last = sortedWorkouts().find((w) => w.planId === p.id);
      return `<div class="plan-card" style="background-color:${p.color}">
        <button class="info" data-plan="${p.id}">
          <div class="name">${esc(p.name)}</div>
          <span class="sticker">${p.exercises.length} Übung${p.exercises.length === 1 ? '' : 'en'}${last ? ' · zuletzt ' + fmtDate(last.date, false) : ''}</span>
        </button>
        <button class="start-btn" data-start="${p.id}">Start!</button>
      </div>`;
    }).join('');
    html += `<button class="btn dashed" id="newPlan">＋ Neuer Plan</button>`;
  }

  v.innerHTML = html;
  $('#addPlan').onclick = () => planEditor();
  if ($('#newPlan')) $('#newPlan').onclick = () => planEditor();
  if ($('#firstPlan')) $('#firstPlan').onclick = () => planEditor();
  if ($('#samples')) $('#samples').onclick = createSamples;
  if ($('#resume')) $('#resume').onclick = () => go('workout');
  $$('[data-plan]', v).forEach((b) => b.onclick = () => go('plan', { planId: b.dataset.plan }));
  $$('[data-start]', v).forEach((b) => b.onclick = () => startWorkout(b.dataset.start, todayStr()));
}

function createSamples() {
  for (const [name, color, exs] of SAMPLE_PLANS) {
    data.plans.push(touch({ id: uid(), name, color, exercises: exs.map((n) => ({ id: uid(), name: n })) }));
  }
  save();
  render();
}

function planEditor(plan) {
  const isNew = !plan;
  const used = data.plans.map((p) => p.color);
  let color = plan ? plan.color : (COLORS.find(([, h]) => !used.includes(h)) || COLORS[0])[1];
  openSheet(`
    <h2>${isNew ? 'Neuer Plan' : 'Plan bearbeiten'}</h2>
    <label class="lbl">Name</label>
    <input class="field" id="planName" placeholder="z. B. Push" value="${esc(plan ? plan.name : '')}" autocomplete="off" enterkeyhint="done">
    <label class="lbl">Farbe im Kalender</label>
    ${colorPicker(color)}
    <div style="height:20px"></div>
    <button class="btn primary" id="savePlan">${isNew ? 'Erstellen' : 'Speichern'}</button>
    ${isNew ? '' : '<button class="btn danger" id="delPlan">Plan löschen</button>'}
    <button class="btn danger" id="cancel" style="color:var(--muted)">Abbrechen</button>
  `, (root) => {
    bindColorPicker(root, (c) => { color = c; });
    $('#cancel').onclick = closeSheet;
    $('#planName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#savePlan').click(); });
    $('#savePlan').onclick = () => {
      const name = $('#planName').value.trim();
      if (!name) { $('#planName').focus(); return; }
      if (isNew) {
        const p = touch({ id: uid(), name, color, exercises: [] });
        data.plans.push(p);
        save(); closeSheet(); go('plan', { planId: p.id });
      } else {
        plan.name = name; plan.color = color; touch(plan);
        save(); closeSheet(); render();
      }
    };
    if ($('#delPlan')) $('#delPlan').onclick = () => {
      if (!confirm(`„${plan.name}“ löschen? Gespeicherte Trainings bleiben erhalten.`)) return;
      removeRec('plans', plan.id);
      save(); closeSheet(); back();
    };
  });
}

function viewPlan({ planId }) {
  const plan = planById(planId);
  if (!plan) { nav.stack.pop(); render(); return; }
  setHeader(plan.name, `<button class="top-chip" id="editPlan">✎</button>`);
  const v = $('#view');

  const exHtml = plan.exercises.map((ex, i) => {
    const last = lastEntryFor(ex.name);
    const note = getNote(ex.name);
    return `<button class="row-item" data-ex="${i}">
      <span class="ex-num" style="background:${plan.color}">${i + 1}</span>
      <div class="grow"><div class="t">${esc(ex.name)}</div>
      <div class="s">${last ? `Zuletzt ${fmtDate(last.workout.date, false)}: ${setsSummary(last.entry.sets)}` : 'Noch nicht trainiert'}</div>
      ${note ? `<div class="s">💬 ${esc(note)}</div>` : ''}</div>
      <span class="chev">›</span></button>`;
  }).join('');

  v.innerHTML = `
    <div class="plan-card" style="background-color:${plan.color}">
      <div class="info"><div class="name">${esc(plan.name)}</div><span class="sticker">${plan.exercises.length} Übungen</span></div>
      <button class="start-btn" id="start">Start!</button>
    </div>
    <div class="row"><span class="label">Übungen</span><span class="grow"></span>
      ${plan.exercises.length > 1 ? '<button class="ibtn" id="reorder" aria-label="Reihenfolge ändern">⇅</button>' : ''}</div>
    ${exHtml || '<div class="panel hint">Noch keine Übungen. Füge z. B. Bankdrücken oder Butterfly hinzu.</div>'}
    <button class="btn dashed" id="addEx">＋ Übung hinzufügen</button>`;

  $('#editPlan').onclick = () => planEditor(plan);
  $('#start').onclick = () => startWorkout(plan.id, todayStr());
  $('#addEx').onclick = () => addExerciseSheet((name) => { plan.exercises.push({ id: uid(), name }); touch(plan); save(); render(); });
  if ($('#reorder')) $('#reorder').onclick = () => reorderSheet('Reihenfolge', plan.exercises.map((e) => e.name), (order) => {
    plan.exercises = order.map((i) => plan.exercises[i]);
    touch(plan); save(); render();
  });
  $$('[data-ex]', v).forEach((b) => b.onclick = () => exerciseMenu(plan, Number(b.dataset.ex)));
}

/** Mehrere Übungen schnell hintereinander hinzufügen. */
function addExerciseSheet(onAdd) {
  const known = [...new Set(data.plans.flatMap((p) => p.exercises.map((e) => e.name)))].sort((a, b) => a.localeCompare(b, 'de'));
  openSheet(`
    <h2>Übung hinzufügen</h2>
    <div class="row">
      <input class="field grow" id="exName" placeholder="z. B. Bankdrücken" list="exList" autocomplete="off" enterkeyhint="done">
      <button class="btn primary" id="exAdd" style="width:auto;padding:12px 18px 9px">＋</button>
    </div>
    <datalist id="exList">${known.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
    <p class="hint" id="exAdded">Tipp: Mit „Return“ kannst du direkt die nächste Übung eintippen.</p>
    <button class="btn yellow" id="exDone">Fertig</button>
  `, () => {
    const input = $('#exName');
    const added = [];
    const add = () => {
      const name = input.value.trim();
      if (!name) { input.focus(); return; }
      onAdd(name);
      added.push(name);
      $('#exAdded').innerHTML = 'Hinzugefügt: <b>' + added.map(esc).join(', ') + '</b>';
      input.value = '';
      input.focus();
    };
    $('#exAdd').onclick = add;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    $('#exDone').onclick = () => { if (input.value.trim()) add(); closeSheet(); };
    setTimeout(() => input.focus(), 60);
  });
}

function exerciseMenu(plan, idx) {
  const ex = plan.exercises[idx];
  openSheet(`
    <h2>${esc(ex.name)}</h2>
    <label class="lbl">Name</label>
    <input class="field" id="exRename" value="${esc(ex.name)}" autocomplete="off">
    <label class="lbl">📝 Notiz (z. B. Sitzposition, Einstellung, Griff)</label>
    <textarea class="field" id="exNote" rows="3" placeholder="z. B. Sitz Stufe 4, Lehne 2. Loch">${esc(getNote(ex.name))}</textarea>
    <div style="height:16px"></div>
    <button class="btn primary" id="exSave">Speichern</button>
    <button class="btn" id="exProg">📈 Fortschritt ansehen</button>
    <button class="btn danger" id="exDel">Aus Plan entfernen</button>
  `, () => {
    $('#exSave').onclick = () => {
      const name = $('#exRename').value.trim();
      if (!name) return;
      const oldName = ex.name;
      if (name !== oldName) {
        // Verlauf mit umbenennen, damit Fortschritt und „Letztes Mal“ erhalten bleiben.
        data.workouts.forEach((w) => {
          let changed = false;
          w.entries.forEach((e) => { if (e.exerciseId === ex.id || norm(e.name) === norm(oldName)) { e.name = name; changed = true; } });
          if (changed) touch(w);
        });
        if (getNote(oldName)) setNote(oldName, '');
        ex.name = name;
        touch(plan);
      }
      setNote(name, $('#exNote').value);
      save(); closeSheet(); render();
    };
    $('#exProg').onclick = () => { closeSheet(); progressState.name = ex.name; switchTab('progress'); };
    $('#exDel').onclick = () => {
      if (!confirm(`„${ex.name}“ aus dem Plan entfernen? Der Verlauf bleibt erhalten.`)) return;
      plan.exercises.splice(idx, 1);
      touch(plan); save(); closeSheet(); render();
    };
  });
}

/* =========================================================
   TRAINING – ERFASSEN
   ========================================================= */

/** Neue Übung im Training – vorbelegt mit den Werten vom letzten Mal. */
function newEntry(ex, date) {
  const last = lastEntryFor(ex.name, date);
  const sets = last ? last.entry.sets.map((s) => ({ w: s.w, r: s.r, ghost: true })) : [{ w: null, r: null }];
  return { exerciseId: ex.id, name: ex.name, sets, note: '' };
}

function startWorkout(planId, date) {
  if (draft && !confirm('Es läuft bereits ein Training. Verwerfen und neu beginnen?')) { go('workout'); return; }
  const plan = planById(planId);
  draft = { id: uid(), planId, date, isNew: true, started: date === todayStr() ? Date.now() : null, pausedMs: 0, pausedAt: null, entries: plan.exercises.map((ex) => newEntry(ex, date)) };
  saveDraft();
  go('workout');
}

function editWorkout(w) {
  if (draft && !confirm('Es läuft bereits ein Training. Verwerfen?')) return;
  draft = JSON.parse(JSON.stringify(w));
  draft.isNew = false;
  draft.entries.forEach((e) => { e.note = e.note || ''; e.sets.forEach((s) => { s.done = true; }); });
  saveDraft();
  go('workout');
}

/* Pausen-Timer */
const rest = { end: 0, total: 0, timer: null, overUntil: 0 };

function startRest() {
  rest.total = data.settings.restSec || 90;
  rest.end = Date.now() + rest.total * 1000;
  rest.overUntil = 0;
  clearInterval(rest.timer);
  rest.timer = setInterval(tickRest, 250);
  tickRest();
}
function stopRest() { rest.end = 0; rest.overUntil = 0; clearInterval(rest.timer); drawRest(); }
function tickRest() {
  if (!rest.end) return;
  const left = (rest.end - Date.now()) / 1000;
  if (left <= 0 && !rest.overUntil) { rest.overUntil = Date.now() + 5000; beep(); }
  if (rest.overUntil && Date.now() > rest.overUntil) { stopRest(); return; }
  drawRest();
}
function restHtml() {
  if (!rest.end) return '';
  const left = Math.max(0, (rest.end - Date.now()) / 1000);
  const over = left <= 0;
  return `<div class="rest ${over ? 'over' : ''}" id="rest">
    <div class="t">${over ? 'Los geht’s! 🥊' : fmtTime(Math.ceil(left))}${over ? '' : '<small>Pause</small>'}</div>
    ${over ? '' : '<button data-rest="plus">+30</button><button data-rest="skip">Skip</button>'}
    <div class="bar" style="width:${over ? 100 : (1 - left / rest.total) * 100}%"></div>
  </div>`;
}
function drawRest() {
  const holder = $('#restHolder');
  if (!holder) return;
  holder.innerHTML = restHtml();
  $$('[data-rest]', holder).forEach((b) => b.onclick = () => {
    if (b.dataset.rest === 'plus') { rest.end += 30000; rest.total += 30; tickRest(); }
    else stopRest();
  });
}

/* Trainings-Timer: startet mit dem Training, läuft auch bei geschlossener App weiter
   (berechnet aus dem Startzeitpunkt) und lässt sich pausieren. */
function elapsedMs(d) {
  if (!d || !d.started) return 0;
  return Math.max(0, (d.pausedAt || Date.now()) - d.started - (d.pausedMs || 0));
}
function fmtClock(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  return h ? `${h}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` : `${Math.floor(s / 60)}:${pad(s % 60)}`;
}
const fmtDur = (min) => (min >= 60 ? `${Math.floor(min / 60)}:${pad(min % 60)} h` : `${min} min`);

function toggleTimer() {
  if (!draft) return;
  if (!draft.started) { draft.started = Date.now(); draft.pausedMs = 0; draft.pausedAt = null; }
  else if (draft.pausedAt) { draft.pausedMs = (draft.pausedMs || 0) + (Date.now() - draft.pausedAt); draft.pausedAt = null; }
  else draft.pausedAt = Date.now();
  saveDraft();
  drawTimer();
}

function timerHtml() {
  if (!draft) return '';
  if (!draft.isNew && !draft.started) {
    return `<div class="wo-timer" id="woTimer"><span class="time">⏱ ${draft.dur ? fmtDur(draft.dur) : '–'}</span><span class="lbl2 grow">Dauer dieses Trainings</span></div>`;
  }
  if (!draft.started) {
    return `<div class="wo-timer" id="woTimer"><span class="time">⏱ 0:00</span><span class="lbl2 grow">Timer läuft noch nicht</span><button data-timer>▶ Start</button></div>`;
  }
  const paused = !!draft.pausedAt;
  return `<div class="wo-timer ${paused ? 'paused' : ''}" id="woTimer">
    <span class="time" id="woTime">⏱ ${fmtClock(elapsedMs(draft))}</span>
    <span class="lbl2 grow">${paused ? 'Pausiert' : 'Trainingszeit'}</span>
    <button data-timer aria-label="${paused ? 'Timer fortsetzen' : 'Timer pausieren'}">${paused ? '▶ Weiter' : '⏸ Pause'}</button>
  </div>`;
}
function drawTimer() {
  const holder = $('#timerHolder');
  if (!holder) return;
  holder.innerHTML = timerHtml();
  const b = $('[data-timer]', holder);
  if (b) b.onclick = toggleTimer;
}

/* Ein Takt pro Sekunde für Trainings-Timer und „Kampf läuft“-Banner */
setInterval(() => {
  if (!draft || !draft.started) return;
  const t = fmtClock(elapsedMs(draft));
  const el = $('#woTime');
  if (el) el.textContent = '⏱ ' + t;
  const banner = $('#resumeTime');
  if (banner) banner.textContent = draft.pausedAt ? '⏸ ' + t : '⏱ ' + t;
}, 1000);

function workoutFields() {
  const fields = [];
  draft.entries.forEach((e, ei) => e.sets.forEach((s, si) => {
    const base = { ei, si, entry: e };
    fields.push({
      ...base, key: `${ei}:${si}:w`, label: 'Gewicht', unit: 'kg', decimals: 2, step: 2.5,
      get: () => s.w, set: (v) => { s.w = v; s.ghost = false; },
      fallback: () => (si > 0 ? e.sets[si - 1].w : 0),
    });
    fields.push({
      ...base, key: `${ei}:${si}:r`, label: 'Wiederholungen', unit: 'Wdh.', int: true, decimals: 0, step: 1,
      get: () => s.r, set: (v) => { s.r = v == null ? null : Math.round(v); s.ghost = false; },
      fallback: () => (si > 0 ? e.sets[si - 1].r : 0),
    });
  }));
  return fields;
}

function valHtml(v, unit, decimals) {
  return v == null ? `<span class="u">${unit}</span>` : `${fmtNum(v, decimals)}<span class="u">${unit}</span>`;
}

function viewWorkout() {
  if (!draft) { nav.stack.pop(); render(); return; }
  const color = planColor(draft.planId);
  setHeader(planName(draft.planId), draft.entries.length > 1 ? `<button class="top-chip" id="woReorder" aria-label="Reihenfolge">⇅</button>` : '');
  const v = $('#view');

  const chips = draft.entries.map((e, ei) => {
    const done = e.sets.filter((s) => s.done).length;
    const cls = done && done >= e.sets.length ? 'full' : done ? 'part' : '';
    return `<button class="ex-chip ${cls}" data-jump="${ei}">${esc(e.name)}<b>${done}/${e.sets.length}</b></button>`;
  }).join('');

  const cards = draft.entries.map((e, ei) => {
    const last = lastEntryFor(e.name, draft.date, draft.id);
    const perm = getNote(e.name);
    const rows = e.sets.map((s, si) => `
      <div class="set-row ${s.done ? 'done' : ''}">
        <button class="set-nr" data-setmenu="${ei}:${si}">${si + 1}</button>
        <button class="val ${s.ghost ? 'ghost' : ''} ${s.w == null ? 'empty-val' : ''}" data-f="${ei}:${si}:w">${valHtml(s.w, 'kg', 2)}</button>
        <button class="val ${s.ghost ? 'ghost' : ''} ${s.r == null ? 'empty-val' : ''}" data-f="${ei}:${si}:r">${valHtml(s.r, 'Wdh', 0)}</button>
        <button class="chk" data-chk="${ei}:${si}" aria-label="Satz erledigt">✓</button>
      </div>`).join('');
    return `<section class="panel ex-card" id="ex-${ei}">
      <div class="ex-top">
        <span class="ex-num" style="background:${color}">${ei + 1}</span>
        <h3 class="ex-name">${esc(e.name)}</h3>
        <div class="ex-actions">
          <button class="ibtn ${perm || e.note ? 'on' : ''}" data-note="${ei}" aria-label="Notiz">📝</button>
          <button class="ibtn" data-later="${ei}" aria-label="Später machen">⏭</button>
          <button class="ibtn" data-exmenu="${ei}" aria-label="Mehr">⋯</button>
        </div>
      </div>
      ${perm ? `<div class="bubble">${esc(perm)}</div>` : ''}
      ${e.note ? `<div class="bubble today"><small>Heute</small>${esc(e.note)}</div>` : ''}
      <div class="last">${last ? `Letztes Mal (${fmtDate(last.workout.date, false)}): <b>${setsSummary(last.entry.sets)}</b>${last.entry.note ? ` · „${esc(last.entry.note)}“` : ''}` : 'Erstes Training dieser Übung – zeig, was du kannst!'}</div>
      <div class="sets-head"><span>Satz</span><span>Gewicht</span><span>Wdh.</span><span>✓</span></div>
      ${rows}
      <button class="add-set" data-addset="${ei}">＋ Satz</button>
    </section>`;
  }).join('');

  const totalSets = draft.entries.reduce((a, e) => a + e.sets.length, 0);
  const doneSets = draft.entries.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);

  v.innerHTML = `
    <div class="wo-head">
      <input type="date" class="field" id="wDate" value="${draft.date}" aria-label="Datum">
    </div>
    ${draft.entries.length > 1 ? `<div class="ex-strip">${chips}</div>` : ''}
    ${cards || '<div class="panel hint">Dieser Plan hat noch keine Übungen.</div>'}
    <button class="btn dashed" id="wAddEx">＋ Übung hinzufügen</button>
    <div style="height:18px"></div>
    ${draft.isNew ? '<button class="btn danger" id="wDiscard">Training verwerfen</button>' : '<button class="btn danger" id="wDelete">Training löschen</button>'}
    <div id="restHolder"></div>
    <div class="wo-footer">
      <div class="clock">${doneSets}/${totalSets}<small>Sätze</small></div>
      <button class="btn primary" id="wSave">${draft.isNew ? 'K.O. – Beenden!' : 'Speichern'}</button>
    </div>`;

  drawRest();
  drawTimer();

  const fields = workoutFields();
  const highlight = (key) => {
    $$('.val.active', v).forEach((x) => x.classList.remove('active'));
    const el = key && $(`[data-f="${key}"]`, v);
    if (el) {
      el.classList.add('active');
      // Feld oberhalb des Zahlenfelds sichtbar halten
      requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const kp = $('#keypad').offsetHeight || 0;
        const bottomLimit = window.innerHeight - kp - 20;
        if (r.bottom > bottomLimit) $('#view').scrollBy({ top: r.bottom - bottomLimit + 40, behavior: 'smooth' });
        const topLimit = $('.topbar').offsetHeight + (($('#woTimer') || {}).offsetHeight || 0) + 12;
        if (r.bottom <= bottomLimit && r.top < topLimit) $('#view').scrollBy({ top: r.top - topLimit - 10, behavior: 'smooth' });
      });
    }
  };
  const refreshField = (f) => {
    const s = f.entry.sets[f.si];
    const btn = $(`[data-f="${f.key}"]`, v);
    if (!btn) return;
    btn.innerHTML = f.key.endsWith(':w') ? valHtml(s.w, 'kg', 2) : valHtml(s.r, 'Wdh', 0);
    $$(`[data-f^="${f.ei}:${f.si}:"]`, v).forEach((b) => b.classList.toggle('ghost', !!s.ghost));
    btn.classList.toggle('empty-val', f.get() == null);
  };

  const openKeypad = (key) => {
    unlockAudio();
    if (Keypad.isOpen() && Keypad.owner() === 'workout') { Keypad.update(fields); if (Keypad.focusKey(key)) return; }
    const start = fields.findIndex((f) => f.key === key);
    Keypad.open({
      owner: 'workout',
      fields,
      title: (f) => `${esc(f.entry.name)} · Satz ${f.si + 1} · <b>${f.label}</b>`,
      okLabel: 'Fertig',
      onFocus: (f) => highlight(f.key),
      onChange: (f) => { saveDraft(); refreshField(f); },
      onClose: () => highlight(null),
    }, Math.max(0, start));
  };

  if (Keypad.isOpen() && Keypad.owner() === 'workout') {
    Keypad.update(fields);
    highlight(Keypad.currentKey());
  }

  $$('[data-f]', v).forEach((b) => b.onclick = () => openKeypad(b.dataset.f));

  $$('[data-chk]', v).forEach((b) => b.onclick = () => {
    unlockAudio();
    const [ei, si] = b.dataset.chk.split(':').map(Number);
    const s = draft.entries[ei].sets[si];
    s.done = !s.done;
    if (s.done) {
      s.ghost = false;
      pow(b);
      startRest();
    }
    saveDraft();
    render();
  });

  $$('[data-jump]', v).forEach((b) => b.onclick = () => $(`#ex-${b.dataset.jump}`).scrollIntoView({ behavior: 'smooth', block: 'start' }));

  $$('[data-addset]', v).forEach((b) => b.onclick = () => {
    const ei = Number(b.dataset.addset);
    const sets = draft.entries[ei].sets;
    const prev = sets[sets.length - 1];
    sets.push(prev ? { w: prev.w, r: prev.r } : { w: null, r: null });
    saveDraft();
    Keypad.close();
    render();
  });

  $$('[data-setmenu]', v).forEach((b) => b.onclick = () => {
    const [ei, si] = b.dataset.setmenu.split(':').map(Number);
    const e = draft.entries[ei];
    openSheet(`
      <h2>${esc(e.name)} · Satz ${si + 1}</h2>
      <button class="btn" id="setDup">Satz duplizieren</button>
      <button class="btn" id="setDel" style="color:var(--red)">Satz löschen</button>
      <button class="btn danger" id="setCancel" style="color:var(--muted)">Abbrechen</button>
    `, () => {
      $('#setCancel').onclick = closeSheet;
      $('#setDup').onclick = () => { const s = e.sets[si]; e.sets.splice(si + 1, 0, { w: s.w, r: s.r }); saveDraft(); closeSheet(); render(); };
      $('#setDel').onclick = () => { e.sets.splice(si, 1); saveDraft(); closeSheet(); render(); };
    });
  });

  $$('[data-later]', v).forEach((b) => b.onclick = () => {
    const ei = Number(b.dataset.later);
    if (ei === draft.entries.length - 1) { toast('Ist schon die letzte Übung'); return; }
    const [e] = draft.entries.splice(ei, 1);
    draft.entries.push(e);
    saveDraft();
    Keypad.close();
    render();
    toast(`${e.name} → später ⏭`);
    const next = $(`#ex-${ei}`);
    if (next) next.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $$('[data-note]', v).forEach((b) => b.onclick = () => notesSheet(draft.entries[Number(b.dataset.note)]));

  $$('[data-exmenu]', v).forEach((b) => b.onclick = () => {
    const ei = Number(b.dataset.exmenu);
    const e = draft.entries[ei];
    openSheet(`
      <h2>${esc(e.name)}</h2>
      <button class="btn" id="mUp" ${ei === 0 ? 'disabled' : ''}>⬆ Nach vorne holen</button>
      <button class="btn" id="mLater">⏭ Später machen (ans Ende)</button>
      <button class="btn" id="mOrder">⇅ Reihenfolge ändern</button>
      <button class="btn" id="mNote">📝 Notizen</button>
      <button class="btn" id="mProg">📈 Fortschritt</button>
      <button class="btn danger" id="mDel">Aus diesem Training entfernen</button>
    `, () => {
      $('#mUp').onclick = () => { const [x] = draft.entries.splice(ei, 1); draft.entries.unshift(x); saveDraft(); closeSheet(); render(); $('#view').scrollTo({ top: 0, behavior: 'smooth' }); };
      $('#mLater').onclick = () => { closeSheet(); $(`[data-later="${ei}"]`).click(); };
      $('#mOrder').onclick = () => { closeSheet(); workoutReorder(); };
      $('#mNote').onclick = () => notesSheet(e);
      $('#mProg').onclick = () => { closeSheet(); progressState.name = e.name; nav.tab = 'progress'; nav.stack = []; render(); };
      $('#mDel').onclick = () => {
        if (!confirm(`„${e.name}“ aus diesem Training entfernen?`)) return;
        draft.entries.splice(ei, 1); saveDraft(); closeSheet(); render();
      };
    });
  });

  if ($('#woReorder')) $('#woReorder').onclick = workoutReorder;

  $('#wDate').onchange = (e) => {
    if (!e.target.value) return;
    draft.date = e.target.value;
    saveDraft();
  };

  $('#wAddEx').onclick = () => addExerciseSheet((name) => {
    const plan = planById(draft.planId);
    let ex = plan && plan.exercises.find((x) => norm(x.name) === norm(name));
    if (!ex) {
      ex = { id: uid(), name };
      if (plan) { plan.exercises.push(ex); touch(plan); save(); }
    }
    draft.entries.push(newEntry(ex, draft.date));
    saveDraft(); render();
  });

  $('#wSave').onclick = finishWorkout;
  if ($('#wDiscard')) $('#wDiscard').onclick = () => {
    if (!confirm('Training verwerfen? Die Eingaben gehen verloren.')) return;
    draft = null; saveDraft(); stopRest(); Keypad.close(); back();
  };
  if ($('#wDelete')) $('#wDelete').onclick = () => {
    if (!confirm('Dieses Training endgültig löschen?')) return;
    removeRec('workouts', draft.id);
    save(); draft = null; saveDraft(); Keypad.close(); back();
  };
}

function workoutReorder() {
  reorderSheet('Reihenfolge', draft.entries.map((e) => e.name), (order, extra) => {
    draft.entries = order.map((i) => draft.entries[i]);
    saveDraft();
    if (extra.applyPlan) {
      const plan = planById(draft.planId);
      if (plan) {
        const pos = (ex) => { const i = draft.entries.findIndex((e) => norm(e.name) === norm(ex.name)); return i < 0 ? 999 : i; };
        plan.exercises.sort((a, b) => pos(a) - pos(b));
        touch(plan); save();
      }
    }
    render();
  }, `<label class="row" style="margin-top:6px"><input type="checkbox" id="applyPlan" style="width:22px;height:22px;accent-color:#e63027"> <span>Auch im Plan dauerhaft so speichern</span></label>`);
}

function notesSheet(entry) {
  openSheet(`
    <h2>📝 ${esc(entry.name)}</h2>
    <label class="lbl">Dauerhafte Notiz – bleibt bei jedem Training stehen<br><span class="hint">z. B. Sitzposition, Einstellung, Griffbreite</span></label>
    <textarea class="field" id="nPerm" rows="3" placeholder="z. B. Sitz Stufe 4, Lehne 2. Loch">${esc(getNote(entry.name))}</textarea>
    <label class="lbl">Notiz für heute<br><span class="hint">z. B. Muskelgefühl, Tagesform – erscheint beim nächsten Mal unter „Letztes Mal“</span></label>
    <textarea class="field" id="nToday" rows="3" placeholder="z. B. Brust gut gespürt, Schulter zwickt">${esc(entry.note || '')}</textarea>
    <div style="height:16px"></div>
    <button class="btn primary" id="nSave">Speichern</button>
  `, () => {
    $('#nSave').onclick = () => {
      setNote(entry.name, $('#nPerm').value);
      entry.note = $('#nToday').value.trim();
      save(); saveDraft(); closeSheet(); render();
    };
  });
}

function finishWorkout() {
  const entries = draft.entries
    .map((e) => ({
      exerciseId: e.exerciseId, name: e.name,
      sets: e.sets.filter((s) => s.r != null && s.r > 0).map((s) => ({ w: s.w ?? 0, r: s.r })),
      ...(e.note ? { note: e.note } : {}),
    }))
    .filter((e) => e.sets.length);
  if (!entries.length) { alert('Trage mindestens einen Satz mit Wiederholungen ein.'); return; }

  // Neue Rekorde (Gewicht) ermitteln
  const prs = [];
  for (const e of entries) {
    const max = Math.max(...e.sets.map((s) => s.w));
    let prev = null;
    data.workouts.forEach((w) => {
      if (w.id === draft.id) return;
      w.entries.forEach((x) => { if (norm(x.name) === norm(e.name)) x.sets.forEach((s) => { prev = Math.max(prev ?? 0, s.w); }); });
    });
    if (prev != null && max > prev) prs.push({ name: e.name, max, prev });
  }

  const existing = data.workouts.find((w) => w.id === draft.id);
  const workout = touch({
    id: draft.id, planId: draft.planId, date: draft.date,
    created: (existing && existing.created) || Date.now(),
    dur: draft.started ? Math.max(1, Math.round(elapsedMs(draft) / 60000)) : (existing && existing.dur) || null,
    entries,
  });
  const i = data.workouts.findIndex((w) => w.id === workout.id);
  if (i >= 0) data.workouts[i] = workout; else data.workouts.push(workout);
  save();

  const isNew = draft.isNew;
  draft = null; saveDraft(); stopRest(); Keypad.close();
  back();

  const sets = entries.reduce((a, e) => a + e.sets.length, 0);
  const vol = entries.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.w * s.r, 0), 0);
  openSheet(`<div class="ko">
    <h2>K.O.!</h2>
    <p style="font-size:18px;margin:0 0 14px">${isNew ? 'Training gespeichert – starker Kampf!' : 'Training aktualisiert.'}</p>
    <div class="stats">
      <div class="stat"><div class="v">${sets}</div><div class="k">Sätze</div></div>
      <div class="stat"><div class="v">${fmtNum(vol, 0)} kg</div><div class="k">Volumen</div></div>
      ${workout.dur ? `<div class="stat"><div class="v">⏱ ${fmtDur(workout.dur)}</div><div class="k">Trainingszeit</div></div>` : ''}
      <div class="stat"><div class="v">${entries.length}</div><div class="k">Übung${entries.length === 1 ? '' : 'en'}</div></div>
    </div>
    ${prs.map((p) => `<div class="pr"><span style="font-size:28px">🏆</span><div><b>Neuer Rekord: ${esc(p.name)}</b><br><span class="small">${fmtNum(p.max, 2)} kg (vorher ${fmtNum(p.prev, 2)} kg)</span></div></div>`).join('')}
    <button class="btn yellow" id="koOk" style="margin-top:8px">Weiter</button>
  </div>`, () => { $('#koOk').onclick = closeSheet; });
}

/* =========================================================
   KALENDER
   ========================================================= */

const calState = { y: new Date().getFullYear(), m: new Date().getMonth() };

function viewCalendar() {
  setHeader('Kalender');
  const { y, m } = calState;
  const first = new Date(y, m, 1);
  const days = new Date(y, m + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const today = todayStr();

  const byDate = {};
  data.workouts.forEach((w) => (byDate[w.date] = byDate[w.date] || []).push(w));

  let cells = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => `<div class="wd">${d}</div>`).join('');
  for (let i = 0; i < offset; i++) cells += '<div class="cal-day blank"></div>';
  let monthCount = 0;
  for (let d = 1; d <= days; d++) {
    const ds = `${y}-${pad(m + 1)}-${pad(d)}`;
    const ws = byDate[ds] || [];
    monthCount += ws.length;
    const colors = [...new Set(ws.map((w) => planColor(w.planId)))];
    const style = colors.length ? `style="background:${stripeBackground(colors)}"` : '';
    cells += `<button class="cal-day ${ws.length ? 'trained' : ''} ${ds === today ? 'today' : ''}" data-day="${ds}" ${style}>${d}</button>`;
  }
  const yearCount = data.workouts.filter((w) => w.date.startsWith(String(y))).length;

  $('#view').innerHTML = `
    <div class="panel">
      <div class="cal-head">
        <button class="ibtn" id="prevM" aria-label="Vorheriger Monat">‹</button>
        <h2>${MONTHS[m]} ${y}</h2>
        <button class="ibtn" id="nextM" aria-label="Nächster Monat">›</button>
      </div>
      <div class="cal-grid">${cells}</div>
      <div class="legend">${data.plans.map((p) => `<span><i class="dot" style="background:${p.color}"></i>${esc(p.name)}</span>`).join('')}</div>
    </div>
    <div class="stats">
      <div class="stat"><div class="v">${monthCount}</div><div class="k">Trainings im ${MONTHS[m]}</div></div>
      <div class="stat"><div class="v">${yearCount}</div><div class="k">Trainings ${y}</div></div>
    </div>
    <p class="hint center">Tippe auf einen Tag, um Trainings anzusehen oder nachzutragen.</p>`;

  $('#prevM').onclick = () => { calState.m--; if (calState.m < 0) { calState.m = 11; calState.y--; } render(); };
  $('#nextM').onclick = () => { calState.m++; if (calState.m > 11) { calState.m = 0; calState.y++; } render(); };
  $$('[data-day]').forEach((b) => b.onclick = () => daySheet(b.dataset.day));
}

function daySheet(ds) {
  const ws = data.workouts.filter((w) => w.date === ds);
  openSheet(`
    <h2>${fmtDateLong(ds)}</h2>
    ${ws.length ? ws.map((w) => `
      <button class="row-item" data-w="${w.id}">
        <div class="stripe" style="background:${planColor(w.planId)}"></div>
        <div class="grow"><div class="t">${esc(planName(w.planId))}${w.dur ? ` · ⏱ ${fmtDur(w.dur)}` : ''}</div>
        <div class="s">${w.entries.map((e) => esc(e.name)).join(', ')}</div></div><span class="chev">›</span>
      </button>`).join('') : '<p class="hint">An diesem Tag wurde nicht trainiert.</p>'}
    ${data.plans.length ? `<span class="label">Training nachtragen</span>
      ${data.plans.map((p) => `<button class="row-item" data-new="${p.id}"><i class="dot" style="background:${p.color}"></i><div class="grow t">${esc(p.name)}</div><span class="chev">＋</span></button>`).join('')}` : ''}
  `, (root) => {
    $$('[data-w]', root).forEach((b) => b.onclick = () => { closeSheet(); editWorkout(data.workouts.find((w) => w.id === b.dataset.w)); });
    $$('[data-new]', root).forEach((b) => b.onclick = () => { closeSheet(); startWorkout(b.dataset.new, ds); });
  });
}

/* =========================================================
   DIAGRAMME (eigenes SVG, offline)
   ========================================================= */

function niceTicks(min, max, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(+t.toFixed(6));
  return ticks;
}

function bindChartTip(el, coords, W, describe) {
  const svg = $('svg', el);
  const tip = $('.chart-tip', el);
  const hl = $('.hl', el);
  const pick = (clientX) => {
    const r = svg.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * W;
    let best = 0;
    coords.forEach(([cx], i) => { if (Math.abs(cx - x) < Math.abs(coords[best][0] - x)) best = i; });
    if (hl) { hl.setAttribute('cx', coords[best][0]); hl.setAttribute('cy', coords[best][1]); hl.setAttribute('visibility', 'visible'); }
    tip.classList.remove('hint');
    tip.innerHTML = describe(best);
  };
  svg.addEventListener('click', (e) => pick(e.clientX));
  svg.addEventListener('touchmove', (e) => pick(e.touches[0].clientX), { passive: true });
}

/** points: [{date, y, label}] */
function lineChart(el, points, color, unit) {
  const W = 340, H = 210, L = 40, R = 14, T = 14, B = 26;
  if (!points.length) { el.innerHTML = '<div class="empty hint">Noch keine Daten.</div>'; return; }
  const xs = points.map((p) => parseDate(p.date).getTime());
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 86400000 * 3; x1 += 86400000 * 3; }
  const ticks = niceTicks(Math.min(...points.map((p) => p.y)), Math.max(...points.map((p) => p.y)));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const px = (t) => L + ((t - x0) / (x1 - x0)) * (W - L - R);
  const py = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const coords = points.map((p, i) => [px(xs[i]), py(p.y)]);
  const path = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const area = `${path}L${coords[coords.length - 1][0].toFixed(1)},${H - B}L${coords[0][0].toFixed(1)},${H - B}Z`;
  const labelIdx = points.length === 1 ? [0] : [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  const anchor = (i) => points.length === 1 ? 'middle' : i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle';
  const pid = 'p' + Math.random().toString(36).slice(2, 7);

  el.innerHTML = `
    <svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">
      <defs><pattern id="${pid}" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.3" fill="${color}" opacity=".45"/></pattern></defs>
      ${ticks.map((t) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${py(t)}" y2="${py(t)}"/><text x="${L - 6}" y="${py(t) + 4}" text-anchor="end">${fmtNum(t)}</text>`).join('')}
      <line class="axis" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>
      ${labelIdx.map((i) => `<text x="${coords[i][0]}" y="${H - 8}" text-anchor="${anchor(i)}">${fmtDate(points[i].date, false)}</text>`).join('')}
      <path d="${area}" fill="url(#${pid})"/>
      <path d="${path}" fill="none" stroke="#17120f" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${coords.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${points.length > 40 ? 2.5 : 4.5}" fill="#fffdf7" stroke="#17120f" stroke-width="2"/>`).join('')}
      <circle class="hl" r="8" fill="#ffd23f" stroke="#17120f" stroke-width="2.5" visibility="hidden"/>
    </svg>
    <div class="chart-tip hint">Tippe ins Diagramm für Details</div>`;

  bindChartTip(el, coords, W, (i) => {
    const p = points[i];
    return `<b>${fmtNum(p.y)} ${unit}</b> · ${fmtDateLong(p.date)}${p.label ? `<br><span class="hint small">${esc(p.label)}</span>` : ''}`;
  });
}

/** bars: [{date, y}] – Tagesbalken mit Ziel-Linie */
function barChart(el, bars, goal, unit) {
  const W = 340, H = 200, L = 40, R = 10, T = 14, B = 26;
  const max = Math.max(goal || 0, ...bars.map((b) => b.y), 1);
  const ticks = niceTicks(0, max);
  const y1 = ticks[ticks.length - 1];
  const py = (v) => T + (1 - v / y1) * (H - T - B);
  const bw = (W - L - R) / bars.length;
  const coords = bars.map((b, i) => [L + bw * i + bw / 2, py(b.y)]);
  el.innerHTML = `
    <svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">
      ${ticks.map((t) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${py(t)}" y2="${py(t)}"/><text x="${L - 6}" y="${py(t) + 4}" text-anchor="end">${fmtNum(t, 0)}</text>`).join('')}
      ${bars.map((b, i) => b.y ? `<rect x="${L + bw * i + bw * .15}" y="${py(b.y)}" width="${bw * .7}" height="${H - B - py(b.y)}" rx="3" fill="${goal && b.y > goal * 1.05 ? '#e63027' : '#2fb344'}" stroke="#17120f" stroke-width="2"/>` : '').join('')}
      ${goal ? `<line x1="${L}" x2="${W - R}" y1="${py(goal)}" y2="${py(goal)}" stroke="#e63027" stroke-width="2.5" stroke-dasharray="7 5"/><text x="${W - R}" y="${py(goal) - 5}" text-anchor="end" style="fill:#e63027">Ziel</text>` : ''}
      <line class="axis" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>
      ${bars.map((b, i) => i % 2 === bars.length % 2 ? '' : `<text x="${L + bw * i + bw / 2}" y="${H - 8}" text-anchor="middle">${parseDate(b.date).getDate()}</text>`).join('')}
    </svg>
    <div class="chart-tip hint">Tippe auf einen Balken für Details</div>`;
  bindChartTip(el, coords, W, (i) => `<b>${fmtNum(bars[i].y, 0)} ${unit}</b> · ${fmtDateLong(bars[i].date)}`);
}

function statCard(label, value, cls = '') {
  return `<div class="stat"><div class="v ${cls}">${value}</div><div class="k">${label}</div></div>`;
}
function diffCard(label, diff, unit, invert = false) {
  if (diff == null) return statCard(label, '–');
  const good = invert ? diff < 0 : diff > 0;
  return statCard(label, `${diff > 0 ? '+' : ''}${fmtNum(diff)} ${unit}`, diff === 0 ? '' : good ? 'up' : 'down');
}

/* =========================================================
   FORTSCHRITT
   ========================================================= */

const progressState = { name: null, metric: 'max', tab: 'exercise' };
const METRICS = {
  max: { label: 'Max. kg', calc: (sets) => Math.max(...sets.map((s) => s.w)) },
  orm: { label: '1RM', calc: (sets) => Math.max(...sets.map((s) => (s.r === 1 ? s.w : s.w * (1 + s.r / 30)))) },
  vol: { label: 'Volumen', calc: (sets) => sets.reduce((a, s) => a + s.w * s.r, 0) },
};

function viewProgress() {
  setHeader('Fortschritt');
  const v = $('#view');
  v.innerHTML = `<div class="seg">
      <button data-ptab="exercise" class="${progressState.tab === 'exercise' ? 'on' : ''}">💪 Übungen</button>
      <button data-ptab="weight" class="${progressState.tab === 'weight' ? 'on' : ''}">⚖️ Gewicht</button>
    </div><div id="progView"></div>`;
  $$('[data-ptab]', v).forEach((b) => b.onclick = () => { progressState.tab = b.dataset.ptab; render(); });
  if (progressState.tab === 'weight') viewWeight($('#progView'));
  else viewExerciseProgress($('#progView'));
}

function viewExerciseProgress(v) {
  const names = new Map();
  sortedWorkouts().forEach((w) => w.entries.forEach((e) => { if (!names.has(norm(e.name))) names.set(norm(e.name), e.name); }));
  if (!names.size) {
    v.innerHTML = `<div class="empty"><div class="big">📈</div><p>Sobald du ein Training gespeichert hast, siehst du hier deine Steigerung pro Übung.</p></div>`;
    return;
  }
  const list = [...names.values()].sort((a, b) => a.localeCompare(b, 'de'));
  if (!progressState.name || !names.has(norm(progressState.name))) progressState.name = names.values().next().value;
  const key = norm(progressState.name);
  const metric = METRICS[progressState.metric];

  const perDay = {}, planOf = {}, notesOf = {};
  data.workouts.forEach((w) => w.entries.forEach((e) => {
    if (norm(e.name) !== key) return;
    (perDay[w.date] = perDay[w.date] || []).push(...e.sets);
    planOf[w.date] = w.planId;
    if (e.note) notesOf[w.date] = e.note;
  }));
  const dates = Object.keys(perDay).sort();
  const points = dates.map((d) => ({ date: d, y: +metric.calc(perDay[d]).toFixed(1), label: setsSummary(perDay[d]) }));
  const color = planColor(planOf[dates[dates.length - 1]]);
  const ys = points.map((p) => p.y);
  const first = ys[0], lastV = ys[ys.length - 1];
  const note = getNote(progressState.name);

  v.innerHTML = `
    <select class="field" id="exSel">${list.map((n) => `<option ${norm(n) === key ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
    ${note ? `<div class="bubble">${esc(note)}</div>` : ''}
    <div style="height:14px"></div>
    <div class="seg">${Object.entries(METRICS).map(([k, mm]) => `<button data-metric="${k}" class="${k === progressState.metric ? 'on' : ''}">${mm.label}</button>`).join('')}</div>
    <div class="panel" id="chart"></div>
    <div class="stats">
      ${statCard('Start', `${fmtNum(first)} kg`)}
      ${statCard('Aktuell', `${fmtNum(lastV)} kg`)}
      ${statCard('Bestwert 🏆', `${fmtNum(Math.max(...ys))} kg`)}
      ${diffCard('Steigerung', points.length > 1 ? +(lastV - first).toFixed(1) : null, 'kg')}
    </div>
    <span class="label">Verlauf</span>
    ${[...points].reverse().map((p) => `<div class="row-item"><div class="grow"><div class="t">${fmtDateLong(p.date)}</div><div class="s">${esc(p.label)}</div>${notesOf[p.date] ? `<div class="s">💬 ${esc(notesOf[p.date])}</div>` : ''}</div><b style="font:400 22px var(--display)">${fmtNum(p.y)} kg</b></div>`).join('')}`;

  lineChart($('#chart'), points, color, 'kg');
  if (progressState.metric === 'orm') $('#chart').insertAdjacentHTML('beforeend', '<p class="hint small center" style="margin:6px 0 0">1RM = geschätztes Maximalgewicht für 1 Wiederholung</p>');
  $('#exSel').onchange = (e) => { progressState.name = e.target.value; render(); };
  $$('[data-metric]', v).forEach((b) => b.onclick = () => { progressState.metric = b.dataset.metric; render(); });
}

/* =========================================================
   KÖRPERGEWICHT (im Tab „Fortschritt“)
   ========================================================= */

const bodyState = { range: 90 };
const RANGES = [[30, '1M'], [90, '3M'], [180, '6M'], [365, '1J'], [0, 'Alle']];

const dateFieldHtml = (d) => `<input type="date" class="field" id="kpDate" value="${d}" style="margin-bottom:10px">`;
function bindDateField(root, tmp) {
  const input = $('#kpDate', root);
  if (input) input.onchange = () => { if (input.value) tmp.date = input.value; };
}

function weightEntry(date) {
  const sorted = [...data.weights].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1];
  const existing = data.weights.find((w) => w.date === (date || todayStr()));
  const tmp = { kg: existing ? existing.kg : last ? last.kg : null, date: date || todayStr() };
  Keypad.open({
    owner: 'progress',
    fields: [{ key: 'kg', label: 'Körpergewicht', unit: 'kg', decimals: 1, step: 0.1, get: () => tmp.kg, set: (x) => { tmp.kg = x; } }],
    title: () => '<b>⚖️ Körpergewicht</b>',
    extraHtml: () => dateFieldHtml(tmp.date),
    onDraw: (root) => bindDateField(root, tmp),
    okLabel: 'Speichern',
    onCancel: () => {},
    onDone: () => {
      const d = tmp.date;
      if (tmp.kg == null || tmp.kg < 20 || tmp.kg > 400) { toast('Bitte gültiges Gewicht eingeben'); return; }
      const id = 'w-' + d;
      const rec = data.weights.find((w) => w.id === id);
      if (rec) { rec.kg = tmp.kg; touch(rec); }
      else data.weights.push(touch({ id, date: d, kg: tmp.kg }));
      save(); toast('Gewicht gespeichert 💪'); render();
    },
  });
}

function viewWeight(v) {
  const all = [...data.weights].sort((a, b) => a.date.localeCompare(b.date));
  const lastW = all[all.length - 1];
  let shown = all;
  if (bodyState.range) {
    const from = addDays(todayStr(), -bodyState.range);
    shown = all.filter((w) => w.date >= from);
  }
  const ys = shown.map((w) => w.kg);

  v.innerHTML = `
    <div class="panel row">
      <div class="grow"><div class="hint">Aktuell</div><div style="font:400 44px/1 var(--display)">${lastW ? fmtNum(lastW.kg) + ' kg' : '–'}</div>
      ${lastW ? `<div class="hint small">${fmtDateLong(lastW.date)}</div>` : ''}</div>
      <button class="start-btn fab" id="wAdd" aria-label="Gewicht eintragen" style="background:var(--blue);color:#fff;text-shadow:2px 2px 0 var(--ink)">＋</button>
    </div>
    ${all.length ? `
      <div class="seg">${RANGES.map(([d, l]) => `<button data-range="${d}" class="${d === bodyState.range ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="panel" id="wChart"></div>
      <div class="stats">
        ${diffCard('Veränderung', shown.length > 1 ? +(ys[ys.length - 1] - ys[0]).toFixed(1) : null, 'kg', true)}
        ${statCard('Einträge', shown.length)}
        ${statCard('Minimum', ys.length ? `${fmtNum(Math.min(...ys))} kg` : '–')}
        ${statCard('Maximum', ys.length ? `${fmtNum(Math.max(...ys))} kg` : '–')}
      </div>
      <span class="label">Einträge</span>
      ${[...all].reverse().slice(0, 60).map((w) => `<button class="row-item" data-wid="${w.id}"><div class="grow t">${fmtDateLong(w.date)}</div><b style="font:400 22px var(--display)">${fmtNum(w.kg)} kg</b><span class="chev">›</span></button>`).join('')}
    ` : `<div class="empty"><div class="big">⚖️</div><p>Trag dein Gewicht regelmäßig ein, um den Verlauf zu sehen.</p></div>`}`;

  if (all.length) lineChart($('#wChart'), shown.map((w) => ({ date: w.date, y: w.kg })), '#1E88E5', 'kg');
  $('#wAdd').onclick = () => weightEntry();
  $$('[data-range]', v).forEach((b) => b.onclick = () => { bodyState.range = Number(b.dataset.range); render(); });
  $$('[data-wid]', v).forEach((b) => b.onclick = () => {
    const w = data.weights.find((x) => x.id === b.dataset.wid);
    openSheet(`<h2>${fmtDateLong(w.date)}</h2><p style="font:400 40px var(--display);margin:6px 0 16px">${fmtNum(w.kg)} kg</p>
      <button class="btn" id="wEdit">Ändern</button><button class="btn danger" id="wDel">Löschen</button>`, () => {
      $('#wEdit').onclick = () => { closeSheet(); weightEntry(w.date); };
      $('#wDel').onclick = () => { removeRec('weights', w.id); save(); closeSheet(); render(); };
    });
  });
}

/* =========================================================
   PROFIL: KONTO, SYNC, EXPORT, EINSTELLUNGEN
   ========================================================= */

function syncStatusHtml() {
  const s = Sync.state;
  const time = s.last ? new Date(s.last).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;
  const txt = { syncing: 'Synchronisiere …', ok: `Synchronisiert${time ? ' · ' + time : ''}`, error: s.error || 'Fehler', offline: s.error, idle: time ? `Zuletzt synchronisiert: ${time}` : 'Noch nicht synchronisiert' }[s.status];
  return `<span class="sync-dot ${s.status}"></span>${esc(txt)}`;
}

function viewProfile() {
  setHeader('Profil');
  const v = $('#view');
  const u = Sync.user();
  const st = data.settings;

  let account;
  if (!Sync.configured()) {
    account = `<p style="margin-top:0">Mit einem Konto werden deine Daten automatisch zwischen deinen Geräten synchronisiert und sind gesichert.</p>
      <p class="hint">Die Anmeldung ist noch nicht eingerichtet. Trage in <b>docs/config.js</b> die Daten deines kostenlosen Supabase-Projekts ein – die Schritt-für-Schritt-Anleitung steht in der README. Bis dahin werden alle Daten nur auf diesem Gerät gespeichert.</p>`;
  } else if (!u) {
    account = `<p style="margin-top:0">Melde dich an, damit dein Stand auf allen Geräten gleich ist und gesichert wird.</p>
      <form id="loginForm" autocomplete="on">
        <input class="field" type="email" id="email" placeholder="E-Mail" autocomplete="username" inputmode="email" autocapitalize="off" required>
        <div style="height:10px"></div>
        <input class="field" type="password" id="pw" placeholder="Passwort (mind. 6 Zeichen)" autocomplete="current-password" required minlength="6">
        <div style="height:14px"></div>
        <button class="btn primary" type="submit" id="loginBtn">Anmelden</button>
      </form>
      <button class="btn" id="signupBtn" style="margin-top:14px">Neues Konto erstellen</button>
      <button class="btn danger" id="forgotBtn" style="color:var(--muted);font-size:18px">Passwort vergessen?</button>
      <p class="hint small center" id="authMsg"></p>`;
  } else {
    account = `<div class="row"><span style="font-size:34px">🥊</span><div class="grow"><div class="t">${esc(u.email)}</div><div class="hint small" id="syncStatus">${syncStatusHtml()}</div></div></div>
      <div style="height:14px"></div>
      <div class="btn-row"><button class="btn blue small" id="syncBtn">⟳ Jetzt synchronisieren</button><button class="btn small" id="logoutBtn">Abmelden</button></div>`;
  }
  if (Sync.configured()) account += `<button class="btn danger" id="diagBtn" style="color:var(--muted);font-size:17px;margin-top:6px">🔍 Verbindung prüfen</button>`;

  v.innerHTML = `
    <span class="label blue">Konto & Sync</span>
    <div class="panel">${account}</div>

    <span class="label">Daten</span>
    <button class="btn green" id="xlsxBtn">📊 Excel-Export (.xlsx)</button>
    <button class="btn" id="exportBtn">💾 Sicherung exportieren</button>
    <button class="btn" id="importBtn">📂 Sicherung importieren</button>
    <input type="file" id="importFile" accept="application/json,.json" hidden>

    <span class="label">Einstellungen</span>
    <div class="panel">
      <div class="lbl" style="margin-top:0">Pause zwischen den Sätzen</div>
      <div class="seg" style="margin-bottom:6px">${[60, 90, 120, 180].map((s) => `<button data-rest-sec="${s}" class="${st.restSec === s ? 'on' : ''}">${fmtTime(s)}</button>`).join('')}</div>
      <label class="row" style="margin:12px 0"><input type="checkbox" id="soundChk" ${st.sound ? 'checked' : ''} style="width:22px;height:22px;accent-color:#e63027"><span>Ton am Ende der Pause</span></label>
      <button class="btn small" id="goalsBtn">🎯 Ernährungsziele: ${fmtNum(st.kcalGoal, 0)} kcal</button>
    </div>
    <p class="hint center small">Fightclub 🥊 Version ${APP_VERSION} · Daten ${Sync.user() ? 'werden synchronisiert' : 'liegen nur auf diesem Gerät'}</p>`;

  if ($('#loginForm')) {
    const msg = (t) => { $('#authMsg').textContent = t; };
    const creds = () => ({ email: $('#email').value.trim(), pw: $('#pw').value });
    $('#loginForm').onsubmit = async (e) => {
      e.preventDefault();
      const { email, pw } = creds();
      $('#loginBtn').disabled = true; msg('Anmelden …');
      try { await Sync.signIn(email, pw); toast('Willkommen zurück! 🥊'); render(); scrollTop(); }
      catch (err) { msg(err.message); $('#loginBtn').disabled = false; }
    };
    $('#signupBtn').onclick = async () => {
      const { email, pw } = creds();
      if (!email || pw.length < 6) { msg('Bitte E-Mail und ein Passwort mit mind. 6 Zeichen eingeben.'); return; }
      msg('Konto wird erstellt …');
      try {
        const loggedIn = await Sync.signUp(email, pw);
        if (loggedIn) { toast('Konto erstellt! 🥊'); render(); scrollTop(); }
        else msg('Fast geschafft! Bestätige den Link in der E-Mail und melde dich dann hier an.');
      } catch (err) { msg(err.message); }
    };
    $('#forgotBtn').onclick = async () => {
      const { email } = creds();
      if (!email) { msg('Gib zuerst deine E-Mail-Adresse ein.'); return; }
      try { await Sync.recover(email); msg('Wir haben dir eine E-Mail zum Zurücksetzen geschickt.'); }
      catch (err) { msg(err.message); }
    };
  }
  if ($('#syncBtn')) $('#syncBtn').onclick = () => Sync.syncNow();
  if ($('#diagBtn')) $('#diagBtn').onclick = diagnoseSheet;
  if ($('#logoutBtn')) $('#logoutBtn').onclick = async () => {
    if (!confirm('Abmelden? Deine Daten bleiben auf diesem Gerät gespeichert.')) return;
    await Sync.signOut(); render();
  };

  $('#xlsxBtn').onclick = exportExcel;
  $('#exportBtn').onclick = exportBackup;
  $('#importBtn').onclick = () => $('#importFile').click();
  $('#importFile').onchange = importBackup;
  $$('[data-rest-sec]', v).forEach((b) => b.onclick = () => { st.restSec = Number(b.dataset.restSec); touchSettings(); save(); render(); });
  $('#soundChk').onchange = (e) => { st.sound = e.target.checked; touchSettings(); save(); if (st.sound) { unlockAudio(); beep(); } };
  $('#goalsBtn').onclick = goalsSheet;
}

Sync.onChange(() => {
  const el = $('#syncStatus');
  if (el) el.innerHTML = syncStatusHtml();
});

async function diagnoseSheet() {
  openSheet(`<h2>🔍 Verbindung</h2><div id="diagList"><p class="hint">Prüfe …</p></div>`);
  const checks = await Sync.diagnose();
  const list = $('#diagList');
  if (list) list.innerHTML = checks.map((c) => `<div class="row-item"><span style="font-size:22px">${c.ok ? '✅' : '❌'}</span><div class="grow">${esc(c.text)}</div></div>`).join('');
}

function passwordSheet() {
  openSheet(`<h2>Neues Passwort</h2>
    <input class="field" type="password" id="newPw" placeholder="Neues Passwort (mind. 6 Zeichen)" autocomplete="new-password">
    <div style="height:14px"></div>
    <button class="btn primary" id="newPwSave">Speichern</button>
    <p class="hint center" id="newPwMsg"></p>`, () => {
    $('#newPwSave').onclick = async () => {
      const pw = $('#newPw').value;
      if (pw.length < 6) { $('#newPwMsg').textContent = 'Mindestens 6 Zeichen.'; return; }
      try { await Sync.setPassword(pw); closeSheet(); toast('Passwort geändert ✓'); Sync.syncNow(); }
      catch (err) { $('#newPwMsg').textContent = err.message; }
    };
  });
}

/* ---------- Excel ---------- */

function exportExcel() {
  const ws = [...data.workouts].sort((a, b) => a.date.localeCompare(b.date) || (a.created || 0) - (b.created || 0));
  const setsRows = [], exRows = [], woRows = [];
  for (const w of ws) {
    let woSets = 0, woVol = 0;
    for (const e of w.entries) {
      e.sets.forEach((s, i) => {
        setsRows.push([w.date, planName(w.planId), e.name, i + 1, s.w, s.r, s.w * s.r, +(s.r === 1 ? s.w : s.w * (1 + s.r / 30)).toFixed(1), i === 0 ? e.note || '' : '']);
      });
      const vol = e.sets.reduce((a, s) => a + s.w * s.r, 0);
      woSets += e.sets.length; woVol += vol;
      exRows.push([w.date, planName(w.planId), e.name, e.sets.length, Math.max(...e.sets.map((s) => s.w)), e.sets.reduce((a, s) => a + s.r, 0), vol,
        +Math.max(...e.sets.map((s) => (s.r === 1 ? s.w : s.w * (1 + s.r / 30)))).toFixed(1), e.note || '']);
    }
    woRows.push([w.date, planName(w.planId), w.entries.length, woSets, woVol, w.dur || null]);
  }
  const weights = [...data.weights].sort((a, b) => a.date.localeCompare(b.date)).map((w) => [w.date, w.kg]);
  const days = foodByDate();
  const food = Object.keys(days).sort().map((d) => [d, days[d].kcal, days[d].p, days[d].c, days[d].f]);
  const mealOrder = Object.fromEntries(MEALS.map((m, i) => [m[0], i]));
  const meals = [...data.food]
    .sort((a, b) => a.date.localeCompare(b.date) || mealOrder[entryMeal(a)] - mealOrder[entryMeal(b)])
    .map((e) => [e.date, mealInfo(entryMeal(e))[1], entryName(e), e.brand || '', e.amount || null, e.amount ? e.unit || 'g' : '', e.kcal, e.p, e.c, e.f]);
  const notes = [...data.notes].sort((a, b) => a.name.localeCompare(b.name, 'de')).map((n) => [n.name, n.text]);

  const bytes = XLSX.build([
    { name: 'Sätze', rows: setsRows, columns: [
      { header: 'Datum', type: 'date', width: 12 }, { header: 'Plan', width: 14 }, { header: 'Übung', width: 26 }, { header: 'Satz', type: 'int', width: 7 },
      { header: 'Gewicht (kg)', type: 'num', width: 13 }, { header: 'Wiederholungen', type: 'int', width: 15 }, { header: 'Volumen (kg)', type: 'num', width: 13 },
      { header: '1RM geschätzt (kg)', type: 'num', width: 18 }, { header: 'Notiz', width: 40 }] },
    { name: 'Übungen', rows: exRows, columns: [
      { header: 'Datum', type: 'date', width: 12 }, { header: 'Plan', width: 14 }, { header: 'Übung', width: 26 }, { header: 'Sätze', type: 'int', width: 8 },
      { header: 'Max. Gewicht (kg)', type: 'num', width: 17 }, { header: 'Wdh. gesamt', type: 'int', width: 12 }, { header: 'Volumen (kg)', type: 'num', width: 13 },
      { header: 'Bestes 1RM (kg)', type: 'num', width: 15 }, { header: 'Notiz', width: 40 }] },
    { name: 'Trainings', rows: woRows, columns: [
      { header: 'Datum', type: 'date', width: 12 }, { header: 'Plan', width: 14 }, { header: 'Übungen', type: 'int', width: 10 }, { header: 'Sätze', type: 'int', width: 8 },
      { header: 'Volumen (kg)', type: 'num', width: 13 }, { header: 'Dauer (min)', type: 'int', width: 12 }] },
    { name: 'Körpergewicht', rows: weights, columns: [{ header: 'Datum', type: 'date', width: 12 }, { header: 'Gewicht (kg)', type: 'num', width: 13 }] },
    { name: 'Ernährung', rows: food, columns: [
      { header: 'Datum', type: 'date', width: 12 }, { header: 'Kalorien (kcal)', type: 'int', width: 15 }, { header: 'Eiweiß (g)', type: 'num', width: 11 },
      { header: 'Kohlenhydrate (g)', type: 'num', width: 17 }, { header: 'Fett (g)', type: 'num', width: 9 }] },
    { name: 'Mahlzeiten', rows: meals, columns: [
      { header: 'Datum', type: 'date', width: 12 }, { header: 'Mahlzeit', width: 13 }, { header: 'Lebensmittel', width: 30 }, { header: 'Marke', width: 16 },
      { header: 'Menge', type: 'int', width: 8 }, { header: 'Einheit', width: 8 }, { header: 'Kalorien (kcal)', type: 'int', width: 15 },
      { header: 'Eiweiß (g)', type: 'num', width: 11 }, { header: 'Kohlenhydrate (g)', type: 'num', width: 17 }, { header: 'Fett (g)', type: 'num', width: 9 }] },
    { name: 'Notizen', rows: notes, columns: [{ header: 'Übung', width: 26 }, { header: 'Notiz', width: 60 }] },
  ]);
  shareFile(bytes, `fightclub-${todayStr()}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/* ---------- Sicherung ---------- */

function exportBackup() {
  const json = JSON.stringify({ app: 'Fightclub', exported: new Date().toISOString(), ...data }, null, 2);
  shareFile(json, `fightclub-sicherung-${todayStr()}.json`, 'application/json');
}

function importBackup(e) {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  f.text().then((text) => {
    const d = JSON.parse(text);
    if (!Array.isArray(d.plans)) throw new Error('Keine Fightclub-Sicherung');
    if (!confirm('Sicherung mit deinen aktuellen Daten zusammenführen?')) return;
    data = FCData.merge(data, d);
    save(); toast('Sicherung importiert'); render();
  }).catch((err) => alert('Import fehlgeschlagen: ' + err.message));
}

/* =========================================================
   iPHONE: Gerüst fest verankern
   Safari lässt sonst die ganze Seite nachfedern, wenn man auf Kopfzeile
   oder Tab-Leiste wischt – dann wandert die Leiste mit. Und nach dem
   Schließen der Tastatur bleibt die Ansicht manchmal verschoben.
   ========================================================= */

const SCROLLABLE = 'main, .sheet-card, .kp-chiprow, .kp-chips, .ex-strip, .scanner, .reorder';
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1) { e.preventDefault(); return; } // kein Zoomen
  const box = e.target.closest && e.target.closest(SCROLLABLE);
  if (!box) e.preventDefault(); // Wischen außerhalb scrollbarer Bereiche bewegt nichts
}, { passive: false });

const resetViewport = () => {
  if (window.scrollY || window.scrollX || document.scrollingElement.scrollTop) window.scrollTo(0, 0);
};
document.addEventListener('focusout', () => setTimeout(resetViewport, 60));
if (window.visualViewport) window.visualViewport.addEventListener('resize', () => setTimeout(resetViewport, 60));
window.addEventListener('scroll', () => { if (!document.activeElement || !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) resetViewport(); });
document.addEventListener('gesturestart', (e) => e.preventDefault()); // iOS-Pinch-Zoom aus

/* =========================================================
   START
   ========================================================= */

render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

Sync.handleRedirect().then((type) => {
  if (type === 'recovery') { switchTab('profile'); passwordSheet(); }
  else if (type) { toast('E-Mail bestätigt ✓'); switchTab('profile'); }
  Sync.syncNow();
});
