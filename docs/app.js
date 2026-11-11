'use strict';

/* =========================================================
   Fightclub – Trainings-, Körpergewicht- und Kalorien-Tracker
   Daten liegen lokal im Browser und werden – wenn angemeldet –
   über Supabase zwischen deinen Geräten synchronisiert.
   ========================================================= */

/** Wird im Profil angezeigt – so lässt sich prüfen, ob die neueste Version geladen ist. */
const APP_VERSION = '13';

const STORE_KEY = 'fightclub-data';
const DRAFT_KEY = 'fightclub-draft';

// Gedämpfte, gut unterscheidbare Kategorie-Farben (für Plan-Markierungen und den Kalender)
const COLORS = [
  ['Rot', '#C8414B'], ['Blau', '#2E6FBD'], ['Grün', '#2E8B57'], ['Orange', '#DB7A35'], ['Violett', '#7558A6'],
  ['Petrol', '#1C8C96'], ['Magenta', '#B5527C'], ['Ocker', '#BF9324'], ['Braun', '#8A6A4D'], ['Grau', '#5F6B77'],
];

const SAMPLE_PLANS = [
  ['Push', '#C8414B', ['Bankdrücken', 'Schrägbankdrücken', 'Butterfly', 'Schulterdrücken', 'Seitheben', 'Trizepsdrücken']],
  ['Pull', '#2E8B57', ['Klimmzüge', 'Langhantelrudern', 'Latziehen', 'Face Pulls', 'Bizepscurls']],
  ['Beine', '#2E6FBD', ['Kniebeugen', 'Beinpresse', 'Rumänisches Kreuzheben', 'Beinstrecker', 'Beinbeuger', 'Wadenheben']],
];


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

/* Vorschlagswerte vom letzten Training sind grau – getrennt für Gewicht (gw)
   und Wiederholungen (gr). Ein Satz gilt als eingetragen, sobald einer seiner
   Werte selbst eingegeben wurde. */
const isLogged = (s) => (s.w != null && !s.gw) || (s.r != null && !s.gr);
/** Ältere Entwürfe (gemeinsames ghost-Flag, Erledigt-Haken) umrechnen. */
if (draft && Array.isArray(draft.entries)) {
  draft.entries.forEach((e) => (e.sets || []).forEach((s) => {
    if ('ghost' in s) { const g = !!s.ghost && !s.done; if (g) { s.gw = true; s.gr = true; } delete s.ghost; }
    delete s.done;
  }));
}

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

/* Kommt beim Synchronisieren ein neuer Stand, wird die Ansicht erst neu gezeichnet,
   wenn gerade nichts eingegeben wird – sonst gingen Tipper verloren. */
let pendingRender = false;
function busyInput() {
  const a = document.activeElement;
  return !!(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) || sheetOpen() || Keypad.isOpen();
}
function flushPendingRender() {
  if (!pendingRender || busyInput()) return;
  pendingRender = false;
  render();
}

