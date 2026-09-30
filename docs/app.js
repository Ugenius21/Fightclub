'use strict';

/* =========================================================
   Fightclub – Trainings- und Körpergewicht-Tracker (PWA)
   Alle Daten liegen lokal im Browser (localStorage).
   ========================================================= */

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

/* ---------------- Daten ---------------- */

function loadData() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY));
    if (d && Array.isArray(d.plans)) return { plans: d.plans, workouts: d.workouts || [], weights: d.weights || [] };
  } catch (e) { /* leer starten */ }
  return { plans: [], workouts: [], weights: [] };
}

let data = loadData();
let draft = null;
try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch (e) { draft = null; }

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
  catch (e) { alert('Speichern fehlgeschlagen: ' + e.message); }
}
function saveDraft() {
  try {
    if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else localStorage.removeItem(DRAFT_KEY);
  } catch (e) { /* ignorieren */ }
}

// Den Browser bitten, die Daten nicht automatisch zu löschen.
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ---------------- Hilfsfunktionen ---------------- */

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s || '').trim().toLowerCase();
const num = (s) => { const n = parseFloat(String(s ?? '').replace(',', '.')); return isFinite(n) ? n : null; };
const fmtNum = (n, d = 1) => n == null ? '–' : Number(n).toLocaleString('de-DE', { maximumFractionDigits: d });
const pad = (n) => String(n).padStart(2, '0');
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => dateStr(new Date());
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
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

/** Letzter Eintrag zu einer Übung (nach Name), vor bzw. am angegebenen Datum. */
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
  return sets.map((s) => `${fmtNum(s.w)} kg × ${s.r ?? '–'}`).join(' · ');
}

function stripeBackground(colors) {
  if (colors.length === 1) return colors[0];
  const step = 100 / colors.length;
  return `linear-gradient(135deg, ${colors.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(', ')})`;
}

function toast(msg) {
  document.querySelectorAll('.toast').forEach((x) => x.remove());
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

/* ---------------- Navigation ---------------- */

const nav = { tab: 'plans', stack: [] };
const current = () => nav.stack[nav.stack.length - 1] || { view: nav.tab };

function go(view, params = {}) { nav.stack.push({ view, ...params }); render(); window.scrollTo(0, 0); }
function back() { nav.stack.pop(); render(); window.scrollTo(0, 0); }
function switchTab(tab) { nav.tab = tab; nav.stack = []; render(); window.scrollTo(0, 0); }

$('#backBtn').addEventListener('click', back);
document.querySelectorAll('.tabbar button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

function setHeader(title, actionHtml = '') {
  $('#title').textContent = title;
  $('#backBtn').classList.toggle('off', nav.stack.length === 0);
  $('#topAction').innerHTML = actionHtml;
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === nav.tab));
}

function render() {
  const c = current();
  const views = { plans: viewPlans, plan: viewPlan, workout: viewWorkout, calendar: viewCalendar, progress: viewProgress, weight: viewWeight };
  (views[c.view] || viewPlans)(c);
}

/* ---------------- Bottom-Sheet ---------------- */

function openSheet(html, onMount) {
  $('#sheetCard').innerHTML = html;
  $('#sheet').hidden = false;
  if (onMount) onMount($('#sheetCard'));
}
function closeSheet() { $('#sheet').hidden = true; $('#sheetCard').innerHTML = ''; }
$('.sheet-backdrop').addEventListener('click', closeSheet);

function colorPicker(selected) {
  return `<div class="colors">${COLORS.map(([n, h]) =>
    `<button type="button" data-color="${h}" aria-label="${n}" class="${h === selected ? 'on' : ''}" style="background:${h}"></button>`).join('')}</div>`;
}
function bindColorPicker(root, onPick) {
  root.querySelectorAll('[data-color]').forEach((b) => b.addEventListener('click', () => {
    root.querySelectorAll('[data-color]').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    onPick(b.dataset.color);
  }));
}

/* =========================================================
   PLÄNE
   ========================================================= */

function viewPlans() {
  setHeader('Fightclub', `<button class="link-btn" id="addPlan">＋ Plan</button>`);
  const v = $('#view');
  let html = '';

  if (draft) {
    html += `<button class="list-item" id="resume" style="border:1.5px solid ${planColor(draft.planId)}">
      <div class="plan-bar" style="background:${planColor(draft.planId)}"></div>
      <div class="grow"><div class="title">Training läuft: ${esc(planName(draft.planId))}</div>
      <div class="muted small">${fmtDateLong(draft.date)} · Tippen zum Fortsetzen</div></div><div class="chev">›</div></button>`;
  }

  if (!data.plans.length) {
    html += `<div class="empty"><div class="big">🥊</div>
      <p>Willkommen im Fightclub!<br>Lege deinen ersten Trainingsplan an, z. B. „Push“.</p></div>
      <button class="btn primary" id="firstPlan">Trainingsplan erstellen</button>
      <button class="btn" id="samples">Beispielpläne anlegen (Push, Pull, Beine)</button>`;
  } else {
    html += data.plans.map((p) => {
      const last = sortedWorkouts().find((w) => w.planId === p.id);
      return `<button class="list-item" data-plan="${p.id}">
        <div class="plan-bar" style="background:${p.color}"></div>
        <div class="grow"><div class="title">${esc(p.name)}</div>
        <div class="muted small">${p.exercises.length} Übung${p.exercises.length === 1 ? '' : 'en'}${last ? ' · zuletzt ' + fmtDate(last.date) : ''}</div></div>
        <div class="chev">›</div></button>`;
    }).join('');
  }

  html += `<div class="section-title">Daten</div>
    <div class="card small muted">Deine Daten werden nur auf diesem iPhone gespeichert. Erstelle ab und zu eine Sicherung.</div>
    <button class="btn" id="exportBtn">Sicherung exportieren</button>
    <button class="btn" id="importBtn">Sicherung importieren</button>
    <input type="file" id="importFile" accept="application/json,.json" hidden>`;

  v.innerHTML = html;

  $('#addPlan').onclick = () => planEditor();
  if ($('#firstPlan')) $('#firstPlan').onclick = () => planEditor();
  if ($('#samples')) $('#samples').onclick = createSamples;
  if ($('#resume')) $('#resume').onclick = () => go('workout');
  v.querySelectorAll('[data-plan]').forEach((b) => b.onclick = () => go('plan', { planId: b.dataset.plan }));
  $('#exportBtn').onclick = exportData;
  $('#importBtn').onclick = () => $('#importFile').click();
  $('#importFile').onchange = importData;
}

function createSamples() {
  for (const [name, color, exs] of SAMPLE_PLANS) {
    data.plans.push({ id: uid(), name, color, exercises: exs.map((n) => ({ id: uid(), name: n })) });
  }
  save();
  render();
}

function planEditor(plan) {
  const isNew = !plan;
  const used = data.plans.map((p) => p.color);
  let color = plan ? plan.color : (COLORS.find(([, h]) => !used.includes(h)) || COLORS[0])[1];
  openSheet(`
    <h2>${isNew ? 'Neuer Trainingsplan' : 'Plan bearbeiten'}</h2>
    <label class="lbl">Name</label>
    <input class="field" id="planName" placeholder="z. B. Push" value="${esc(plan ? plan.name : '')}" autocomplete="off">
    <label class="lbl">Farbe im Kalender</label>
    ${colorPicker(color)}
    <div style="height:18px"></div>
    <button class="btn primary" id="savePlan">${isNew ? 'Erstellen' : 'Speichern'}</button>
    ${isNew ? '' : '<button class="btn danger" id="delPlan">Plan löschen</button>'}
    <button class="btn" id="cancel">Abbrechen</button>
  `, (root) => {
    bindColorPicker(root, (c) => color = c);
    if (isNew) setTimeout(() => $('#planName').focus(), 50);
    $('#cancel').onclick = closeSheet;
    $('#savePlan').onclick = () => {
      const name = $('#planName').value.trim();
      if (!name) { $('#planName').focus(); return; }
      if (isNew) {
        const p = { id: uid(), name, color, exercises: [] };
        data.plans.push(p);
        save(); closeSheet(); go('plan', { planId: p.id });
      } else {
        plan.name = name; plan.color = color;
        save(); closeSheet(); render();
      }
    };
    if ($('#delPlan')) $('#delPlan').onclick = () => {
      if (!confirm(`„${plan.name}“ löschen? Bereits gespeicherte Trainings bleiben erhalten.`)) return;
      data.plans = data.plans.filter((p) => p.id !== plan.id);
      save(); closeSheet(); back();
    };
  });
}