Sync.attach({
  getData: () => data,
  setData: (d) => {
    data = d;
    persist();
    if (busyInput()) pendingRender = true;
    else render();
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
  setTimeout(() => t.classList.add('out'), 1800);
  setTimeout(() => t.remove(), 2050);
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

const TABS = ['plans', 'food', 'calendar', 'progress', 'profile'];
const nav = { tab: 'plans', stack: [] };
const current = () => nav.stack[nav.stack.length - 1] || { view: nav.tab };

/* Zuletzt geöffneten Bereich merken: iOS lädt Home-Bildschirm-Apps im Hintergrund
   oft neu – danach geht es dort weiter, wo man war (z. B. mitten im Training). */
const NAV_KEY = 'fightclub-nav';
function rememberNav() {
  try { localStorage.setItem(NAV_KEY, JSON.stringify({ tab: nav.tab, workout: current().view === 'workout', t: Date.now() })); }
  catch (e) { /* privater Modus */ }
}

/** Inhalt nach oben scrollen (die Seite selbst scrollt nicht, nur <main>). */
const scrollTop = () => { $('#view').scrollTop = 0; };

function go(view, params = {}) { nav.stack.push({ view, ...params }); render(true); scrollTop(); }
function back() { nav.stack.pop(); render(true); scrollTop(); }
function switchTab(tab) {
  // Denselben Tab noch einmal antippen: nur weich nach oben scrollen
  if (nav.tab === tab && !nav.stack.length && !Keypad.isOpen()) {
    const v = $('#view');
    if (v.scrollTop > 0 && v.scrollTo) { v.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  }
  nav.tab = tab;
  nav.stack = [];
  render(true);
  scrollTop();
}

$('#backBtn').innerHTML = ico('chevl');
$$('[data-ico]').forEach((el) => { el.innerHTML = ico(el.dataset.ico); });
$('#backBtn').addEventListener('click', back);
$$('.tabbar button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

/* =========================================================
   DARSTELLUNG: System / Hell / Dunkel (pro Gerät gespeichert)
   ========================================================= */

const THEME_KEY = 'fightclub-theme';
const darkQuery = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : { matches: false };
function getTheme() {
  try { const t = localStorage.getItem(THEME_KEY); return t === 'light' || t === 'dark' ? t : 'system'; } catch (e) { return 'system'; }
}
const isDark = () => { const t = getTheme(); return t === 'dark' || (t === 'system' && darkQuery.matches); };
function applyTheme(t) {
  try { if (t === 'system') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, t); } catch (e) { /* privat */ }
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', isDark() ? '#0b1016' : '#16222e');
}
const onSystemTheme = () => { applyTheme(getTheme()); if (current().view === 'profile') render(); };
if (darkQuery.addEventListener) darkQuery.addEventListener('change', onSystemTheme);
else if (darkQuery.addListener) darkQuery.addListener(onSystemTheme);
applyTheme(getTheme());

function setHeader(title, actionHtml = '') {
  $('#title').textContent = title;
  $('#backBtn').classList.toggle('off', nav.stack.length === 0);
  $('#topAction').innerHTML = actionHtml;
  $$('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === nav.tab));
}

let enterTimer = null;
/** anim = true: Die Ansicht wurde gewechselt (sanft einblenden). Sonst wird nur neu gezeichnet. */
function render(anim) {
  const c = current();
  document.body.classList.toggle('workout-mode', c.view === 'workout');
  document.body.classList.toggle('food-mode', c.view === 'food');
  if (Keypad.isOpen() && Keypad.owner() !== c.view) Keypad.close();
  if (c.view !== 'workout') { $('#timerHolder').innerHTML = ''; $('#footHolder').innerHTML = ''; }
  const views = { plans: viewPlans, plan: viewPlan, workout: viewWorkout, calendar: viewCalendar, progress: viewProgress, food: viewNutrition, profile: viewProfile };
  (views[c.view] || viewPlans)(c);
  if (anim) {
    const v = $('#view');
    if (!Keypad.isOpen()) Spacer.reset();
    v.classList.remove('enter');
    void v.offsetWidth;
    v.classList.add('enter');
    clearTimeout(enterTimer);
    enterTimer = setTimeout(() => v.classList.remove('enter'), 300);
    rememberNav();
  }
}

/* =========================================================
   SHEET – Dialog von unten bzw. Eingabeseite
   ========================================================= */

const sheetEl = $('#sheet');
const sheetCard = $('#sheetCard');
let sheetOnClose = null;
const sheetOpen = () => !sheetEl.hidden;
const reducedMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

/** Tastatur schließen, falls gerade ein Textfeld aktiv ist */
function blurActive() {
  const a = document.activeElement;
  if (a && a !== document.body && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) a.blur();
}

/** Kopfzeile eines Sheets: Titel und Schließen-Knopf (title ist bereits HTML-sicher). */
const sheetHead = (title, icon) => `<div class="sheet-head"><h2>${icon ? ico(icon) : ''}<span>${title}</span></h2><button class="ibtn ghost" data-close aria-label="Schließen">${ico('x')}</button></div>`;

/** opts.full: oben verankerte Eingabeseite – Textfelder stehen dann über der Tastatur,
    und iOS muss die Seite nicht verschieben. opts.onClose: Aufräumen beim Schließen. */
function openSheet(html, onMount, opts = {}) {
  if (Keypad.isOpen()) Keypad.close();
  blurActive();
  const wasOpen = sheetOpen();
  const prev = sheetOnClose;
  sheetOnClose = opts.onClose || null;
  if (prev) prev();
  sheetCard.className = `sheet-card${opts.full ? ' full' : ''}${opts.cls ? ' ' + opts.cls : ''}`;
  sheetCard.innerHTML = html;
  sheetEl.hidden = false;
  sheetCard.scrollTop = 0;
  sheetEl.classList.remove('in', 'swap');
  void sheetEl.offsetWidth;
  sheetEl.classList.add(wasOpen ? 'swap' : 'in');
  $$('[data-close]', sheetCard).forEach((b) => b.addEventListener('click', closeSheet));
  if (onMount) onMount(sheetCard);
}

function closeSheet() {
  if (!sheetOpen()) return;
  blurActive();
  const cb = sheetOnClose;
  sheetOnClose = null;
  if (!reducedMotion()) {
    // Eine Kopie (ohne ids) gleitet weg – das Original ist sofort leer, der Ablauf bleibt einfach.
    const ghost = sheetEl.cloneNode(true);
    ghost.removeAttribute('id');
    ghost.className = 'sheet sheet-ghost';
    $$('[id]', ghost).forEach((n) => n.removeAttribute('id'));
    // Getippter Text soll beim Wegblenden stehen bleiben (eine Kopie übernimmt ihn nicht von selbst)
    const typed = $$('input, textarea', sheetEl);
    $$('input, textarea', ghost).forEach((n, i) => { if (typed[i]) n.value = typed[i].value; });
    document.body.appendChild(ghost);
    const gc = $('.sheet-card', ghost);
    if (gc) gc.scrollTop = sheetCard.scrollTop;
    setTimeout(() => ghost.remove(), 230);
  }
  sheetEl.hidden = true;
  sheetCard.innerHTML = '';
  if (cb) cb();
  setTimeout(flushPendingRender, 0);
}
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

/** Liste per Ziehen am Griff neu sortieren. */
function reorderSheet(title, items, onSave, extraHtml = '') {
  openSheet(`
    ${sheetHead(esc(title), 'reorder')}
    <p class="hint">Halte den Griff rechts gedrückt und ziehe die Übung an die gewünschte Stelle.</p>
    <ul class="reorder" id="reorderList">
      ${items.map((it, i) => `<li data-i="${i}"><span class="n">${i + 1}</span><span class="t">${esc(it)}</span><button class="handle" aria-label="Verschieben">${ico('grip')}</button></li>`).join('')}
    </ul>
    ${extraHtml}
    <div class="gap-l"></div>
    <button class="btn primary" id="reorderSave">Übernehmen</button>
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
   PLATZHALTER unter dem Inhalt (main::after, siehe style.css)
   Solange das Zahlenfeld offen ist, lässt sich so jede Zeile nach oben
   holen. Beim Schließen bleibt genau so viel Platz, dass nichts springt;
   er verschwindet unbemerkt, sobald man wieder nach oben scrollt.
   ========================================================= */

const Spacer = (() => {
  const main = $('#view');
  let space = 0;
  const set = (px) => {
    const v = Math.max(0, Math.round(px));
    if (v === space) return;
    space = v;
    document.documentElement.style.setProperty('--kp-space', space + 'px');
  };
  const grow = () => { const need = main.clientHeight - 120; if (need > space) set(need); };
  const settle = () => {
    if (!space) return;
    const typing = document.body.classList.contains('typing') ? window.innerHeight * 0.55 : 0;
    const content = main.scrollHeight - space - typing;
    const needed = main.scrollTop + main.clientHeight - content;
    if (needed < space) set(needed);
  };
  let ticking = false;
  main.addEventListener('scroll', () => {
    if (!space || ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; if (!Keypad.isOpen()) settle(); });
  }, { passive: true });
  return { grow, settle, reset: () => set(0) };
})();

/* =========================================================
   ZAHLENFELD (statt iOS-Tastatur)

   Wird beim Öffnen einmal aufgebaut und danach nur noch aktualisiert –
   so geht kein Tipper verloren, auch nicht bei schnellem Tippen mit zwei
   Daumen. Ziffern, Löschen und ± reagieren schon beim Antippen; ± und
   Löschen wiederholen sich, solange man sie gedrückt hält.

   Felder einer Gruppe (z. B. Gewicht und Wiederholungen eines Satzes)
   stehen als Kästchen nebeneinander; das aktive ist hervorgehoben.
   ========================================================= */

const Keypad = (() => {
  const el = $('#keypad');
  const rootStyle = document.documentElement.style;
  let o = null;
  let idx = -1;
  let fresh = true;
  let buf = '';
  let boxSig = '';
  let hideTimer = null;
  let repeatTimer = null;
  let inputCount = 0;   // zählt jede Eingabe – so lässt sich erkennen, ob seit einer Berührung noch etwas getippt wurde

  const INSTANT = /^(\d|comma|back|clear|plus|minus)$/;
  const REPEAT = /^(back|plus|minus)$/;
  const field = () => o.fields[idx];
  const groupOf = (f) => (o.group ? o.group(f) : o.chips ? '*' : f.key);
  const groupIdx = () => {
    const g = groupOf(field());
    return o.fields.map((x, i) => i).filter((i) => groupOf(o.fields[i]) === g);
  };

  function parse(s) {
    if (s === '' || s === ',') return null;
    const n = parseFloat(s.replace(',', '.'));
    return isFinite(n) ? n : null;
  }

  function build() {
    const many = o.fields.length > 1;
    el.innerHTML = `<div class="kp-inner">
      <div class="kp-head">
        <div class="kp-title" id="kpTitle"></div>
        ${o.onCancel ? `<button class="ibtn ghost" data-k="cancel" aria-label="Abbrechen">${ico('x')}</button>` : ''}
      </div>
      <div class="kp-extra" id="kpExtra"></div>
      <div class="kp-display">
        <button class="kp-step" data-k="minus" id="kpMinus" aria-label="Weniger"></button>
        <div class="kp-boxes" id="kpBoxes"></div>
        <button class="kp-step" data-k="plus" id="kpPlus" aria-label="Mehr"></button>
      </div>
      <div class="kp-grid">
        <button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button><button data-k="back" class="muted-key" aria-label="Löschen">${ico('backspace')}</button>
        <button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button>
        ${many ? '<button data-k="next" class="next">Weiter</button>' : '<button data-k="clear" class="next muted-key" aria-label="Leeren">C</button>'}
        <button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button>
        <button data-k="comma" id="kpComma">,</button><button data-k="0">0</button>
        <button data-k="ok" class="ok">${esc(o.okLabel || 'Fertig')}</button>
      </div>
    </div>`;
    drawExtra();
  }

  function drawExtra() {
    const x = $('#kpExtra', el);
    if (!x) return;
    x.innerHTML = typeof o.extraHtml === 'function' ? o.extraHtml() : (o.extraHtml || '');
    if (o.onDraw) o.onDraw(el);
  }

  function paintBox(i) {
    const b = $(`[data-chip="${i}"]`, el);
    if (!b) return;
    const x = o.fields[i];
    const active = i === idx;
    const v = x.get();
    const typing = active && !fresh;
    const txt = typing ? (buf || '0') : v == null ? '–' : fmtNum(v, x.decimals ?? 2);
    $('b', b).innerHTML = `${esc(txt)}<i>${esc(x.unit || '')}</i>`;
    b.classList.toggle('on', active);
    b.classList.toggle('ghost', !typing && !!(x.isGhost && x.isGhost()));
  }

  /** Alles Veränderliche auf den Stand des aktiven Felds bringen (ohne Neuaufbau). */
  function sync() {
    const f = field();
    $('#kpTitle', el).innerHTML = o.title ? o.title(f, idx) : `<b>${esc(f.label)}</b>`;
    const g = groupIdx();
    const sig = g.join(',');
    const boxes = $('#kpBoxes', el);
    if (sig !== boxSig) {
      boxSig = sig;
      boxes.innerHTML = g.map((i) => `<button class="kp-box" data-chip="${i}"><small>${esc(o.fields[i].label)}</small><b></b></button>`).join('');
      boxes.dataset.n = g.length;
    }
    g.forEach(paintBox);
    el.classList.toggle('no-steps', g.length > 2);
    $('#kpMinus', el).textContent = `−${fmtNum(f.step, 2)}`;
    $('#kpPlus', el).textContent = `+${fmtNum(f.step, 2)}`;
    $('#kpComma', el).disabled = !!f.int;
  }

  function measure() {
    el.classList.toggle('fits', el.scrollHeight <= el.clientHeight + 1);
    rootStyle.setProperty('--kp-h', el.offsetHeight + 'px');
    Spacer.grow();
  }

  function commit(v) {
    field().set(v);
    if (o.onChange) o.onChange(field(), idx);
    paintBox(idx);
  }

  function press(k) {
    if (!o) return;
    inputCount += 1;
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
      return paintBox(idx);
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
    if (k === 'cancel') { const cb = o.onCancel; close(); if (cb) cb(); }
  }

  function focus(i) {
    idx = Math.max(0, Math.min(o.fields.length - 1, i));
    fresh = true;
    buf = '';
    sync();
    if (o.onFocus) o.onFocus(field(), idx);
  }

  /* ----- Tasten -----
     Ziffern, Komma, Löschen und ± wirken sofort beim Antippen (pointerdown) – auch
     wenn zwei Finger schnell abwechselnd tippen. Der spätere „click“ derselben
     Berührung wird übergangen. „Weiter“, „Fertig“ und „Abbrechen“ lösen wie gewohnt
     beim Loslassen aus (Finger wegziehen bricht ab). */
  const awaitingClick = new Map();   // Taste → Nummer der Berührung, deren click noch aussteht
  const touches = new Map();         // pointerId → [Taste, Nummer]
  let touchSeq = 0;
  let repeatBtn = null;
  const stopRepeat = () => { clearTimeout(repeatTimer); repeatTimer = null; repeatBtn = null; };
  function startRepeat(b) {
    stopRepeat();
    repeatBtn = b;
    const k = b.dataset.k;
    let n = 0;
    const tick = () => {
      if (!o || repeatBtn !== b || !b.isConnected) return stopRepeat();
      press(k);
      n += 1;
      repeatTimer = setTimeout(tick, n > 8 ? 55 : 95);
    };
    repeatTimer = setTimeout(tick, 420);
  }
  /* Passt das Zahlenfeld nicht ganz auf den Bildschirm, lässt es sich scrollen –
     dann lösen die Tasten erst beim Loslassen aus, damit Scrollen nichts eintippt. */
  const instant = (k) => INSTANT.test(k) && el.scrollHeight <= el.clientHeight + 1;

  el.addEventListener('pointerdown', (e) => {
    if (!o) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const chip = e.target.closest('[data-chip]');
    if (chip) {
      const i = Number(chip.dataset.chip);
      if (i !== idx) focus(i);
      return;
    }
    const b = e.target.closest('[data-k]');
    if (!b || b.disabled || !instant(b.dataset.k)) return;
    touchSeq += 1;
    const f = field();
    const undo = { o, idx, buf, fresh, field: f, state: f.save ? f.save() : f.get() };
    awaitingClick.set(b, touchSeq);
    touches.set(e.pointerId, [b, touchSeq, undo]);
    press(b.dataset.k);
    undo.after = inputCount;
    if (REPEAT.test(b.dataset.k)) startRepeat(b);
  });
  el.addEventListener('click', (e) => {
    if (!o) return;
    const b = e.target.closest('[data-k]');
    if (!b || b.disabled) return;
    if (awaitingClick.delete(b)) return;   // wurde schon beim Antippen ausgeführt
    press(b.dataset.k);
  });
  const release = (e) => {
    const t = touches.get(e.pointerId);
    if (!t) return;
    touches.delete(e.pointerId);
    const [b, seq] = t;
    if (repeatBtn === b) stopRepeat();
    // Folgt kein click (Finger weggezogen), wird die Merkhilfe nach kurzer Zeit gelöscht.
    setTimeout(() => { if (awaitingClick.get(b) === seq) awaitingClick.delete(b); }, 700);
  };
  el.addEventListener('pointerup', release);
  /* Bricht das iPhone eine Berührung ab (z. B. weil daraus ein Wischen zum Home-Bildschirm
     wird), wird die dabei getippte Ziffer zurückgenommen – sofern seither nichts weiter
     eingegeben wurde. */
  el.addEventListener('pointercancel', (e) => {
    const t = touches.get(e.pointerId);
    release(e);
    if (!t) return;
    const u = t[2];
    if (!o || o !== u.o || idx !== u.idx || inputCount !== u.after) return;
    awaitingClick.delete(t[0]);
    buf = u.buf;
    fresh = u.fresh;
    if (u.field.load) u.field.load(u.state); else u.field.set(u.state);
    if (o.onChange) o.onChange(u.field, idx);
    paintBox(idx);
  });
  // Gleitet der Finger beim Gedrückthalten von der Taste, endet die Wiederholung
  el.addEventListener('pointermove', (e) => {
    if (!repeatBtn) return;
    const t = touches.get(e.pointerId);
    if (!t || t[0] !== repeatBtn) return;
    const r = repeatBtn.getBoundingClientRect();
    if (e.clientX < r.left - 12 || e.clientX > r.right + 12 || e.clientY < r.top - 12 || e.clientY > r.bottom + 12) stopRepeat();
  });
  el.addEventListener('contextmenu', (e) => e.preventDefault());   // kein Menü bei langem Druck
  window.addEventListener('blur', stopRepeat);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') stopRepeat(); });

  function open(opts, start = 0) {
    if (sheetOpen() && !opts.keepSheet) closeSheet();
    blurActive();
    clearTimeout(hideTimer);
    const visible = !el.hidden;
    o = opts;
    boxSig = '';
    awaitingClick.clear();
    build();
    el.hidden = false;
    if (!visible) void el.offsetHeight;   // Ausgangslage zeichnen, dann einfahren
    el.classList.add('show');
    idx = Math.max(0, Math.min(o.fields.length - 1, start));
    fresh = true;
    buf = '';
    sync();
    measure();
    if (o.onFocus) o.onFocus(field(), idx);
  }

  function done() {
    if (!o) return;
    if (o.validate) {
      const msg = o.validate();
      if (msg) { toast(msg); return; }
    }
    const cb = o.onDone;
    close();
    if (cb) cb();
  }

  function close() {
    if (!o) return;
    const cb = o.onClose;
    o = null;
    stopRepeat();
    el.classList.remove('show');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { el.hidden = true; el.innerHTML = ''; }, 260);
    rootStyle.setProperty('--kp-h', '0px');
    Spacer.settle();
    if (cb) cb();
    setTimeout(flushPendingRender, 0);
  }

  /** Neue Feldliste nach einem Neuzeichnen der Ansicht übernehmen (gleicher Schlüssel bleibt aktiv). */
  function update(fields) {
    if (!o) return;
    const key = field().key;
    o.fields = fields;
    const i = fields.findIndex((f) => f.key === key);
    if (i < 0) return close();
    idx = i;
    boxSig = '';
    sync();
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
    height: () => (o ? el.offsetHeight : 0),
    redrawExtra: () => { if (o) { drawExtra(); measure(); } },
    focusKey: (key) => { if (!o) return false; const i = o.fields.findIndex((f) => f.key === key); if (i < 0) return false; focus(i); return true; },
    currentKey: () => (o ? field().key : null),
  };
})();

/* =========================================================
   TRAINING – START
   ========================================================= */

function viewPlans() {
  setHeader('Fightclub', `<button class="top-chip" id="addPlan">${ico('plus')}Plan</button>`);
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
    <h2>Diese Woche: <span class="num">${weekCount}</span> Training${weekCount === 1 ? '' : 's'}</h2>
    <div class="week">${week}</div>
  </div>`;

  if (draft) {
    html += `<button class="resume" id="resume">
      ${ico('timer')}
      <div class="grow"><div class="big">Laufendes Training: ${esc(planName(draft.planId))}</div>
      <div class="small">${draft.started ? `<b class="num" id="resumeTime">${fmtClock(elapsedMs(draft))}${draft.pausedAt ? ' (pausiert)' : ''}</b> · ` : ''}Tippen zum Fortsetzen</div></div>
      <span class="chev">${ico('chevr')}</span></button>`;
  }

  if (!data.plans.length) {
    html += `<div class="empty"><div class="big">${ico('training')}</div>
      <p>Noch keine Trainingspläne.<br>Lege deinen ersten Plan an, z. B. „Push“.</p></div>
      <button class="btn primary" id="firstPlan">Plan erstellen</button>
      <button class="btn yellow" id="samples">Beispielpläne laden</button>`;
  } else {
    html += data.plans.map((p) => {
      const last = sortedWorkouts().find((w) => w.planId === p.id);
      return `<div class="plan-card" style="--pc:${p.color}">
        <button class="info" data-plan="${p.id}">
          <div class="name">${esc(p.name)}</div>
          <span class="sticker">${p.exercises.length} Übung${p.exercises.length === 1 ? '' : 'en'}${last ? ' · zuletzt ' + fmtDate(last.date, false) : ''}</span>
        </button>
        <button class="start-btn" data-start="${p.id}">${ico('play')}Starten</button>
      </div>`;
    }).join('');
    html += `<button class="btn dashed" id="newPlan">${ico('plus')}Neuer Plan</button>`;
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
    ${sheetHead(isNew ? 'Neuer Plan' : 'Plan bearbeiten')}
    <label class="lbl" for="planName">Name</label>
    <input class="field" id="planName" placeholder="z. B. Push" value="${esc(plan ? plan.name : '')}" autocomplete="off" autocapitalize="sentences" enterkeyhint="done">
    <label class="lbl">Farbe im Kalender</label>
    ${colorPicker(color)}
    <div class="gap-l"></div>
    <button class="btn primary" id="savePlan">${isNew ? 'Erstellen' : 'Speichern'}</button>
    ${isNew ? '' : '<button class="btn danger" id="delPlan">Plan löschen</button>'}
  `, (root) => {
    bindColorPicker(root, (c) => { color = c; });
    const input = $('#planName');
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#savePlan').click(); } });
    $('#savePlan').onclick = () => {
      const name = input.value.trim();
      if (!name) { input.focus(); toast('Bitte einen Namen eingeben'); return; }
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
    if (isNew) input.focus();   // direkt lostippen – im selben Tipp, damit iOS die Tastatur zeigt
  }, { full: true });
}

function viewPlan({ planId }) {
  const plan = planById(planId);
  if (!plan) { nav.stack.pop(); render(); return; }
  setHeader(plan.name, `${plan.exercises.length > 1 ? `<button class="top-chip" id="reorder" aria-label="Reihenfolge ändern">${ico('reorder')}</button>` : ''}<button class="top-chip" id="editPlan" aria-label="Plan bearbeiten">${ico('edit')}</button>`);
  const v = $('#view');

  const exHtml = plan.exercises.map((ex, i) => {
    const last = lastEntryFor(ex.name);
    const note = getNote(ex.name);
    return `<button class="row-item" data-ex="${i}">
      <span class="ex-num" style="background:${plan.color}">${i + 1}</span>
      <div class="grow"><div class="t">${esc(ex.name)}</div>
      <div class="s">${last ? `Zuletzt ${fmtDate(last.workout.date, false)}: ${setsSummary(last.entry.sets)}` : 'Noch nicht trainiert'}</div>
      ${note ? `<div class="s">Notiz: ${esc(note)}</div>` : ''}</div>
      <span class="chev">${ico('chevr')}</span></button>`;
  }).join('');

  v.innerHTML = `
    <div class="plan-card" style="--pc:${plan.color}">
      <div class="info"><div class="name">${esc(plan.name)}</div><span class="sticker">${plan.exercises.length} Übung${plan.exercises.length === 1 ? '' : 'en'}</span></div>
      <button class="start-btn" id="start">${ico('play')}Starten</button>
    </div>
    <span class="label">Übungen</span>
    ${exHtml || '<div class="panel hint">Noch keine Übungen. Füge z. B. Bankdrücken oder Butterfly hinzu.</div>'}
    <button class="btn dashed" id="addEx">${ico('plus')}Übung hinzufügen</button>`;

  $('#editPlan').onclick = () => planEditor(plan);
  $('#start').onclick = () => startWorkout(plan.id, todayStr());
  $('#addEx').onclick = () => addExerciseSheet((name) => { plan.exercises.push({ id: uid(), name }); touch(plan); save(); render(); }, plan.exercises.map((e) => e.name));
  if ($('#reorder')) $('#reorder').onclick = () => reorderSheet('Reihenfolge', plan.exercises.map((e) => e.name), (order) => {
    plan.exercises = order.map((i) => plan.exercises[i]);
    touch(plan); save(); render();
  });
  $$('[data-ex]', v).forEach((b) => b.onclick = () => exerciseMenu(plan, Number(b.dataset.ex)));
}

/** Mehrere Übungen schnell hintereinander hinzufügen: eintippen oder aus den
    bekannten Übungen antippen. taken = Namen, die schon vorhanden sind. */
function addExerciseSheet(onAdd, taken = []) {
  const known = [...new Set(data.plans.flatMap((p) => p.exercises.map((e) => e.name)))].sort((a, b) => a.localeCompare(b, 'de'));
  const have = new Set(taken.map(norm));
  const added = [];
  openSheet(`
    ${sheetHead('Übung hinzufügen')}
    <form class="row" id="exForm">
      <input class="field grow" id="exName" placeholder="z. B. Bankdrücken" autocomplete="off" autocapitalize="sentences" enterkeyhint="done">
      <button class="btn primary" type="submit" style="width:54px;flex:none;padding:0" aria-label="Hinzufügen">${ico('plus')}</button>
    </form>
    <p class="hint" id="exAdded" style="margin:10px 2px 0">Eintippen und mit „Fertig“ auf der Tastatur bestätigen – danach kannst du gleich die nächste Übung eingeben.</p>
    <div id="exSuggest"></div>
    <div class="gap-l"></div>
    <button class="btn yellow" id="exDone">Fertig</button>
  `, () => {
    const input = $('#exName');
    const suggest = () => {
      const q = norm(input.value);
      const list = known.filter((n) => !have.has(norm(n)) && (!q || norm(n).includes(q))).slice(0, 8);
      $('#exSuggest').innerHTML = list.length
        ? `<div class="res-title">${q ? 'Passende Übungen' : 'Aus deinen Plänen'}</div><div class="panel res-list">${list.map((n) => `<button type="button" class="food-row" data-sug="${esc(n)}"><div class="grow"><div class="t">${esc(n)}</div></div><span class="plus">${ico('plus')}</span></button>`).join('')}</div>`
        : '';
      $$('[data-sug]').forEach((b) => b.onclick = () => add(b.dataset.sug));
    };
    const add = (raw) => {
      const name = String(raw || '').trim();
      if (!name) { input.focus(); return; }
      if (have.has(norm(name))) { toast('Diese Übung ist schon dabei'); return; }
      onAdd(name);
      have.add(norm(name));
      added.push(name);
      $('#exAdded').innerHTML = `Hinzugefügt: <b>${added.map(esc).join(', ')}</b>`;
      input.value = '';
      suggest();
    };
    $('#exForm').onsubmit = (e) => { e.preventDefault(); add(input.value); };
    input.oninput = suggest;
    $('#exDone').onclick = () => { if (input.value.trim()) add(input.value); closeSheet(); };
    suggest();
    input.focus();
  }, { full: true });
}

function exerciseMenu(plan, idx) {
  const ex = plan.exercises[idx];
  openSheet(`
    ${sheetHead(esc(ex.name))}
    <label class="lbl" for="exRename">Name</label>
    <input class="field" id="exRename" value="${esc(ex.name)}" autocomplete="off" autocapitalize="sentences">
    <label class="lbl" for="exNote">Notiz (z. B. Sitzposition, Einstellung, Griff)</label>
    <textarea class="field" id="exNote" rows="3" placeholder="z. B. Sitz Stufe 4, Lehne 2. Loch">${esc(getNote(ex.name))}</textarea>
    <div class="gap-l"></div>
    <button class="btn primary" id="exSave">Speichern</button>
    <button class="btn" id="exProg">${ico('progress')}Fortschritt ansehen</button>
    <button class="btn danger" id="exDel">Aus Plan entfernen</button>
  `, () => {
    $('#exSave').onclick = () => {
      const name = $('#exRename').value.trim();
      if (!name) { $('#exRename').focus(); return; }
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
  }, { full: true });
}

/* =========================================================
   TRAINING – ERFASSEN
   ========================================================= */

/** Neue Übung im Training – vorbelegt mit den Werten vom letzten Mal. */
function newEntry(ex, date) {
  const last = lastEntryFor(ex.name, date);
  const sets = last ? last.entry.sets.map((s) => ({ w: s.w, r: s.r, gw: true, gr: true })) : [{ w: null, r: null }];
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
  draft.entries.forEach((e) => { e.note = e.note || ''; });
  saveDraft();
  go('workout');
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
    return `<div class="wo-timer" id="woTimer"><span class="time">${ico('timer')}${draft.dur ? fmtDur(draft.dur) : '–'}</span><span class="lbl2 grow">Dauer dieses Trainings</span></div>`;
  }
  if (!draft.started) {
    return `<div class="wo-timer" id="woTimer"><span class="time">${ico('timer')}0:00</span><span class="lbl2 grow">Timer läuft noch nicht</span><button data-timer>${ico('play')}Start</button></div>`;
  }
  const paused = !!draft.pausedAt;
  return `<div class="wo-timer ${paused ? 'paused' : ''}" id="woTimer">
    <span class="time">${ico('timer')}<span id="woTime">${fmtClock(elapsedMs(draft))}</span></span>
    <span class="lbl2 grow">${paused ? 'Pausiert' : 'Trainingszeit'}</span>
    <button data-timer aria-label="${paused ? 'Timer fortsetzen' : 'Timer pausieren'}">${paused ? `${ico('play')}Weiter` : `${ico('pause')}Pause`}</button>
  </div>`;
}
function drawTimer() {
  const holder = $('#timerHolder');
  if (!holder) return;
  holder.innerHTML = timerHtml();
  const b = $('[data-timer]', holder);
  if (b) b.onclick = toggleTimer;
}

/* Ein Takt pro Sekunde für Trainings-Timer und Hinweis auf das laufende Training */
setInterval(() => {
  if (!draft || !draft.started) return;
  const t = fmtClock(elapsedMs(draft));
  const el = $('#woTime');
  if (el) el.textContent = t;
  const banner = $('#resumeTime');
  if (banner) banner.textContent = t + (draft.pausedAt ? ' (pausiert)' : '');
}, 1000);

function workoutFields() {
  const fields = [];
  draft.entries.forEach((e, ei) => e.sets.forEach((s, si) => {
    const base = {
      ei, si, entry: e,
      save: () => ({ w: s.w, r: s.r, gw: !!s.gw, gr: !!s.gr }),
      load: (x) => { s.w = x.w; s.r = x.r; if (x.gw) s.gw = true; else delete s.gw; if (x.gr) s.gr = true; else delete s.gr; },
    };
    fields.push({
      ...base, key: `${ei}:${si}:w`, label: 'Gewicht', unit: 'kg', decimals: 2, step: 2.5,
      get: () => s.w, set: (v) => { s.w = v; delete s.gw; }, isGhost: () => !!s.gw,
      fallback: () => (si > 0 ? e.sets[si - 1].w : 0),
    });
    fields.push({
      ...base, key: `${ei}:${si}:r`, label: 'Wdh.', unit: '', int: true, decimals: 0, step: 1,
      get: () => s.r, set: (v) => { s.r = v == null ? null : Math.round(v); delete s.gr; }, isGhost: () => !!s.gr,
      fallback: () => (si > 0 ? e.sets[si - 1].r : 0),
    });
  }));
  return fields;
}

function valHtml(v, unit, decimals) {
  return v == null ? `<span class="u">${unit}</span>` : `${fmtNum(v, decimals)}<span class="u">${unit}</span>`;
}

/* Entwurf mit kurzer Verzögerung sichern – nicht bei jedem Tastendruck einzeln.
   Beim Verlassen der App wird sofort gespeichert. */
let draftTimer = null;
function saveDraftSoon() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => { draftTimer = null; saveDraft(); }, 250);
}
function flushDraft() {
  if (!draftTimer) return;
  clearTimeout(draftTimer);
  draftTimer = null;
  saveDraft();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushDraft(); });
window.addEventListener('pagehide', flushDraft);

/* Weiches Scrollen im Inhalt – kurz und gleichmäßig, passend zum Einfahren des Zahlenfelds.
   Wischt man selbst, endet die Bewegung sofort. */
let scrollAnim = 0;
function scrollMainBy(dy, ms = 260) {
  const main = $('#view');
  const from = main.scrollTop;
  const to = Math.max(0, Math.min(main.scrollHeight - main.clientHeight, from + dy));
  if (Math.abs(to - from) < 1) return;
  scrollAnim += 1;
  const id = scrollAnim;
  if (reducedMotion()) { main.scrollTop = to; return; }
  const t0 = performance.now();
  const step = (t) => {
    if (id !== scrollAnim) return;
    const k = Math.min(1, Math.max(0, (t - t0) / ms));
    main.scrollTop = from + (to - from) * (1 - Math.pow(1 - k, 3));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
$('#view').addEventListener('touchstart', () => { scrollAnim += 1; }, { passive: true });

/** Aktive Satz-Zeile zwischen Kopfbereich und Zahlenfeld sichtbar halten.
    Ist sie schon sichtbar, bewegt sich nichts. Muss gescrollt werden, rückt die
    Übung so nach oben, dass möglichst alle ihre Sätze zu sehen sind – beim
    Weitertippen innerhalb der Übung bleibt die Liste dann stehen. */
function revealRow(row) {
  const main = $('#view');
  const m = main.getBoundingClientRect();
  const top = m.top + 6;
  const kpH = Keypad.height();
  const bottom = (kpH ? Math.min(m.bottom, document.body.getBoundingClientRect().bottom - kpH) : m.bottom) - 10;
  const r = row.getBoundingClientRect();
  if (r.top >= top && r.bottom <= bottom) return;
  const head = row.parentElement && $('.sets-head', row.parentElement);
  const anchor = head ? head.getBoundingClientRect().top : r.top;
  const dy = r.bottom - anchor <= bottom - top ? anchor - top : r.bottom - bottom;
  scrollMainBy(dy);
}

/* Öffnet (auch nach einem Neuaufbau der Ansicht) das Zahlenfeld für ein Feld. */
let woOpenField = null;

function viewWorkout() {
  if (!draft) { nav.stack.pop(); render(); return; }
  const color = planColor(draft.planId);
  setHeader(planName(draft.planId), draft.entries.length > 1 ? `<button class="top-chip" id="woReorder" aria-label="Reihenfolge ändern">${ico('reorder')}</button>` : '');
  const v = $('#view');

  const chips = draft.entries.map((e, ei) => `<button class="ex-chip" data-jump="${ei}">${esc(e.name)}<b></b></button>`).join('');

  const cards = draft.entries.map((e, ei) => {
    const last = lastEntryFor(e.name, draft.date, draft.id);
    const perm = getNote(e.name);
    const rows = e.sets.map((s, si) => `
      <div class="set-row ${isLogged(s) ? 'logged' : ''}" data-row="${ei}:${si}">
        <button class="set-nr" data-setmenu="${ei}:${si}" aria-label="Satz ${si + 1}: Optionen"><span>${si + 1}</span></button>
        <button class="val ${s.gw ? 'ghost' : ''} ${s.w == null ? 'empty-val' : ''}" data-f="${ei}:${si}:w">${valHtml(s.w, 'kg', 2)}</button>
        <button class="val ${s.gr ? 'ghost' : ''} ${s.r == null ? 'empty-val' : ''}" data-f="${ei}:${si}:r">${valHtml(s.r, 'Wdh', 0)}</button>
      </div>`).join('');
    return `<section class="panel ex-card" id="ex-${ei}">
      <div class="ex-top">
        <span class="ex-num" style="background:${color}">${ei + 1}</span>
        <h3 class="ex-name">${esc(e.name)}</h3>
        <div class="ex-actions">
          <button class="ibtn ${perm || e.note ? 'on' : ''}" data-note="${ei}" aria-label="Notiz">${ico('note')}</button>
          <button class="ibtn" data-exmenu="${ei}" aria-label="Mehr">${ico('more')}</button>
        </div>
      </div>
      ${perm ? `<div class="bubble"><small>Notiz</small>${esc(perm)}</div>` : ''}
      ${e.note ? `<div class="bubble today"><small>Heute</small>${esc(e.note)}</div>` : ''}
      <div class="last">${last ? `Letztes Mal (${fmtDate(last.workout.date, false)}): <b>${setsSummary(last.entry.sets)}</b>${last.entry.note ? ` · „${esc(last.entry.note)}“` : ''}` : 'Erstes Training dieser Übung – noch keine Vergleichswerte.'}</div>
      <div class="sets-head"><span>Satz</span><span>Gewicht</span><span>Wdh.</span></div>
      ${rows}
      <button class="add-set" data-addset="${ei}">${ico('plus')}Satz</button>
    </section>`;
  }).join('');

  v.innerHTML = `
    <label class="date-chip">${ico('calendar')}<span>${fmtDateLong(draft.date)}</span><input type="date" id="wDate" value="${draft.date}" aria-label="Datum ändern"></label>
    ${draft.entries.length > 1 ? `<div class="ex-strip">${chips}</div>` : ''}
    ${cards || '<div class="panel hint">Dieser Plan hat noch keine Übungen.</div>'}
    <p class="hint small center wo-legend">Graue Werte sind Vorschläge vom letzten Training. Ein Satz zählt, sobald du einen Wert einträgst – oder über die Satznummer den Vorschlag übernimmst.</p>
    <button class="btn dashed" id="wAddEx">${ico('plus')}Übung hinzufügen</button>
    <div class="gap"></div>
    ${draft.isNew ? '<button class="btn danger" id="wDiscard">Training verwerfen</button>' : '<button class="btn danger" id="wDelete">Training löschen</button>'}`;

  $('#footHolder').innerHTML = `<div class="wo-footer">
      <div class="clock"><span id="woCount"></span><small>Sätze</small></div>
      <button class="btn primary" id="wSave">${draft.isNew ? 'Training beenden' : 'Speichern'}</button>
    </div>`;

  /* Zähler und Übungs-Chips aktualisieren, ohne die Ansicht neu aufzubauen */
  const updateCounts = () => {
    let logged = 0, total = 0;
    draft.entries.forEach((e, ei) => {
      const n = e.sets.filter(isLogged).length;
      logged += n; total += e.sets.length;
      const chip = $(`[data-jump="${ei}"]`, v);
      if (chip) {
        $('b', chip).textContent = `${n}/${e.sets.length}`;
        chip.classList.toggle('part', n > 0 && n < e.sets.length);
        chip.classList.toggle('full', n > 0 && n >= e.sets.length);
      }
    });
    const count = $('#woCount');
    if (count) count.textContent = `${logged}/${total}`;
  };
  updateCounts();
  drawTimer();

  const fields = workoutFields();
  const highlight = (key) => {
    $$('.val.active', v).forEach((x) => x.classList.remove('active'));
    const el = key && $(`[data-f="${key}"]`, v);
    if (el) {
      el.classList.add('active');
      revealRow(el.closest('.set-row') || el);
    }
  };
  const refreshField = (f) => {
    const s = f.entry.sets[f.si];
    const isW = f.key.endsWith(':w');
    const btn = $(`[data-f="${f.key}"]`, v);
    if (!btn) return;
    btn.innerHTML = isW ? valHtml(s.w, 'kg', 2) : valHtml(s.r, 'Wdh', 0);
    btn.classList.toggle('ghost', !!(isW ? s.gw : s.gr));
    btn.classList.toggle('empty-val', f.get() == null);
    const row = btn.closest('.set-row');
    if (row) row.classList.toggle('logged', isLogged(s));
    updateCounts();
  };

  const openKeypad = (key) => {
    if (Keypad.isOpen() && Keypad.owner() === 'workout') { Keypad.update(fields); if (Keypad.focusKey(key)) return; }
    const start = fields.findIndex((f) => f.key === key);
    Keypad.open({
      owner: 'workout',
      fields,
      group: (f) => `${f.ei}:${f.si}`,   // Gewicht und Wdh. eines Satzes stehen nebeneinander
      title: (f) => `<b>${esc(f.entry.name)}</b> · Satz ${f.si + 1}`,
      okLabel: 'Fertig',
      onFocus: (f) => highlight(f.key),
      onChange: (f) => { saveDraftSoon(); refreshField(f); },
      onClose: () => { flushDraft(); highlight(null); },
    }, Math.max(0, start));
  };
  woOpenField = openKeypad;

  if (Keypad.isOpen() && Keypad.owner() === 'workout') {
    Keypad.update(fields);
    highlight(Keypad.currentKey());
  }

  $$('[data-f]', v).forEach((b) => b.onclick = () => openKeypad(b.dataset.f));

  $$('[data-jump]', v).forEach((b) => b.onclick = () => {
    const card = $(`#ex-${b.dataset.jump}`);
    if (card) scrollMainBy(card.getBoundingClientRect().top - v.getBoundingClientRect().top - 10, 320);
  });

  $$('[data-addset]', v).forEach((b) => b.onclick = () => {
    const ei = Number(b.dataset.addset);
    const sets = draft.entries[ei].sets;
    const prev = sets[sets.length - 1];
    // Neuer Satz übernimmt die Werte des vorigen als graue Vorschläge
    sets.push(prev ? { w: prev.w, r: prev.r, ...(prev.w != null ? { gw: true } : {}), ...(prev.r != null ? { gr: true } : {}) } : { w: null, r: null });
    saveDraft();
    render();
    if (woOpenField) woOpenField(`${ei}:${sets.length - 1}:w`);   // gleich weiter eintragen
  });

  $$('[data-setmenu]', v).forEach((b) => b.onclick = () => {
    const [ei, si] = b.dataset.setmenu.split(':').map(Number);
    const e = draft.entries[ei];
    const s = e.sets[si];
    const ghosts = (s.gw && s.w != null) || (s.gr && s.r != null);
    openSheet(`
      ${sheetHead(`${esc(e.name)} · Satz ${si + 1}`)}
      ${ghosts ? `<button class="btn primary" id="setTake">${ico('check')}Vorschlag übernehmen (${s.w != null ? fmtNum(s.w, 2) + ' kg' : '–'} × ${s.r ?? '–'})</button>` : ''}
      <button class="btn" id="setDup">${ico('dup')}Satz duplizieren</button>
      <button class="btn danger" id="setDel">${ico('trash')}Satz löschen</button>
    `, () => {
      if ($('#setTake')) $('#setTake').onclick = () => { delete s.gw; delete s.gr; saveDraft(); closeSheet(); render(); };
      $('#setDup').onclick = () => { e.sets.splice(si + 1, 0, { w: s.w, r: s.r }); saveDraft(); closeSheet(); render(); };
      $('#setDel').onclick = () => { e.sets.splice(si, 1); saveDraft(); closeSheet(); render(); };
    });
  });

  $$('[data-note]', v).forEach((b) => b.onclick = () => notesSheet(draft.entries[Number(b.dataset.note)]));

  $$('[data-exmenu]', v).forEach((b) => b.onclick = () => {
    const ei = Number(b.dataset.exmenu);
    const e = draft.entries[ei];
    openSheet(`
      ${sheetHead(esc(e.name))}
      <button class="btn" id="mNote">${ico('note')}Notizen</button>
      <button class="btn" id="mProg">${ico('progress')}Fortschritt</button>
      <button class="btn danger" id="mDel">Aus diesem Training entfernen</button>
      <p class="hint small center" style="margin-top:10px">Die Reihenfolge änderst du oben rechts.</p>
    `, () => {
      $('#mNote').onclick = () => notesSheet(e);
      $('#mProg').onclick = () => { closeSheet(); progressState.name = e.name; switchTab('progress'); };
      $('#mDel').onclick = () => {
        if (!confirm(`„${e.name}“ aus diesem Training entfernen?`)) return;
        draft.entries.splice(ei, 1); saveDraft(); closeSheet(); render();
      };
    });
  });

  if ($('#woReorder')) $('#woReorder').onclick = () => { Keypad.close(); workoutReorder(); };

  $('#wDate').onchange = (e) => {
    if (!e.target.value) return;
    draft.date = e.target.value;
    saveDraft();
    render();   // „Letztes Mal“ bezieht sich auf das Datum
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
  }, draft.entries.map((e) => e.name));

  $('#wSave').onclick = () => { Keypad.close(); finishWorkout(); };
  if ($('#wDiscard')) $('#wDiscard').onclick = () => {
    if (!confirm('Training verwerfen? Die Eingaben gehen verloren.')) return;
    Keypad.close(); draft = null; saveDraft(); back();
  };
  if ($('#wDelete')) $('#wDelete').onclick = () => {
    if (!confirm('Dieses Training endgültig löschen?')) return;
    Keypad.close();
    removeRec('workouts', draft.id);
    save(); draft = null; saveDraft(); back();
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
  }, '<label class="check-row"><input type="checkbox" id="applyPlan"><span>Auch im Plan dauerhaft so speichern</span></label>');
}

function notesSheet(entry) {
  openSheet(`
    ${sheetHead(esc(entry.name), 'note')}
    <label class="lbl" for="nPerm">Dauerhafte Notiz – bleibt bei jedem Training stehen</label>
    <textarea class="field" id="nPerm" rows="3" placeholder="z. B. Sitz Stufe 4, Lehne 2. Loch, Griff schulterbreit">${esc(getNote(entry.name))}</textarea>
    <label class="lbl" for="nToday">Notiz für heute – erscheint beim nächsten Mal unter „Letztes Mal“</label>
    <textarea class="field" id="nToday" rows="3" placeholder="z. B. Brust gut gespürt, Schulter zwickt">${esc(entry.note || '')}</textarea>
    <div class="gap-l"></div>
    <button class="btn primary" id="nSave">Speichern</button>
  `, () => {
    $('#nSave').onclick = () => {
      setNote(entry.name, $('#nPerm').value);
      entry.note = $('#nToday').value.trim();
      save(); saveDraft(); closeSheet(); render();
    };
  }, { full: true });
}

/** mode: undefined (ggf. nachfragen) · 'logged' (nur eingetragene Sätze) · 'all' (Vorschläge mitspeichern) */
function finishWorkout(mode) {
  flushDraft();
  const pending = draft.entries.reduce((a, e) => a + e.sets.filter((s) => !isLogged(s) && s.r != null && s.r > 0).length, 0);
  if (!mode && pending) {
    openSheet(`
      ${sheetHead(`${pending === 1 ? '1 Satz' : `${pending} Sätze`} nicht eingetragen`, 'info')}
      <p class="hint">${pending === 1 ? 'Dieser Satz zeigt' : 'Diese Sätze zeigen'} nur die grauen Vorschlagswerte vom letzten Training.</p>
      <button class="btn primary" id="finLogged">Nur eingetragene Sätze speichern</button>
      <button class="btn" id="finAll">Vorschlagswerte mitspeichern</button>
      <button class="btn quiet" id="finBack">Weiter trainieren</button>
    `, () => {
      $('#finLogged').onclick = () => { closeSheet(); finishWorkout('logged'); };
      $('#finAll').onclick = () => { closeSheet(); finishWorkout('all'); };
      $('#finBack').onclick = closeSheet;
    });
    return;
  }
  const keep = (s) => mode === 'all' || isLogged(s);
  const entries = draft.entries
    .map((e) => ({
      exerciseId: e.exerciseId, name: e.name,
      sets: e.sets.filter((s) => keep(s) && s.r != null && s.r > 0).map((s) => ({ w: s.w ?? 0, r: s.r })),
      ...(e.note ? { note: e.note } : {}),
    }))
    .filter((e) => e.sets.length);
  if (!entries.length) { toast('Trage mindestens einen Satz mit Wiederholungen ein'); return; }

  // Neue Rekorde (Gewicht) ermitteln
  const prs = [];
  for (const e of entries) {
    const max = Math.max(...e.sets.map((s) => s.w));
    let prev = null;
    data.workouts.forEach((w) => {
      if (w.id === draft.id) return;
      w.entries.forEach((x) => { if (norm(x.name) === norm(e.name)) x.sets.forEach((s) => { prev = Math.max(prev ?? 0, s.w); }); });
    });
    if (prev != null && prev > 0 && max > prev) prs.push({ name: e.name, max, prev });
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
  Keypad.close();
  draft = null; saveDraft();
  back();

  const sets = entries.reduce((a, e) => a + e.sets.length, 0);
  const vol = entries.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.w * s.r, 0), 0);
  openSheet(`<div class="ko">
    ${sheetHead(isNew ? 'Training abgeschlossen' : 'Training aktualisiert', 'check')}
    <p class="hint">${fmtDateLong(workout.date)} · ${esc(planName(workout.planId))}</p>
    <div class="stats">
      ${statCard('Sätze', sets)}
      ${statCard('Volumen', `${fmtNum(vol, 0)} kg`)}
      ${workout.dur ? statCard('Trainingszeit', fmtDur(workout.dur)) : ''}
      ${statCard(entries.length === 1 ? 'Übung' : 'Übungen', entries.length)}
    </div>
    ${prs.map((p) => `<div class="pr">${ico('trophy')}<div><b>Neuer Bestwert: ${esc(p.name)}</b><br><span class="small num">${fmtNum(p.max, 2)} kg (vorher ${fmtNum(p.prev, 2)} kg, +${fmtNum(((p.max - p.prev) / p.prev) * 100, 1)} %)</span></div></div>`).join('')}
    <button class="btn primary" id="koOk" style="margin-top:8px">Schließen</button>
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
        <button class="ibtn" id="prevM" aria-label="Vorheriger Monat">${ico('chevl')}</button>
        <h2>${MONTHS[m]} ${y}</h2>
        <button class="ibtn" id="nextM" aria-label="Nächster Monat">${ico('chevr')}</button>
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
    ${sheetHead(fmtDateLong(ds), 'calendar')}
    ${ws.length ? ws.map((w) => `
      <button class="row-item" data-w="${w.id}">
        <div class="stripe" style="background:${planColor(w.planId)}"></div>
        <div class="grow"><div class="t">${esc(planName(w.planId))}${w.dur ? ` · <span class="num">${fmtDur(w.dur)}</span>` : ''}</div>
        <div class="s">${w.entries.map((e) => esc(e.name)).join(', ')}</div></div><span class="chev">${ico('chevr')}</span>
      </button>`).join('') : '<p class="hint">An diesem Tag wurde nicht trainiert.</p>'}
    ${data.plans.length ? `<span class="label">Training nachtragen</span>
      ${data.plans.map((p) => `<button class="row-item" data-new="${p.id}"><i class="dot" style="background:${p.color}"></i><div class="grow t">${esc(p.name)}</div><span class="chev">${ico('plus')}</span></button>`).join('')}` : ''}
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
    const cross = $('.cross', el);
    if (cross) { cross.setAttribute('x1', coords[best][0]); cross.setAttribute('x2', coords[best][0]); cross.setAttribute('visibility', 'visible'); }
    tip.classList.remove('hint');
    tip.innerHTML = describe(best);
  };
  svg.addEventListener('click', (e) => pick(e.clientX));
  svg.addEventListener('touchmove', (e) => pick(e.touches[0].clientX), { passive: true });
}

/** Lineare Regression (kleinste Quadrate) über Tage → Steigung pro Tag */
function linearTrend(points) {
  if (points.length < 3) return null;
  const xs = points.map((p) => parseDate(p.date).getTime() / 86400000);
  const ys = points.map((p) => p.y);
  const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  let sxy = 0, sxx = 0, syy = 0;
  xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; syy += (ys[i] - my) ** 2; });
  if (!sxx) return null;
  const slope = sxy / sxx;
  const r2 = syy ? (sxy * sxy) / (sxx * syy) : 0;
  return { slope, intercept: my - slope * mx, r2, n };
}

/** points: [{date, y, label}] */
function lineChart(el, points, color, unit) {
  const W = 340, H = 214, L = 42, R = 12, T = 22, B = 28;
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
  const gid = 'g' + Math.random().toString(36).slice(2, 7);
  const trend = linearTrend(points);
  let trendLine = '';
  if (trend) {
    const ty = (t) => trend.intercept + trend.slope * (t / 86400000);
    const clamp = (v) => Math.min(H - B, Math.max(T, py(v)));
    trendLine = `<line x1="${px(x0)}" y1="${clamp(ty(x0))}" x2="${px(x1)}" y2="${clamp(ty(x1))}" style="stroke:var(--ink-2)" stroke-width="1.2" stroke-dasharray="4 4"/>`;
  }

  el.innerHTML = `
    <svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${color};stop-opacity:.16"/><stop offset="1" style="stop-color:${color};stop-opacity:0"/></linearGradient></defs>
      <text x="${L - 6}" y="${T - 10}" text-anchor="end">[${unit}]</text>
      ${ticks.map((t) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${py(t)}" y2="${py(t)}"/><text x="${L - 6}" y="${py(t) + 3.5}" text-anchor="end">${fmtNum(t)}</text>`).join('')}
      <line class="axis" x1="${L}" x2="${L}" y1="${T}" y2="${H - B}"/>
      <line class="axis" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>
      ${labelIdx.map((i) => `<line class="axis" x1="${coords[i][0]}" x2="${coords[i][0]}" y1="${H - B}" y2="${H - B + 4}"/><text x="${coords[i][0]}" y="${H - 9}" text-anchor="${anchor(i)}">${fmtDate(points[i].date, false)}</text>`).join('')}
      <path d="${area}" fill="url(#${gid})"/>
      ${trendLine}
      <path d="${path}" fill="none" style="stroke:${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${coords.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${points.length > 40 ? 1.8 : 3}" class="pt" style="stroke:${color}" stroke-width="1.6"/>`).join('')}
      <line class="cross" x1="0" x2="0" y1="${T}" y2="${H - B}" style="stroke:var(--ink-2)" stroke-width="1" stroke-dasharray="2 3" visibility="hidden"/>
      <circle class="hl" r="5" style="fill:${color};stroke:var(--surface)" stroke-width="2" visibility="hidden"/>
    </svg>
    <div class="chart-meta">n = ${points.length}${trend ? ` · Trend (lin. Regression): ${fmtSigned(trend.slope * 7, 2)} ${unit}/Woche · R² = ${fmtNum(trend.r2, 2)}` : ''}</div>
    <div class="chart-tip hint">Tippe ins Diagramm für Details</div>`;

  bindChartTip(el, coords, W, (i) => {
    const p = points[i];
    return `<b>${fmtNum(p.y)} ${unit}</b> · ${fmtDateLong(p.date)}${p.label ? `<br><span class="hint small">${esc(p.label)}</span>` : ''}`;
  });
}

/** bars: [{date, y}] – Tagesbalken mit Ziel-Linie */
function barChart(el, bars, goal, unit) {
  const W = 340, H = 204, L = 42, R = 10, T = 22, B = 28;
  const max = Math.max(goal || 0, ...bars.map((b) => b.y), 1);
  const ticks = niceTicks(0, max);
  const y1 = ticks[ticks.length - 1];
  const py = (v) => T + (1 - v / y1) * (H - T - B);
  const bw = (W - L - R) / bars.length;
  const coords = bars.map((b, i) => [L + bw * i + bw / 2, py(b.y)]);
  const step = Math.ceil(bars.length / 7);
  el.innerHTML = `
    <svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">
      <text x="${L - 6}" y="${T - 10}" text-anchor="end">[${unit}]</text>
      ${ticks.map((t) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${py(t)}" y2="${py(t)}"/><text x="${L - 6}" y="${py(t) + 3.5}" text-anchor="end">${fmtNum(t, 0)}</text>`).join('')}
      ${bars.map((b, i) => b.y ? `<rect x="${L + bw * i + bw * .18}" y="${py(b.y)}" width="${bw * .64}" height="${H - B - py(b.y)}" rx="1.5" style="fill:${goal && b.y > goal * 1.05 ? 'var(--red)' : 'var(--teal)'}" opacity=".85"/>` : '').join('')}
      ${goal ? `<line x1="${L}" x2="${W - R}" y1="${py(goal)}" y2="${py(goal)}" style="stroke:var(--ink-2)" stroke-width="1.2" stroke-dasharray="5 4"/><text x="${W - R}" y="${py(goal) - 5}" text-anchor="end" style="fill:var(--ink-2)">Ziel ${fmtNum(goal, 0)}</text>` : ''}
      <line class="axis" x1="${L}" x2="${L}" y1="${T}" y2="${H - B}"/>
      <line class="axis" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>
      ${bars.map((b, i) => (bars.length - 1 - i) % step ? '' : `<text x="${L + bw * i + bw / 2}" y="${H - 9}" text-anchor="middle">${fmtDate(b.date, false)}</text>`).join('')}
      <circle class="hl" r="4" style="fill:var(--ink);stroke:var(--surface)" stroke-width="2" visibility="hidden"/>
    </svg>
    <div class="chart-tip hint">Tippe auf einen Balken für Details</div>`;
  bindChartTip(el, coords, W, (i) => `<b>${fmtNum(bars[i].y, 0)} ${unit}</b> · ${fmtDateLong(bars[i].date)}`);
}

/** Vorzeichen mit echtem Minuszeichen (−) wie in Messprotokollen */
const fmtSigned = (n, d) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtNum(Math.abs(n), d)}`;
/** Einheit hinter einem Messwert kleiner absetzen: „82,4 kg“ → 82,4<small>kg</small> */
const withUnit = (v) => String(v).replace(/^(.*\d)\s+([^\d\s]+)$/, '$1<small>$2</small>');

function statCard(label, value, cls = '') {
  return `<div class="stat"><div class="v ${cls}">${withUnit(value)}</div><div class="k">${label}</div></div>`;
}
function diffCard(label, diff, unit, invert = false) {
  if (diff == null) return statCard(label, '–');
  const good = invert ? diff < 0 : diff > 0;
  return statCard(label, `${fmtSigned(diff)} ${unit}`, diff === 0 ? '' : good ? 'up' : 'down');
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
      <button data-ptab="exercise" class="${progressState.tab === 'exercise' ? 'on' : ''}">Übungen</button>
      <button data-ptab="weight" class="${progressState.tab === 'weight' ? 'on' : ''}">Körpergewicht</button>
    </div><div id="progView"></div>`;
  $$('[data-ptab]', v).forEach((b) => b.onclick = () => { progressState.tab = b.dataset.ptab; render(); });
  if (progressState.tab === 'weight') viewWeight($('#progView'));
  else viewExerciseProgress($('#progView'));
}

function viewExerciseProgress(v) {
  const names = new Map();
  sortedWorkouts().forEach((w) => w.entries.forEach((e) => { if (!names.has(norm(e.name))) names.set(norm(e.name), e.name); }));
  if (!names.size) {
    v.innerHTML = `<div class="empty"><div class="big">${ico('progress')}</div><p>Sobald du ein Training gespeichert hast, siehst du hier die Entwicklung pro Übung.</p></div>`;
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
    ${note ? `<div class="bubble"><small>Notiz</small>${esc(note)}</div>` : ''}
    <div style="height:14px"></div>
    <div class="seg">${Object.entries(METRICS).map(([k, mm]) => `<button data-metric="${k}" class="${k === progressState.metric ? 'on' : ''}">${mm.label}</button>`).join('')}</div>
    <div class="panel" id="chart"></div>
    <div class="stats">
      ${statCard('Start', `${fmtNum(first)} kg`)}
      ${statCard('Aktuell', `${fmtNum(lastV)} kg`)}
      ${statCard('Bestwert', `${fmtNum(Math.max(...ys))} kg`)}
      ${diffCard('Steigerung', points.length > 1 ? +(lastV - first).toFixed(1) : null, 'kg')}
    </div>
    <span class="label">Verlauf</span>
    ${[...points].reverse().map((p) => `<div class="row-item"><div class="grow"><div class="t">${fmtDateLong(p.date)}</div><div class="s">${esc(p.label)}</div>${notesOf[p.date] ? `<div class="s">Notiz: ${esc(notesOf[p.date])}</div>` : ''}</div><b>${withUnit(fmtNum(p.y) + ' kg')}</b></div>`).join('')}`;

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
    title: () => '<b>Körpergewicht</b>',
    extraHtml: () => dateFieldHtml(tmp.date),
    onDraw: (root) => bindDateField(root, tmp),
    okLabel: 'Speichern',
    onCancel: () => {},
    validate: () => (tmp.kg == null || tmp.kg < 20 || tmp.kg > 400 ? 'Bitte ein gültiges Gewicht eingeben' : ''),
    onDone: () => {
      const d = tmp.date;
      const id = 'w-' + d;
      const rec = data.weights.find((w) => w.id === id);
      if (rec) { rec.kg = tmp.kg; touch(rec); }
      else data.weights.push(touch({ id, date: d, kg: tmp.kg }));
      save(); toast('Gewicht gespeichert'); render();
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
      <div class="grow"><div class="hint">Aktuell</div><div class="num readout">${lastW ? withUnit(fmtNum(lastW.kg) + ' kg') : '–'}</div>
      ${lastW ? `<div class="hint small">${fmtDateLong(lastW.date)}</div>` : ''}</div>
      <button class="start-btn fab" id="wAdd" aria-label="Gewicht eintragen">${ico('plus')}</button>
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
      ${[...all].reverse().slice(0, 60).map((w) => `<button class="row-item" data-wid="${w.id}"><div class="grow t">${fmtDateLong(w.date)}</div><b>${withUnit(fmtNum(w.kg) + ' kg')}</b><span class="chev">${ico('chevr')}</span></button>`).join('')}
    ` : `<div class="empty"><div class="big">${ico('scale')}</div><p>Trag dein Gewicht regelmäßig ein, um den Verlauf zu sehen.</p></div>`}`;

  if (all.length) lineChart($('#wChart'), shown.map((w) => ({ date: w.date, y: w.kg })), 'var(--accent)', 'kg');
  $('#wAdd').onclick = () => weightEntry();
  $$('[data-range]', v).forEach((b) => b.onclick = () => { bodyState.range = Number(b.dataset.range); render(); });
  $$('[data-wid]', v).forEach((b) => b.onclick = () => {
    const w = data.weights.find((x) => x.id === b.dataset.wid);
    openSheet(`${sheetHead(fmtDateLong(w.date), 'scale')}<p class="num readout" style="margin:0 2px 16px">${withUnit(fmtNum(w.kg) + ' kg')}</p>
      <button class="btn" id="wEdit">${ico('edit')}Ändern</button><button class="btn danger" id="wDel">${ico('trash')}Löschen</button>`, () => {
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
  setHeader('Profil', `<button class="top-chip" id="themeBtn" aria-label="${isDark() ? 'Helles Design' : 'Dunkles Design'}">${ico(isDark() ? 'sun' : 'moon')}</button>`);
  const v = $('#view');
  const u = Sync.user();
  const st = data.settings;

  let account;
  if (!Sync.configured()) {
    account = `<p>Mit einem Konto werden deine Daten automatisch zwischen deinen Geräten synchronisiert und sind gesichert.</p>
      <p class="hint">Die Anmeldung ist noch nicht eingerichtet. Trage in <b>docs/config.js</b> die Daten deines kostenlosen Supabase-Projekts ein – die Schritt-für-Schritt-Anleitung steht in der README. Bis dahin werden alle Daten nur auf diesem Gerät gespeichert.</p>`;
  } else if (!u) {
    account = `<p style="margin-bottom:14px">Melde dich an, damit dein Stand auf allen Geräten gleich ist und gesichert wird.</p>
      <form id="loginForm" autocomplete="on">
        <input class="field" type="email" id="email" placeholder="E-Mail" autocomplete="username" inputmode="email" autocapitalize="off" autocorrect="off" required>
        <div class="gap"></div>
        <input class="field" type="password" id="pw" placeholder="Passwort (mind. 6 Zeichen)" autocomplete="current-password" required minlength="6">
        <div class="gap"></div>
        <button class="btn primary" type="submit" id="loginBtn">Anmelden</button>
      </form>
      <button class="btn" id="signupBtn" style="margin-top:10px">Neues Konto erstellen</button>
      <button class="btn quiet" id="forgotBtn">Passwort vergessen?</button>
      <p class="hint small center" id="authMsg"></p>`;
  } else {
    account = `<div class="account-row"><span class="emoji-big">${ico('profile')}</span><div class="grow"><div class="t">${esc(u.email)}</div><div class="hint small" id="syncStatus">${syncStatusHtml()}</div></div></div>
      <div class="btn-row"><button class="btn blue small" id="syncBtn">${ico('refresh')}Synchronisieren</button><button class="btn small" id="logoutBtn">${ico('logout')}Abmelden</button></div>`;
  }
  if (Sync.configured()) account += `<button class="btn link" id="diagBtn" style="margin-top:6px">${ico('search')}Verbindung prüfen</button>`;

  v.innerHTML = `
    <span class="label">Konto & Sync</span>
    <div class="panel">${account}</div>

    <span class="label">Darstellung</span>
    <div class="seg">${[['system', 'Wie iPhone'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([k, l]) => `<button data-theme-set="${k}" class="${getTheme() === k ? 'on' : ''}">${l}</button>`).join('')}</div>

    <span class="label">Ernährung</span>
    <button class="value-btn" id="goalsBtn">${ico('target')}<span>Tagesziele</span><b>${withUnit(fmtNum(st.kcalGoal, 0) + ' kcal')}</b></button>

    <span class="label">Daten</span>
    <button class="btn" id="xlsxBtn">${ico('table')}Excel-Export (.xlsx)</button>
    <button class="btn" id="exportBtn">${ico('download')}Sicherung exportieren</button>
    <button class="btn" id="importBtn">${ico('upload')}Sicherung importieren</button>
    <input type="file" id="importFile" accept="application/json,.json" hidden>

    <span class="label">App</span>
    <button class="btn" id="updateBtn">${ico('refresh')}Nach Update suchen</button>
    <p class="hint center small" style="margin-top:14px">Fightclub · Version ${APP_VERSION} · Daten ${Sync.user() ? 'werden synchronisiert' : 'liegen nur auf diesem Gerät'}</p>
    <p class="hint center small num" id="screenInfo">${screenInfo()}</p>`;

  if ($('#loginForm')) {
    const msg = (t) => { $('#authMsg').textContent = t; };
    const creds = () => ({ email: $('#email').value.trim(), pw: $('#pw').value });
    $('#loginForm').onsubmit = async (e) => {
      e.preventDefault();
      const { email, pw } = creds();
      $('#loginBtn').disabled = true; msg('Anmelden …');
      try { await Sync.signIn(email, pw); blurActive(); toast('Angemeldet'); render(); scrollTop(); }
      catch (err) { msg(err.message); $('#loginBtn').disabled = false; }
    };
    $('#signupBtn').onclick = async () => {
      const { email, pw } = creds();
      if (!email || pw.length < 6) { msg('Bitte E-Mail und ein Passwort mit mind. 6 Zeichen eingeben.'); return; }
      msg('Konto wird erstellt …');
      try {
        const loggedIn = await Sync.signUp(email, pw);
        if (loggedIn) { blurActive(); toast('Konto erstellt'); render(); scrollTop(); }
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
  $('#goalsBtn').onclick = goalsSheet;
  $('#updateBtn').onclick = checkForUpdate;
  $('#themeBtn').onclick = () => { applyTheme(isDark() ? 'light' : 'dark'); render(); };
  $$('[data-theme-set]', v).forEach((b) => b.onclick = () => { applyTheme(b.dataset.themeSet); render(); });
}

/** Messwerte zur Anzeige – hilft, falls die App auf einem Gerät nicht bis zum Rand reicht. */
function screenInfo() {
  const standalone = document.documentElement.classList.contains('standalone');
  return `Anzeige ${window.innerWidth} × ${window.innerHeight} · Bildschirm ${screen.width} × ${screen.height}${standalone ? ' · Home-Bildschirm-App' : ''}`;
}

Sync.onChange(() => {
  const el = $('#syncStatus');
  if (el) el.innerHTML = syncStatusHtml();
});

async function diagnoseSheet() {
  openSheet(`${sheetHead('Verbindung', 'search')}<div id="diagList"><p class="hint">Prüfe …</p></div>`);
  const checks = await Sync.diagnose();
  const list = $('#diagList');
  if (list) list.innerHTML = checks.map((c) => `<div class="row-item diag ${c.ok ? 'ok' : 'bad'}">${ico(c.ok ? 'check' : 'x')}<div class="grow">${esc(c.text)}</div></div>`).join('');
}

function passwordSheet() {
  openSheet(`${sheetHead('Neues Passwort')}
    <input class="field" type="password" id="newPw" placeholder="Neues Passwort (mind. 6 Zeichen)" autocomplete="new-password">
    <div style="height:14px"></div>
    <button class="btn primary" id="newPwSave">Speichern</button>
    <p class="hint center" id="newPwMsg"></p>`, () => {
    $('#newPwSave').onclick = async () => {
      const pw = $('#newPw').value;
      if (pw.length < 6) { $('#newPwMsg').textContent = 'Mindestens 6 Zeichen.'; return; }
      try { await Sync.setPassword(pw); closeSheet(); toast('Passwort geändert'); Sync.syncNow(); }
      catch (err) { $('#newPwMsg').textContent = err.message; }
    };
  }, { full: true });
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
    { name: 'Rezepte', rows: data.recipes.flatMap((r) => r.items.map((it) => {
        const n = calcNutrition(it.per100, it.amount);
        return [r.name, r.servings, it.name, it.brand || '', it.amount, n.kcal, n.p, n.c, n.f];
      })), columns: [
      { header: 'Rezept', width: 26 }, { header: 'Portionen', type: 'int', width: 10 }, { header: 'Zutat', width: 30 }, { header: 'Marke', width: 16 },
      { header: 'Menge (g)', type: 'int', width: 10 }, { header: 'Kalorien (kcal)', type: 'int', width: 15 }, { header: 'Eiweiß (g)', type: 'num', width: 11 },
      { header: 'Kohlenhydrate (g)', type: 'num', width: 17 }, { header: 'Fett (g)', type: 'num', width: 9 }] },
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
   iPHONE: festes Gerüst, sofortige Rückmeldung, Tastatur
   ========================================================= */

/* Wischen auf Kopfzeile, Leisten oder dem Hintergrund eines Dialogs bewegt nichts (sonst
   federt in Safari die ganze Seite nach). Das regelt style.css über touch-action: none –
   der Browser kann dadurch im Inhalt sofort scrollen, ohne erst JavaScript zu fragen.
   Nur sehr alte Browser brauchen noch diesen Wächter. */
if (!(window.CSS && CSS.supports && CSS.supports('touch-action', 'none'))) {
  const SCROLLABLE = 'main, .sheet-card, .keypad, .kp-chiprow, .ex-strip, .search-actions, .scanner';
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) { e.preventDefault(); return; } // kein Zoomen
    const box = e.target.closest && e.target.closest(SCROLLABLE);
    if (!box) e.preventDefault();
  }, { passive: false });
}
document.addEventListener('gesturestart', (e) => e.preventDefault()); // iOS-Pinch-Zoom aus

/* Sofortige Rückmeldung beim Antippen (iOS zeigt :active nur verzögert oder gar nicht).
   In scrollbaren Bereichen einen Moment warten – wird gescrollt, leuchtet nichts auf. */
(() => {
  let el = null;
  let timer = null;
  let t0 = 0;
  document.addEventListener('pointerdown', (e) => {
    if (el) el.classList.remove('pressed');
    clearTimeout(timer);
    el = null;
    const b = e.target.closest && e.target.closest('button');
    if (!b || b.disabled) return;
    el = b;
    t0 = performance.now();
    if (b.closest('.keypad, .topbar, .tabbar, #footHolder, #timerHolder')) b.classList.add('pressed');
    else timer = setTimeout(() => { if (el === b) b.classList.add('pressed'); }, 70);
  }, { capture: true, passive: true });
  const release = (cancelled) => {
    if (!el) return;
    const b = el;
    el = null;
    clearTimeout(timer);
    if (cancelled) { b.classList.remove('pressed'); return; }
    b.classList.add('pressed');   // auch ganz kurzes Tippen sichtbar machen
    setTimeout(() => b.classList.remove('pressed'), Math.max(90, 150 - (performance.now() - t0)));
  };
  document.addEventListener('pointerup', () => release(false), { capture: true, passive: true });
  document.addEventListener('pointercancel', () => release(true), { capture: true, passive: true });
})();

const resetViewport = () => {
  if (window.scrollY || window.scrollX || document.scrollingElement.scrollTop) window.scrollTo(0, 0);
};

/* Texteingaben: Das Feld wird schon beim Antippen in den oberen Bildschirmbereich
   geholt. So steht es über der Tastatur, und iOS muss die Seite nicht verschieben. */
const TEXT_INPUT = 'textarea, input:not([type="date"]):not([type="checkbox"]):not([type="radio"]):not([type="file"])';
let typingTimer = null;
document.addEventListener('focusin', (e) => {
  const t = e.target;
  if (!t.matches || !t.matches(TEXT_INPUT)) return;
  clearTimeout(typingTimer);
  document.body.classList.add('typing');
  const box = t.closest('.sheet-card, main');
  if (!box) return;
  const r = t.getBoundingClientRect();
  if (r.bottom <= window.innerHeight * 0.42) return;
  const sticky = $('.sheet-head, .search-top', box);
  const topEdge = box.getBoundingClientRect().top + (sticky ? sticky.offsetHeight : 0) + 34;
  box.scrollTop += r.top - topEdge;
});
document.addEventListener('focusout', () => {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    const a = document.activeElement;
    if (a && a.matches && a.matches(TEXT_INPUT)) return;   // gleich ins nächste Feld gewechselt
    document.body.classList.remove('typing');
    flushPendingRender();
  }, 260);
  setTimeout(resetViewport, 60);
});

/* Sicherheitsnetz: Verschiebt iOS die Seite trotzdem (sichtbarer Bereich beginnt
   nicht mehr oben), folgt das Gerüst dem sichtbaren Bereich über der Tastatur –
   Kopfzeile und Eingabefeld bleiben stehen. Ohne Verschiebung ändert sich nichts. */
let vvTick = false;
function syncViewport() {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement.style;
  const keyboard = window.innerHeight - vv.height > 120;
  const shifted = keyboard && vv.offsetTop > 1;
  if (shifted) {
    root.setProperty('--vv-h', vv.height + 'px');
    root.setProperty('--vv-top', vv.offsetTop + 'px');
  }
  document.body.classList.toggle('kb-open', shifted);
  if (!keyboard) setTimeout(resetViewport, 60);
}
function queueViewport() {
  if (vvTick) return;
  vvTick = true;
  requestAnimationFrame(() => { vvTick = false; syncViewport(); });
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', queueViewport);
  window.visualViewport.addEventListener('scroll', queueViewport);
}
window.addEventListener('orientationchange', () => setTimeout(syncViewport, 300));
syncViewport();
window.addEventListener('resize', () => {
  queueViewport();
  const info = $('#screenInfo');
  if (info) info.textContent = screenInfo();
});
window.addEventListener('scroll', () => { if (!document.activeElement || !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) resetViewport(); });

/* =========================================================
   START
   ========================================================= */

// Dort weitermachen, wo man zuletzt war (höchstens eine Stunde her)
try {
  const last = JSON.parse(localStorage.getItem(NAV_KEY));
  if (last && TABS.includes(last.tab) && Date.now() - last.t < 3600000) {
    nav.tab = last.tab;
    if (last.workout && draft) nav.stack = [{ view: 'workout' }];
  }
} catch (e) { /* egal */ }

render();

/* Nach einem automatischen Neuladen (Update) an derselben Stelle weitermachen */
const SCROLL_KEY = 'fightclub-scroll';
try {
  const s = JSON.parse(sessionStorage.getItem(SCROLL_KEY));
  sessionStorage.removeItem(SCROLL_KEY);
  if (s && Date.now() - s.t < 15000 && s.view === current().view) $('#view').scrollTop = s.y;
} catch (e) { /* egal */ }

function reloadApp() {
  try { sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ y: $('#view').scrollTop, view: current().view, t: Date.now() })); } catch (e) { /* egal */ }
  flushDraft();
  rememberNav();
  location.reload();
}

/* Offline-Speicher (sw.js): Die App startet sofort aus dem Speicher des Geräts, ohne
   auf das Netz zu warten. Eine neue Version wird im Hintergrund geladen und – solange
   noch nichts angetippt wurde – gleich übernommen, sonst beim nächsten Öffnen. */
const bootTime = Date.now();
let userActed = false;
document.addEventListener('pointerdown', () => { userActed = true; }, { capture: true, once: true, passive: true });
let swReg = null;
let reloadWanted = false;    // „Nach Update suchen“ wurde angetippt
let updatePending = false;   // neue Version liegt bereit
let lastUpdateCheck = Date.now();
const canReload = () => !busyInput() && !$('.scanner');

function applyUpdate(msg) {
  const quiet = reloadWanted || (!userActed && Date.now() - bootTime < 20000);
  if (quiet && canReload()) { reloadApp(); return; }
  if (!updatePending) toast(msg || 'Neue Version geladen – aktiv beim nächsten Öffnen');
  updatePending = true;
}

/** Höchste Versionsnummer, die im Speicher des Geräts liegt (Speicher heißen „fightclub-v13“ …). */
async function storedVersion() {
  const nums = (await caches.keys()).map((k) => /^fightclub-v(\d+)$/.exec(k)).filter(Boolean).map((m) => Number(m[1]));
  return nums.length ? Math.max(...nums) : 0;
}

if ('serviceWorker' in navigator) {
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', async () => {
    const first = !controlled;
    controlled = true;
    if (first) return;   // allererste Installation: nichts neu zu laden
    // Läuft diese Seite schon mit der neuesten gespeicherten Version (etwa beim Umstieg
    // von einer älteren App-Version, die noch aus dem Netz geladen hat), ist nichts zu tun.
    try { if ((await storedVersion()) <= Number(APP_VERSION)) return; } catch (e) { /* dann neu laden */ }
    applyUpdate();
  });
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (!e.data || e.data.type !== 'config-changed') return;
    // config.js wurde geändert (z. B. Zugangsdaten für die Synchronisierung) – höchstens einmal pro Minute neu laden
    let recent = false;
    try {
      recent = Date.now() - Number(sessionStorage.getItem('fightclub-config-reload') || 0) < 60000;
      sessionStorage.setItem('fightclub-config-reload', String(Date.now()));
    } catch (err) { /* egal */ }
    if (!recent) applyUpdate('Einstellungen aktualisiert – aktiv beim nächsten Öffnen');
  });
  navigator.serviceWorker.register('sw.js').then((reg) => { swReg = reg; }).catch(() => {});
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (updatePending && canReload()) { reloadApp(); return; }
    if (swReg && Date.now() - lastUpdateCheck > 60000) {
      lastUpdateCheck = Date.now();
      swReg.update().catch(() => {});
    }
  });
}