function viewPlan({ planId }) {
  const plan = planById(planId);
  if (!plan) { back(); return; }
  setHeader(plan.name, `<button class="link-btn" id="editPlan">Bearbeiten</button>`);
  const v = $('#view');

  const exHtml = plan.exercises.map((ex, i) => {
    const last = lastEntryFor(ex.name);
    return `<button class="list-item" data-ex="${i}">
      <div class="grow"><div class="title">${esc(ex.name)}</div>
      <div class="muted small">${last ? `Zuletzt ${fmtDate(last.workout.date, false)}: ${setsSummary(last.entry.sets)}` : 'Noch nicht trainiert'}</div></div>
      <div class="chev">⋯</div></button>`;
  }).join('');

  v.innerHTML = `
    <button class="btn primary" id="start" style="background:${plan.color}">▶ Training starten</button>
    <div class="section-title">Übungen</div>
    ${exHtml || '<div class="card muted small">Noch keine Übungen. Füge z. B. Bankdrücken oder Butterfly hinzu.</div>'}
    <button class="btn dashed" id="addEx">＋ Übung hinzufügen</button>`;

  $('#editPlan').onclick = () => planEditor(plan);
  $('#addEx').onclick = () => addExerciseSheet((name) => { plan.exercises.push({ id: uid(), name }); save(); render(); });
  $('#start').onclick = () => startWorkout(plan.id, todayStr());
  v.querySelectorAll('[data-ex]').forEach((b) => b.onclick = () => exerciseMenu(plan, Number(b.dataset.ex)));
}

/** Sheet zum schnellen Hinzufügen mehrerer Übungen hintereinander. */
function addExerciseSheet(onAdd) {
  const known = [...new Set(data.plans.flatMap((p) => p.exercises.map((e) => e.name)))].sort((a, b) => a.localeCompare(b, 'de'));
  openSheet(`
    <h2>Übung hinzufügen</h2>
    <div class="row">
      <input class="field grow" id="exName" placeholder="z. B. Bankdrücken" list="exList" autocomplete="off" enterkeyhint="done">
      <button class="btn primary" id="exAdd" style="width:auto;padding:12px 18px">＋</button>
    </div>
    <datalist id="exList">${known.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
    <p class="muted small" id="exAdded"></p>
    <button class="btn" id="exDone">Fertig</button>
  `, () => {
    const input = $('#exName');
    const added = [];
    const add = () => {
      const name = input.value.trim();
      if (!name) { input.focus(); return; }
      onAdd(name);
      added.push(name);
      $('#exAdded').textContent = 'Hinzugefügt: ' + added.join(', ');
      input.value = '';
      input.focus();
    };
    $('#exAdd').onclick = add;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    $('#exDone').onclick = () => { if (input.value.trim()) add(); closeSheet(); };
    setTimeout(() => input.focus(), 50);
  });
}

function exerciseMenu(plan, idx) {
  const ex = plan.exercises[idx];
  openSheet(`
    <h2>${esc(ex.name)}</h2>
    <label class="lbl">Name</label>
    <input class="field" id="exRename" value="${esc(ex.name)}" autocomplete="off">
    <div style="height:14px"></div>
    <button class="btn primary" id="exSave">Speichern</button>
    <div class="row" style="margin-top:10px">
      <button class="btn grow" id="exUp" ${idx === 0 ? 'disabled style="opacity:.4"' : ''}>↑ Nach oben</button>
      <button class="btn grow" id="exDown" style="margin-top:0;${idx === plan.exercises.length - 1 ? 'opacity:.4' : ''}" ${idx === plan.exercises.length - 1 ? 'disabled' : ''}>↓ Nach unten</button>
    </div>
    <button class="btn" id="exProg">📈 Fortschritt ansehen</button>
    <button class="btn danger" id="exDel">Übung aus Plan entfernen</button>
  `, () => {
    $('#exSave').onclick = () => {
      const name = $('#exRename').value.trim();
      if (!name) return;
      // Gespeicherte Trainings mit umbenennen, damit der Verlauf erhalten bleibt.
      data.workouts.forEach((w) => w.entries.forEach((e) => { if (e.exerciseId === ex.id) e.name = name; }));
      ex.name = name;
      save(); closeSheet(); render();
    };
    const move = (d) => { const [e] = plan.exercises.splice(idx, 1); plan.exercises.splice(idx + d, 0, e); save(); closeSheet(); render(); };
    $('#exUp').onclick = () => move(-1);
    $('#exDown').onclick = () => move(1);
    $('#exProg').onclick = () => { closeSheet(); nav.tab = 'progress'; nav.stack = []; progressState.name = ex.name; render(); };
    $('#exDel').onclick = () => {
      if (!confirm(`„${ex.name}“ aus dem Plan entfernen? Der Verlauf bleibt erhalten.`)) return;
      plan.exercises.splice(idx, 1);
      save(); closeSheet(); render();
    };
  });
}

/* =========================================================
   TRAINING
   ========================================================= */

/** Neuen Satz-Eintrag für eine Übung erzeugen – vorbelegt mit den Werten vom letzten Training. */
function newEntry(ex, date) {
  const last = lastEntryFor(ex.name, date);
  const sets = last ? last.entry.sets.map((s) => ({ w: s.w, r: s.r })) : [{ w: null, r: null }];
  return { exerciseId: ex.id, name: ex.name, sets };
}

function startWorkout(planId, date) {
  if (draft && !confirm('Es läuft bereits ein nicht gespeichertes Training. Verwerfen und neu beginnen?')) {
    go('workout');
    return;
  }
  const plan = planById(planId);
  draft = { id: uid(), planId, date, isNew: true, entries: plan.exercises.map((ex) => newEntry(ex, date)) };
  saveDraft();
  go('workout');
}

function editWorkout(w) {
  if (draft && !confirm('Es läuft bereits ein nicht gespeichertes Training. Verwerfen?')) return;
  draft = JSON.parse(JSON.stringify(w));
  draft.isNew = false;
  saveDraft();
  go('workout');
}

function viewWorkout() {
  if (!draft) { back(); return; }
  const color = planColor(draft.planId);
  setHeader(planName(draft.planId), `<button class="link-btn" id="wSaveTop">Fertig</button>`);
  const v = $('#view');

  const cards = draft.entries.map((e, ei) => {
    const last = lastEntryFor(e.name, draft.date, draft.id);
    const rows = e.sets.map((s, si) => `
      <tr>
        <td class="nr">${si + 1}</td>
        <td><input inputmode="decimal" enterkeyhint="next" data-e="${ei}" data-s="${si}" data-k="w" value="${s.w ?? ''}" placeholder="kg"></td>
        <td><input inputmode="numeric" pattern="[0-9]*" enterkeyhint="next" data-e="${ei}" data-s="${si}" data-k="r" value="${s.r ?? ''}" placeholder="Wdh"></td>
        <td class="del"><button class="x-btn" data-delset="${ei}:${si}" aria-label="Satz löschen">✕</button></td>
      </tr>`).join('');
    return `<div class="card ex-card">
      <div class="row"><h3 class="grow">${esc(e.name)}</h3><button class="x-btn" data-delex="${ei}" aria-label="Übung entfernen">⋯</button></div>
      <div class="last-hint">${last ? `Letztes Mal (${fmtDate(last.workout.date, false)}): ${setsSummary(last.entry.sets)}` : 'Erstes Training dieser Übung'}</div>
      <table class="sets"><thead><tr><th>Satz</th><th>Gewicht (kg)</th><th>Wdh.</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      <button class="add-set" data-addset="${ei}">＋ Satz hinzufügen</button>
    </div>`;
  }).join('');

  v.innerHTML = `
    <div class="card row" style="border-left:5px solid ${color}">
      <div class="grow"><div class="muted small">Datum</div></div>
      <input type="date" class="field" id="wDate" value="${draft.date}" style="width:auto">
    </div>
    ${cards || '<div class="card muted small">Dieser Plan hat noch keine Übungen.</div>'}
    <button class="btn dashed" id="wAddEx">＋ Übung hinzufügen</button>
    <div style="height:14px"></div>
    <button class="btn primary" id="wSave" style="background:${color}">Training speichern</button>
    ${draft.isNew ? '<button class="btn danger" id="wDiscard">Training verwerfen</button>' : '<button class="btn danger" id="wDelete">Training löschen</button>'}`;

  // Eingaben direkt übernehmen, ohne neu zu zeichnen (Fokus bleibt erhalten).
  v.querySelectorAll('.sets input').forEach((inp) => {
    inp.addEventListener('input', () => {
      const s = draft.entries[inp.dataset.e].sets[inp.dataset.s];
      const n = num(inp.value);
      s[inp.dataset.k] = inp.dataset.k === 'r' && n != null ? Math.round(n) : n;
      saveDraft();
    });
    inp.addEventListener('focus', () => inp.select());
  });

  $('#wDate').onchange = (e) => { if (e.target.value) { draft.date = e.target.value; saveDraft(); } };

  v.querySelectorAll('[data-addset]').forEach((b) => b.onclick = () => {
    const sets = draft.entries[b.dataset.addset].sets;
    const prev = sets[sets.length - 1];
    sets.push(prev ? { w: prev.w, r: prev.r } : { w: null, r: null });
    saveDraft(); render();
    const inputs = v.querySelectorAll(`input[data-e="${b.dataset.addset}"][data-k="w"]`);
    inputs[inputs.length - 1]?.focus();
  });
  v.querySelectorAll('[data-delset]').forEach((b) => b.onclick = () => {
    const [ei, si] = b.dataset.delset.split(':').map(Number);
    draft.entries[ei].sets.splice(si, 1);
    saveDraft(); render();
  });
  v.querySelectorAll('[data-delex]').forEach((b) => b.onclick = () => {
    const e = draft.entries[b.dataset.delex];
    if (!confirm(`„${e.name}“ aus diesem Training entfernen?`)) return;
    draft.entries.splice(Number(b.dataset.delex), 1);
    saveDraft(); render();
  });

  $('#wAddEx').onclick = () => addExerciseSheet((name) => {
    const plan = planById(draft.planId);
    let ex = plan && plan.exercises.find((x) => norm(x.name) === norm(name));
    if (!ex) {
      ex = { id: uid(), name };
      if (plan) plan.exercises.push(ex);
      save();
    }
    draft.entries.push(newEntry(ex, draft.date));
    saveDraft(); render();
  });

  $('#wSave').onclick = finishWorkout;
  $('#wSaveTop').onclick = finishWorkout;
  if ($('#wDiscard')) $('#wDiscard').onclick = () => {
    if (!confirm('Training verwerfen? Die Eingaben gehen verloren.')) return;
    draft = null; saveDraft(); back();
  };
  if ($('#wDelete')) $('#wDelete').onclick = () => {
    if (!confirm('Dieses Training endgültig löschen?')) return;
    data.workouts = data.workouts.filter((w) => w.id !== draft.id);
    save(); draft = null; saveDraft(); back();
  };
}