/** Profil → „Nach Update suchen“ */
async function checkForUpdate() {
  if (!swReg) { reloadApp(); return; }
  toast('Suche nach Updates …');
  reloadWanted = true;
  lastUpdateCheck = Date.now();
  try {
    await Promise.race([
      swReg.update(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Zeitüberschreitung')), 15000)),
    ]);
  } catch (e) {
    reloadWanted = false;
    toast('Keine Verbindung – bitte später erneut versuchen');
    return;
  }
  const worker = swReg.installing || swReg.waiting;
  if (worker) {
    toast('Update wird geladen …');
    worker.addEventListener('statechange', () => {
      if (worker.state !== 'redundant') return;
      reloadWanted = false;
      toast('Update konnte nicht geladen werden – bitte später erneut versuchen');
    });
    return;
  }
  reloadWanted = false;
  if (updatePending) { reloadApp(); return; }
  openSheet(`${sheetHead('Fightclub ist aktuell', 'check')}
    <p class="hint">Du nutzt Version ${APP_VERSION} – eine neuere gibt es nicht.</p>
    <button class="btn" id="hardReload">${ico('refresh')}App neu laden</button>
    <p class="hint small center" style="margin-top:10px">Lädt alle Dateien frisch vom Server – hilfreich, falls einmal etwas nicht stimmt. Deine Daten bleiben erhalten.</p>`, () => {
    $('#hardReload').onclick = hardReload;
  });
}

/** Alle Dateien frisch vom Server holen: Speicher der App leeren und neu laden.
    Vorher wird geprüft, ob der Server erreichbar ist – offline bliebe die App sonst leer. */
async function hardReload() {
  toast('Lade neu …');
  try {
    const r = await fetch(`index.html?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
  } catch (e) {
    toast('Keine Verbindung – bitte später erneut versuchen');
    return;
  }
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('fightclub-')).map((k) => caches.delete(k)));
    if (swReg) await swReg.unregister();
  } catch (e) { /* dann eben nur neu laden */ }
  closeSheet();
  reloadApp();
}

Sync.handleRedirect().then((type) => {
  if (type === 'recovery') { switchTab('profile'); passwordSheet(); }
  else if (type) { toast('E-Mail bestätigt'); switchTab('profile'); }
  Sync.syncNow();
});