function finishWorkout() {
  const entries = draft.entries
    .map((e) => ({ exerciseId: e.exerciseId, name: e.name, sets: e.sets.filter((s) => s.r != null && s.r > 0).map((s) => ({ w: s.w ?? 0, r: s.r })) }))
    .filter((e) => e.sets.length);
  if (!entries.length) { alert('Trage mindestens einen Satz mit Wiederholungen ein.'); return; }
  const workout = { id: draft.id, planId: draft.planId, date: draft.date, created: draft.created || Date.now(), entries };
  const i = data.workouts.findIndex((w) => w.id === workout.id);
  if (i >= 0) data.workouts[i] = workout; else data.workouts.push(workout);
  save();
  draft = null; saveDraft();
  toast('Training gespeichert 💪');
  back();
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
  const offset = (first.getDay() + 6) % 7; // Montag zuerst
  const today = todayStr();

  const byDate = {};
  data.workouts.forEach((w) => (byDate[w.date] = byDate[w.date] || []).push(w));

  let cells = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => `<div class="wd">${d}</div>`).join('');
  for (let i = 0; i < offset; i++) cells += '<div class="cal-day blank"></div>';
  let monthCount = 0;
  for (let d = 1; d <= days; d++) {
    const ds = `${y}-${pad(m + 1)}-${pad(d)}`;
    const ws = byDate[ds] || [];
    if (ws.length) monthCount += ws.length;
    const colors = [...new Set(ws.map((w) => planColor(w.planId)))];
    const style = colors.length ? `style="background:${stripeBackground(colors)}"` : '';
    cells += `<button class="cal-day ${ws.length ? 'trained' : ''} ${ds === today ? 'today' : ''}" data-day="${ds}" ${style}>${d}</button>`;
  }

  const yearCount = data.workouts.filter((w) => w.date.startsWith(String(y))).length;
  const usedPlans = data.plans.length ? data.plans : [];

  $('#view').innerHTML = `
    <div class="cal-head">
      <button id="prevM" aria-label="Vorheriger Monat">‹</button>
      <h2>${MONTHS[m]} ${y}</h2>
      <button id="nextM" aria-label="Nächster Monat">›</button>
    </div>
    <div class="cal-grid">${cells}</div>
    <div class="legend">${usedPlans.map((p) => `<span><i class="dot" style="background:${p.color}"></i>${esc(p.name)}</span>`).join('')}</div>
    <div class="stats">
      <div class="stat"><div class="v">${monthCount}</div><div class="k">Trainings im ${MONTHS[m]}</div></div>
      <div class="stat"><div class="v">${yearCount}</div><div class="k">Trainings ${y}</div></div>
    </div>
    <p class="muted small" style="text-align:center;margin-top:16px">Tippe auf einen Tag, um Trainings anzusehen oder nachzutragen.</p>`;

  $('#prevM').onclick = () => { calState.m--; if (calState.m < 0) { calState.m = 11; calState.y--; } render(); };
  $('#nextM').onclick = () => { calState.m++; if (calState.m > 11) { calState.m = 0; calState.y++; } render(); };
  document.querySelectorAll('[data-day]').forEach((b) => b.onclick = () => daySheet(b.dataset.day));
}

function daySheet(ds) {
  const ws = data.workouts.filter((w) => w.date === ds);
  openSheet(`
    <h2>${fmtDateLong(ds)}</h2>
    ${ws.length ? ws.map((w) => `
      <button class="list-item" data-w="${w.id}" style="background:#222227">
        <div class="plan-bar" style="background:${planColor(w.planId)}"></div>
        <div class="grow"><div class="title">${esc(planName(w.planId))}</div>
        <div class="muted small">${w.entries.map((e) => esc(e.name)).join(', ')}</div></div><div class="chev">›</div>
      </button>`).join('') : '<p class="muted">An diesem Tag wurde nicht trainiert.</p>'}
    ${data.plans.length ? `<div class="section-title">Training eintragen</div>
      ${data.plans.map((p) => `<button class="list-item" data-new="${p.id}" style="background:#222227"><i class="dot" style="background:${p.color}"></i><div class="grow">${esc(p.name)}</div><div class="chev">＋</div></button>`).join('')}` : ''}
    <button class="btn" id="dayClose">Schließen</button>
  `, (root) => {
    $('#dayClose').onclick = closeSheet;
    root.querySelectorAll('[data-w]').forEach((b) => b.onclick = () => { closeSheet(); editWorkout(data.workouts.find((w) => w.id === b.dataset.w)); });
    root.querySelectorAll('[data-new]').forEach((b) => b.onclick = () => { closeSheet(); startWorkout(b.dataset.new, ds); });
  });
}

/* =========================================================
   DIAGRAMM (eigenes SVG, funktioniert offline)
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

/** points: [{date:'YYYY-MM-DD', y:Number, label:String}] */
function lineChart(el, points, color, unit) {
  const W = 340, H = 210, L = 40, R = 12, T = 12, B = 26;
  if (!points.length) { el.innerHTML = '<div class="empty">Noch keine Daten.</div>'; return; }
  const xs = points.map((p) => parseDate(p.date).getTime());
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 86400000 * 3; x1 += 86400000 * 3; }
  const ys = points.map((p) => p.y);
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const px = (t) => L + ((t - x0) / (x1 - x0)) * (W - L - R);
  const py = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);

  const coords = points.map((p, i) => [px(xs[i]), py(p.y)]);
  const path = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const area = `${path}L${coords[coords.length - 1][0].toFixed(1)},${H - B}L${coords[0][0].toFixed(1)},${H - B}Z`;
  const gid = 'g' + Math.random().toString(36).slice(2, 7);

  const xLabelIdx = points.length === 1 ? [0] : [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];

  el.innerHTML = `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      ${ticks.map((t) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${py(t)}" y2="${py(t)}"/>
        <text x="${L - 6}" y="${py(t) + 4}" text-anchor="end">${fmtNum(t)}</text>`).join('')}
      ${xLabelIdx.map((i) => `<text x="${coords[i][0]}" y="${H - 8}" text-anchor="${i === 0 && points.length > 1 ? 'start' : i === points.length - 1 && points.length > 1 ? 'end' : 'middle'}">${fmtDate(points[i].date, false)}</text>`).join('')}
      <path d="${area}" fill="url(#${gid})"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${coords.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${points.length > 40 ? 2 : 3.5}" fill="${color}"/>`).join('')}
      <circle class="hl" r="6" fill="none" stroke="#fff" stroke-width="2" visibility="hidden"/>
    </svg>
    <div class="chart-tip muted">Tippe ins Diagramm für Details</div>`;

  const svg = el.querySelector('svg');
  const tip = el.querySelector('.chart-tip');
  const hl = el.querySelector('.hl');
  const pick = (clientX) => {
    const r = svg.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * W;
    let best = 0;
    coords.forEach(([cx], i) => { if (Math.abs(cx - x) < Math.abs(coords[best][0] - x)) best = i; });
    hl.setAttribute('cx', coords[best][0]); hl.setAttribute('cy', coords[best][1]); hl.setAttribute('visibility', 'visible');
    const p = points[best];
    tip.classList.remove('muted');
    tip.innerHTML = `<b>${fmtNum(p.y)} ${unit}</b> · ${fmtDateLong(p.date)}${p.label ? `<br><span class="muted small">${esc(p.label)}</span>` : ''}`;
  };
  svg.addEventListener('click', (e) => pick(e.clientX));
  svg.addEventListener('touchmove', (e) => { pick(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
}

function statCard(label, value, cls = '') {
  return `<div class="stat"><div class="v ${cls}">${value}</div><div class="k">${label}</div></div>`;
}
function diffCard(label, diff, unit, invert = false) {
  if (diff == null) return statCard(label, '–');
  const good = invert ? diff < 0 : diff > 0;
  const cls = diff === 0 ? '' : good ? 'up' : 'down';
  return statCard(label, `${diff > 0 ? '+' : ''}${fmtNum(diff)} ${unit}`, cls);
}

/* =========================================================
   FORTSCHRITT
   ========================================================= */

const progressState = { name: null, metric: 'max' };
const METRICS = {
  max: { label: 'Max. Gewicht', unit: 'kg', calc: (sets) => Math.max(...sets.map((s) => s.w)) },
  orm: { label: 'Geschätztes 1RM', unit: 'kg', calc: (sets) => Math.max(...sets.map((s) => s.r === 1 ? s.w : s.w * (1 + s.r / 30))) },
  vol: { label: 'Volumen', unit: 'kg', calc: (sets) => sets.reduce((a, s) => a + s.w * s.r, 0) },
};

function viewProgress() {
  setHeader('Fortschritt');
  const v = $('#view');

  // Alle Übungen, zu denen es Trainingsdaten gibt (nach Name zusammengefasst).
  const names = new Map();
  data.workouts.forEach((w) => w.entries.forEach((e) => { if (!names.has(norm(e.name))) names.set(norm(e.name), e.name); }));
  if (!names.size) {
    v.innerHTML = `<div class="empty"><div class="big">📈</div><p>Sobald du ein Training gespeichert hast, siehst du hier deine Steigerung pro Übung.</p></div>`;
    return;
  }
  const list = [...names.values()].sort((a, b) => a.localeCompare(b, 'de'));
  if (!progressState.name || !names.has(norm(progressState.name))) {
    progressState.name = lastEntryFor(sortedWorkouts()[0].entries[0].name).entry.name;
  }
  const key = norm(progressState.name);
  const metric = METRICS[progressState.metric];

  // Ein Punkt pro Trainingstag
  const perDay = {};
  const planOf = {};
  data.workouts.forEach((w) => w.entries.forEach((e) => {
    if (norm(e.name) !== key) return;
    (perDay[w.date] = perDay[w.date] || []).push(...e.sets);
    planOf[w.date] = w.planId;
  }));
  const dates = Object.keys(perDay).sort();
  const points = dates.map((d) => ({ date: d, y: +metric.calc(perDay[d]).toFixed(1), label: setsSummary(perDay[d]) }));
  const color = planColor(planOf[dates[dates.length - 1]]);

  const ys = points.map((p) => p.y);
  const first = ys[0], lastV = ys[ys.length - 1];

  v.innerHTML = `
    <select class="field" id="exSel">${list.map((n) => `<option ${norm(n) === key ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
    <div style="height:12px"></div>
    <div class="seg">${Object.entries(METRICS).map(([k, mm]) => `<button data-metric="${k}" class="${k === progressState.metric ? 'on' : ''}">${mm.label}</button>`).join('')}</div>
    <div class="card" id="chart"></div>
    <div class="stats">
      ${statCard('Start', `${fmtNum(first)} kg`)}
      ${statCard('Aktuell', `${fmtNum(lastV)} kg`)}
      ${statCard('Bestwert', `${fmtNum(Math.max(...ys))} kg`)}
      ${diffCard('Steigerung', points.length > 1 ? +(lastV - first).toFixed(1) : null, 'kg')}
    </div>
    <div class="section-title">Verlauf</div>
    ${[...points].reverse().map((p) => `<div class="card"><div class="row"><b class="grow">${fmtDateLong(p.date)}</b><span>${fmtNum(p.y)} kg</span></div><div class="muted small">${esc(p.label)}</div></div>`).join('')}`;

  lineChart($('#chart'), points, color, 'kg');
  $('#exSel').onchange = (e) => { progressState.name = e.target.value; render(); };
  v.querySelectorAll('[data-metric]').forEach((b) => b.onclick = () => { progressState.metric = b.dataset.metric; render(); });
}

/* =========================================================
   KÖRPERGEWICHT
   ========================================================= */

const weightState = { range: 90 };
const RANGES = [[30, '1M'], [90, '3M'], [180, '6M'], [365, '1J'], [0, 'Alle']];

function viewWeight() {
  setHeader('Körpergewicht');
  const v = $('#view');
  const all = [...data.weights].sort((a, b) => a.date.localeCompare(b.date));
  const lastW = all[all.length - 1];

  let shown = all;
  if (weightState.range) {
    const from = new Date(); from.setDate(from.getDate() - weightState.range);
    shown = all.filter((w) => w.date >= dateStr(from));
  }
  const ys = shown.map((w) => w.kg);

  v.innerHTML = `
    <div class="card">
      <div class="row">
        <input class="field grow" id="wKg" inputmode="decimal" placeholder="${lastW ? fmtNum(lastW.kg) : 'z. B. 80,5'}" enterkeyhint="done">
        <input type="date" class="field" id="wDay" value="${todayStr()}" style="width:auto">
      </div>
      <div style="height:10px"></div>
      <button class="btn primary" id="wAdd">Gewicht eintragen</button>
    </div>
    ${all.length ? `
      <div class="seg">${RANGES.map(([d, l]) => `<button data-range="${d}" class="${d === weightState.range ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="card" id="wChart"></div>
      <div class="stats">
        ${statCard('Aktuell', `${fmtNum(lastW.kg)} kg`)}
        ${diffCard('Veränderung', shown.length > 1 ? +(ys[ys.length - 1] - ys[0]).toFixed(1) : null, 'kg')}
        ${statCard('Minimum', ys.length ? `${fmtNum(Math.min(...ys))} kg` : '–')}
        ${statCard('Maximum', ys.length ? `${fmtNum(Math.max(...ys))} kg` : '–')}
      </div>
      <div class="section-title">Einträge</div>
      ${[...all].reverse().map((w) => `<button class="list-item" data-wid="${w.id}"><div class="grow">${fmtDateLong(w.date)}</div><b>${fmtNum(w.kg)} kg</b><span class="x-btn">✕</span></button>`).join('')}
    ` : `<div class="empty"><div class="big">⚖️</div><p>Trage dein Gewicht regelmäßig ein, um den Verlauf zu sehen.</p></div>`}`;

  if (all.length) lineChart($('#wChart'), shown.map((w) => ({ date: w.date, y: w.kg })), '#1E88E5', 'kg');

  const add = () => {
    const kg = num($('#wKg').value);
    const date = $('#wDay').value || todayStr();
    if (kg == null || kg <= 0 || kg > 500) { $('#wKg').focus(); return; }
    const existing = data.weights.find((w) => w.date === date);
    if (existing) existing.kg = kg; else data.weights.push({ id: uid(), date, kg });
    save(); toast('Gewicht gespeichert'); render();
  };
  $('#wAdd').onclick = add;
  $('#wKg').addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  v.querySelectorAll('[data-range]').forEach((b) => b.onclick = () => { weightState.range = Number(b.dataset.range); render(); });
  v.querySelectorAll('[data-wid]').forEach((b) => b.onclick = () => {
    const w = data.weights.find((x) => x.id === b.dataset.wid);
    if (!confirm(`Eintrag vom ${fmtDate(w.date)} (${fmtNum(w.kg)} kg) löschen?`)) return;
    data.weights = data.weights.filter((x) => x.id !== w.id);
    save(); render();
  });
}

/* =========================================================
   SICHERUNG
   ========================================================= */

async function exportData() {
  const json = JSON.stringify({ app: 'Fightclub', version: 1, exported: new Date().toISOString(), ...data }, null, 2);
  const name = `fightclub-sicherung-${todayStr()}.json`;
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Fightclub-Sicherung' }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importData(e) {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const d = JSON.parse(reader.result);
      if (!Array.isArray(d.plans)) throw new Error('Keine Fightclub-Sicherung');
      if (!confirm('Alle aktuellen Daten durch die Sicherung ersetzen?')) return;
      data = { plans: d.plans, workouts: d.workouts || [], weights: d.weights || [] };
      save(); toast('Sicherung importiert'); render();
    } catch (err) { alert('Import fehlgeschlagen: ' + err.message); }
  };
  reader.readAsText(f);
  e.target.value = '';
}

/* ---------------- Start ---------------- */

render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
