'use strict';

/* =====================================================================
 * Fightclub – Web-App (PWA)
 *
 * Alle Daten liegen lokal im Browser (localStorage). Über „Einstellungen“
 * lässt sich ein Backup als JSON-Datei exportieren und wieder einlesen.
 * ===================================================================== */

const STORAGE_KEY = 'fightclub.data.v1';
const DRAFT_KEY = 'fightclub.draft.v1';

const PALETTE = [
  ['Rot', '#E53935'], ['Blau', '#1E88E5'], ['Grün', '#43A047'], ['Orange', '#FB8C00'],
  ['Lila', '#8E24AA'], ['Türkis', '#00ACC1'], ['Pink', '#D81B60'], ['Gelb', '#FDD835'],
  ['Braun', '#6D4C41'], ['Grau', '#546E7A'],
];

const SAMPLE_PLANS = [
  ['Push', '#E53935', ['Bankdrücken', 'Schrägbankdrücken', 'Butterfly', 'Schulterdrücken', 'Seitheben', 'Trizepsdrücken']],
  ['Pull', '#43A047', ['Klimmzüge', 'Rudern am Kabel', 'Latziehen', 'Face Pulls', 'Bizepscurls']],
  ['Beine', '#1E88E5', ['Kniebeugen', 'Beinpresse', 'Rumänisches Kreuzheben', 'Beinstrecker', 'Beinbeuger', 'Wadenheben']],
];

/* ---------------------------------------------------------------------
 * Hilfsfunktionen
 * ------------------------------------------------------------------- */

const $ = (sel, root = document) => root.querySelector(sel);

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function pad(n) { return String(n).padStart(2, '0'); }

function toISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function todayISO() { return toISO(new Date()); }

function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const fmtDateLong = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtDateShort = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' });
const fmtMonth = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
const fmtAxisMonth = new Intl.DateTimeFormat('de-DE', { month: 'short' });

function formatDate(iso) { return fmtDateLong.format(parseISO(iso)); }
function formatDateShort(iso) { return fmtDateShort.format(parseISO(iso)); }

function formatNumber(value, maxDigits = 1) {
  if (value == null || Number.isNaN(value)) return '–';
  return value.toLocaleString('de-DE', { maximumFractionDigits: maxDigits });
}

/** Liest eine Zahl – Komma und Punkt sind beide als Dezimaltrenner erlaubt. */
function parseNumber(text) {
  if (text == null) return null;
  const cleaned = String(text).trim().replace(',', '.');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function plural(n, one, many) { return `${n} ${n === 1 ? one : many}`; }

function normalizeName(name) { return name.trim().toLocaleLowerCase('de-DE'); }

/** Schwarz oder Weiß – je nachdem, was auf der Farbe besser lesbar ist. */
function readableTextOn(hex) {
  const v = parseInt(hex.replace('#', ''), 16);
  const r = ((v >> 16) & 255) / 255, g = ((v >> 8) & 255) / 255, b = (v & 255) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.7 ? '#000000' : '#ffffff';
}

let toastTimer;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

/* ---------------------------------------------------------------------
 * Datenhaltung
 * ------------------------------------------------------------------- */

function emptyData() {
  return { version: 1, plans: [], workouts: [], bodyWeights: [] };
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    return sanitizeData(JSON.parse(raw));
  } catch (err) {
    console.error(err);
    return emptyData();
  }
}

function sanitizeData(input) {
  const data = emptyData();
  if (!input || typeof input !== 'object') return data;
  data.plans = Array.isArray(input.plans) ? input.plans.filter(p => p && p.id && typeof p.name === 'string') : [];
  data.plans.forEach(p => {
    p.color = p.color || PALETTE[0][1];
    p.exercises = Array.isArray(p.exercises) ? p.exercises.filter(e => e && e.id && typeof e.name === 'string') : [];
  });
  data.workouts = Array.isArray(input.workouts) ? input.workouts.filter(w => w && w.id && w.date) : [];
  data.workouts.forEach(w => {
    w.exercises = Array.isArray(w.exercises) ? w.exercises : [];
    w.exercises.forEach(e => { e.sets = Array.isArray(e.sets) ? e.sets : []; });
  });
  data.bodyWeights = Array.isArray(input.bodyWeights)
    ? input.bodyWeights.filter(b => b && b.id && b.date && Number.isFinite(b.kg)) : [];
  return data;
}

let data = loadData();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error(err);
    toast('Speichern fehlgeschlagen – Speicher voll?');
  }
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveDraft() {
  try {
    if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* nicht kritisch */ }
}

let draft = loadDraft();

const planById = id => data.plans.find(p => p.id === id);
const workoutById = id => data.workouts.find(w => w.id === id);

function workoutColor(w) { return planById(w.planId)?.color ?? w.planColor ?? PALETTE[9][1]; }
function workoutName(w) { return planById(w.planId)?.name ?? w.planName ?? 'Training'; }

function sortedWorkouts() {
  return [...data.workouts].sort((a, b) => (b.date.localeCompare(a.date)) || ((b.createdAt ?? 0) - (a.createdAt ?? 0)));
}

/** Ausgeführte Sätze (mit mindestens einer Wiederholung). */
function doneSets(entry) {
  return entry.sets.filter(s => (s.reps ?? 0) > 0);
}

/**
 * Das letzte Training (vor `beforeDate`, ohne `excludeId`), in dem die Übung
 * vorkam – plus der passende Eintrag.
 */
function lastEntryFor(exerciseName, { beforeDate = null, excludeId = null } = {}) {
  const key = normalizeName(exerciseName);
  for (const w of sortedWorkouts()) {
    if (w.id === excludeId) continue;
    if (beforeDate && w.date > beforeDate) continue;
    const entry = w.exercises.find(e => normalizeName(e.name) === key && doneSets(e).length > 0);
    if (entry) return { workout: w, entry };
  }
  return null;
}

function describeSets(sets) {
  return sets.map(s => `${formatNumber(s.kg ?? 0, 2)} kg × ${s.reps}`).join(' · ');
}

/** Fortschritt einer Übung: ein Punkt pro Training. */
function exerciseHistory(exerciseName) {
  const key = normalizeName(exerciseName);
  const points = [];
  for (const w of data.workouts) {
    for (const e of w.exercises) {
      if (normalizeName(e.name) !== key) continue;
      const sets = doneSets(e);
      if (!sets.length) continue;
      const maxKg = Math.max(...sets.map(s => s.kg ?? 0));
      const oneRM = Math.max(...sets.map(s => (s.kg ?? 0) * (1 + s.reps / 30)));
      const volume = sets.reduce((sum, s) => sum + (s.kg ?? 0) * s.reps, 0);
      const bestSet = sets.reduce((best, s) => ((s.kg ?? 0) > (best.kg ?? 0) || ((s.kg ?? 0) === (best.kg ?? 0) && s.reps > best.reps)) ? s : best, sets[0]);
      points.push({ date: w.date, workoutId: w.id, maxKg, oneRM, volume, bestSet, sets });
    }
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

/** Alle Übungsnamen aus Plänen und Trainings (ohne Duplikate). */
function allExerciseNames() {
  const map = new Map();
  data.plans.forEach(p => p.exercises.forEach(e => {
    const key = normalizeName(e.name);
    if (!map.has(key)) map.set(key, { name: e.name, color: p.color, plan: p.name });
  }));
  data.workouts.forEach(w => w.exercises.forEach(e => {
    const key = normalizeName(e.name);
    if (!map.has(key)) map.set(key, { name: e.name, color: workoutColor(w), plan: workoutName(w) });
  }));
  return [...map.values()];
}

/* ---------------------------------------------------------------------
 * Navigation
 * ------------------------------------------------------------------- */

const ui = {
  tab: 'plans',
  stack: [],              // Unteransichten des aktuellen Tabs
  calendarMonth: null,    // Date (1. des Monats)
  calendarSelected: todayISO(),
  progressMetric: 'maxKg',
  weightRange: '3M',
};

function currentView() {
  return ui.stack[ui.stack.length - 1] ?? { view: ui.tab };
}

function push(view) {
  ui.stack.push(view);
  render();
  window.scrollTo(0, 0);
}

function back() {
  const view = currentView();
  if (view.view === 'workout' && draft) {
    // Das Training bleibt als Entwurf erhalten und kann fortgesetzt werden.
    toast('Training als Entwurf gespeichert');
  }
  ui.stack.pop();
  render();
}

function switchTab(tab) {
  ui.tab = tab;
  ui.stack = [];
  render();
  window.scrollTo(0, 0);
}

/* ---------------------------------------------------------------------
 * Rendering
 * ------------------------------------------------------------------- */

const views = {};

function render() {
  const view = currentView();
  const renderer = views[view.view];
  const result = renderer(view);

  $('#title').textContent = result.title;
  $('#back-btn').hidden = ui.stack.length === 0;
  $('#topbar-actions').innerHTML = result.actions ?? '';
  $('#app').innerHTML = result.html;
  document.querySelectorAll('#tabbar button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === ui.tab);
  });
  result.after?.();
}

function planCardHTML(plan) {
  const lastWorkout = sortedWorkouts().find(w => w.planId === plan.id);
  const count = plan.exercises.length;
  const meta = [
    `${count} ${count === 1 ? 'Übung' : 'Übungen'}`,
    lastWorkout ? `zuletzt ${formatDateShort(lastWorkout.date)}` : 'noch nicht trainiert',
  ].join(' · ');
  return `
    <button class="plan-card" data-action="open-plan" data-id="${plan.id}">
      <span class="stripe" style="background:${plan.color}"></span>
      <span class="body">
        <div class="name">${esc(plan.name)}</div>
        <div class="meta">${meta}</div>
      </span>
      <span class="chev">›</span>
    </button>`;
}

/* ----- Tab: Pläne ----- */
views.plans = () => {
  let html = '';
  if (draft) {
    const plan = planById(draft.planId);
    html += `
      <div class="card" style="border-left:6px solid ${plan?.color ?? 'var(--accent)'}">
        <div style="font-weight:700">Laufendes Training: ${esc(plan?.name ?? draft.planName)}</div>
        <div class="hint">${formatDate(draft.date)}</div>
        <div class="btn-row">
          <button class="btn primary" data-action="resume-draft">Fortsetzen</button>
          <button class="btn danger" data-action="discard-draft">Verwerfen</button>
        </div>
      </div>`;
  }

  if (!data.plans.length) {
    html += `
      <div class="empty">
        <div class="big">🥊</div>
        <p>Noch keine Trainingspläne.<br>Lege z. B. „Push“, „Pull“ oder „Beine“ an.</p>
      </div>
      <button class="btn primary block" data-action="new-plan">+ Trainingsplan erstellen</button>
      <div style="height:10px"></div>
      <button class="btn block" data-action="sample-plans">Beispielpläne anlegen (Push, Pull, Beine)</button>`;
  } else {
    html += `<div class="section-title">Trainingspläne</div>`;
    html += data.plans.map(planCardHTML).join('');
    html += `<button class="btn primary block" data-action="new-plan">+ Trainingsplan erstellen</button>`;

    const recent = sortedWorkouts().slice(0, 5);
    if (recent.length) {
      html += `<div class="section-title">Letzte Trainings</div><div class="list">`;
      html += recent.map(workoutRowHTML).join('');
      html += `</div>`;
    }
  }

  return {
    title: 'Fightclub',
    actions: `<button data-action="open-settings" aria-label="Einstellungen">⚙︎</button>`,
    html,
  };
};

function workoutRowHTML(w) {
  const exercises = w.exercises.filter(e => doneSets(e).length);
  const setCount = exercises.reduce((n, e) => n + doneSets(e).length, 0);
  return `
    <button class="list-row clickable" data-action="edit-workout" data-id="${w.id}">
      <span class="dot" style="background:${workoutColor(w)}"></span>
      <span class="grow">
        <div>${esc(workoutName(w))}</div>
        <div class="sub">${formatDate(w.date)} · ${plural(exercises.length, 'Übung', 'Übungen')} · ${plural(setCount, 'Satz', 'Sätze')}</div>
      </span>
      <span class="chev">›</span>
    </button>`;
}

/* ----- Plan-Detail ----- */
views.plan = ({ planId }) => {
  const plan = planById(planId);
  if (!plan) { ui.stack.pop(); return views[currentView().view](currentView()); }

  const exercisesHTML = plan.exercises.length
    ? `<div class="list">${plan.exercises.map((e, i) => {
        const last = lastEntryFor(e.name);
        return `
          <div class="list-row">
            <span class="grow">
              <div>${esc(e.name)}</div>
              <div class="sub">${last ? `Letztes Mal: ${describeSets(doneSets(last.entry))}` : 'Noch keine Werte'}</div>
            </span>
            <button class="icon-btn" data-action="move-exercise" data-plan="${plan.id}" data-index="${i}" data-dir="-1" ${i === 0 ? 'disabled style="opacity:.25"' : ''} aria-label="Nach oben">↑</button>
            <button class="icon-btn" data-action="move-exercise" data-plan="${plan.id}" data-index="${i}" data-dir="1" ${i === plan.exercises.length - 1 ? 'disabled style="opacity:.25"' : ''} aria-label="Nach unten">↓</button>
            <button class="icon-btn" data-action="edit-exercise" data-plan="${plan.id}" data-id="${e.id}" aria-label="Bearbeiten">✎</button>
          </div>`;
      }).join('')}</div>`
    : `<p class="hint center">Noch keine Übungen – füge unten die erste hinzu.</p>`;

  const planWorkouts = sortedWorkouts().filter(w => w.planId === plan.id).slice(0, 10);

  return {
    title: plan.name,
    actions: `<button data-action="edit-plan" data-id="${plan.id}">Bearbeiten</button>`,
    html: `
      <button class="btn block" style="background:${plan.color};color:${readableTextOn(plan.color)};padding:16px;font-size:17px"
        data-action="start-workout" data-id="${plan.id}" ${plan.exercises.length ? '' : 'disabled'}>
        ▶︎ Training starten
      </button>

      <div class="section-title">Übungen</div>
      ${exercisesHTML}
      <form class="inline-add" data-form="add-exercise" data-plan="${plan.id}">
        <input type="text" name="name" placeholder="Neue Übung, z. B. Bankdrücken" autocomplete="off" enterkeyhint="done">
        <button class="btn primary" type="submit">+ Übung</button>
      </form>

      ${planWorkouts.length ? `
        <div class="section-title">Trainings mit diesem Plan</div>
        <div class="list">${planWorkouts.map(workoutRowHTML).join('')}</div>` : ''}
    `,
  };
};

/* ----- Training erfassen ----- */

function buildDraft(plan, date, existing = null) {
  if (existing) {
    return {
      workoutId: existing.id,
      planId: existing.planId,
      planName: workoutName(existing),
      planColor: workoutColor(existing),
      date: existing.date,
      exercises: existing.exercises.map(e => ({
        id: uid(),
        name: e.name,
        sets: e.sets.map(s => ({ kg: s.kg ?? null, reps: s.reps ?? null })),
      })),
    };
  }
  return {
    workoutId: null,
    planId: plan.id,
    planName: plan.name,
    planColor: plan.color,
    date,
    exercises: plan.exercises.map(e => draftExercise(e.name, date)),
  };
}

/** Neue Übung im Training – vorbelegt mit den Werten vom letzten Mal. */
function draftExercise(name, date, excludeId = null) {
  const last = lastEntryFor(name, { beforeDate: date, excludeId });
  const sets = last
    ? doneSets(last.entry).map(s => ({ kg: s.kg ?? null, reps: s.reps }))
    : [{ kg: null, reps: null }];
  return { id: uid(), name, sets };
}

views.workout = () => {
  if (!draft) { ui.stack.pop(); return views[currentView().view](currentView()); }
  const color = planById(draft.planId)?.color ?? draft.planColor;
  const title = planById(draft.planId)?.name ?? draft.planName;

  const blocks = draft.exercises.map((ex, exIndex) => {
    const last = lastEntryFor(ex.name, { beforeDate: draft.date, excludeId: draft.workoutId });
    const lastHTML = last
      ? `Letztes Mal (${formatDateShort(last.workout.date)}): <b>${describeSets(doneSets(last.entry))}</b>`
      : 'Noch keine Werte vom letzten Training';
    const rows = ex.sets.map((s, setIndex) => `
      <tr>
        <td class="set-no">${setIndex + 1}</td>
        <td><input type="text" inputmode="decimal" placeholder="kg" value="${s.kg ?? ''}"
          data-bind="kg" data-ex="${exIndex}" data-set="${setIndex}" aria-label="Gewicht in kg"></td>
        <td><input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="Wdh." value="${s.reps ?? ''}"
          data-bind="reps" data-ex="${exIndex}" data-set="${setIndex}" aria-label="Wiederholungen"></td>
        <td class="del"><button class="icon-btn danger" data-action="remove-set" data-ex="${exIndex}" data-set="${setIndex}" aria-label="Satz löschen">✕</button></td>
      </tr>`).join('');
    return `
      <div class="exercise-block" style="border-top:4px solid ${color}">
        <div class="exercise-head">
          <h3>${esc(ex.name)}</h3>
          <button class="icon-btn" data-action="remove-draft-exercise" data-ex="${exIndex}" aria-label="Übung entfernen">🗑</button>
        </div>
        <div class="last-time">${lastHTML}</div>
        <table class="set-table">
          <thead><tr><th>Satz</th><th>Gewicht (kg)</th><th>Wdh.</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <button class="btn ghost small" data-action="add-set" data-ex="${exIndex}">+ Satz hinzufügen</button>
      </div>`;
  }).join('');

  return {
    title,
    actions: `<button data-action="finish-workout" style="font-weight:700">Speichern</button>`,
    html: `
      <div class="date-row">
        <span class="hint">Datum</span>
        <input type="date" value="${draft.date}" max="${todayISO()}" data-bind="date">
      </div>
      ${blocks || '<p class="hint center">Keine Übungen im Training.</p>'}
      <form class="inline-add" data-form="add-draft-exercise" style="margin-bottom:16px">
        <input type="text" name="name" placeholder="Weitere Übung hinzufügen" autocomplete="off" list="exercise-names" enterkeyhint="done">
        <button class="btn" type="submit">+ Übung</button>
      </form>
      <datalist id="exercise-names">${allExerciseNames().map(e => `<option value="${esc(e.name)}">`).join('')}</datalist>
      <button class="btn primary block" data-action="finish-workout">Training speichern</button>
      <div class="btn-row">
        ${draft.workoutId ? `<button class="btn danger" data-action="delete-workout" data-id="${draft.workoutId}">Training löschen</button>` : ''}
        <button class="btn danger" data-action="discard-draft">${draft.workoutId ? 'Änderungen verwerfen' : 'Training verwerfen'}</button>
      </div>
      <p class="hint center" style="margin-top:14px">Sätze ohne Wiederholungen werden nicht gespeichert.</p>
    `,
  };
};

/* ----- Tab: Kalender ----- */
views.calendar = () => {
  if (!ui.calendarMonth) {
    const now = new Date();
    ui.calendarMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const month = ui.calendarMonth;
  const year = month.getFullYear(), m = month.getMonth();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const offset = (month.getDay() + 6) % 7; // Montag = 0
  const today = todayISO();

  const byDate = new Map();
  data.workouts.forEach(w => {
    if (!byDate.has(w.date)) byDate.set(w.date, []);
    byDate.get(w.date).push(w);
  });

  let cells = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => `<div class="cal-dow">${d}</div>`).join('');
  for (let i = 0; i < offset; i++) cells += `<div class="cal-day outside"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${year}-${pad(m + 1)}-${pad(day)}`;
    const workouts = byDate.get(iso) ?? [];
    const colors = [...new Set(workouts.map(workoutColor))];
    let style = '';
    if (colors.length === 1) {
      style = `background:${colors[0]};color:${readableTextOn(colors[0])}`;
    } else if (colors.length > 1) {
      const step = 100 / colors.length;
      const stops = colors.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(',');
      style = `background:linear-gradient(135deg,${stops});color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.6)`;
    }
    const classes = ['cal-day'];
    if (iso === today) classes.push('today');
    if (iso === ui.calendarSelected) classes.push('selected');
    if (iso > today) classes.push('future');
    cells += `<button class="${classes.join(' ')}" style="${style}" data-action="select-day" data-date="${iso}">${day}</button>`;
  }

  const monthCount = data.workouts.filter(w => w.date.startsWith(`${year}-${pad(m + 1)}`)).length;

  const legendPlans = data.plans.map(p => `<span><i class="dot" style="background:${p.color}"></i>${esc(p.name)}</span>`).join('');

  const selected = ui.calendarSelected;
  const selectedWorkouts = (byDate.get(selected) ?? []);
  const dayHTML = `
    <div class="section-title">${formatDate(selected)}</div>
    ${selectedWorkouts.length
      ? `<div class="list">${selectedWorkouts.map(workoutRowHTML).join('')}</div>`
      : `<p class="hint">An diesem Tag wurde nicht trainiert.</p>`}
    ${selected <= today && data.plans.length
      ? `<button class="btn block" data-action="log-for-day" data-date="${selected}">+ Training für diesen Tag eintragen</button>` : ''}
  `;

  return {
    title: 'Kalender',
    html: `
      <div class="card">
        <div class="cal-head">
          <button class="btn small" data-action="cal-prev" aria-label="Vorheriger Monat">‹</button>
          <h2>${fmtMonth.format(month)}</h2>
          <button class="btn small" data-action="cal-next" aria-label="Nächster Monat">›</button>
        </div>
        <div class="cal-grid">${cells}</div>
        <div class="legend">${legendPlans}</div>
      </div>
      <p class="hint center">${monthCount} ${monthCount === 1 ? 'Training' : 'Trainings'} in diesem Monat</p>
      ${dayHTML}
    `,
  };
};

/* ----- Tab: Fortschritt ----- */
views.progress = () => {
  const names = allExerciseNames()
    .map(e => ({ ...e, history: exerciseHistory(e.name) }))
    .filter(e => e.history.length);

  if (!names.length) {
    return {
      title: 'Fortschritt',
      html: `<div class="empty"><div class="big">📈</div><p>Sobald du ein Training gespeichert hast, siehst du hier die Steigerung pro Übung.</p></div>`,
    };
  }

  const rows = names.map(e => {
    const first = e.history[0], last = e.history[e.history.length - 1];
    const diff = last.maxKg - first.maxKg;
    const diffText = e.history.length > 1 ? `${diff >= 0 ? '+' : ''}${formatNumber(diff)} kg` : '';
    return `
      <button class="list-row clickable" data-action="open-exercise" data-name="${esc(e.name)}">
        <span class="dot" style="background:${e.color}"></span>
        <span class="grow">
          <div>${esc(e.name)}</div>
          <div class="sub">${formatNumber(last.maxKg)} kg · ${e.history.length} ${e.history.length === 1 ? 'Training' : 'Trainings'}</div>
        </span>
        <span class="sub" style="color:${diff > 0 ? '#4caf50' : diff < 0 ? 'var(--danger)' : 'var(--muted)'}">${diffText}</span>
        <span class="chev">›</span>
      </button>`;
  }).join('');

  return { title: 'Fortschritt', html: `<div class="section-title">Übungen</div><div class="list">${rows}</div>` };
};

const METRICS = {
  maxKg: { label: 'Max. Gewicht', unit: 'kg' },
  oneRM: { label: 'Geschätztes 1RM', unit: 'kg' },
  volume: { label: 'Volumen', unit: 'kg' },
};

views.exercise = ({ name }) => {
  const history = exerciseHistory(name);
  const info = allExerciseNames().find(e => normalizeName(e.name) === normalizeName(name));
  const color = info?.color ?? 'var(--accent)';
  const metric = ui.progressMetric;
  const values = history.map(h => h[metric]);

  const first = values[0], last = values[values.length - 1];
  const best = Math.max(...values);
  const diff = last - first;
  const pct = first > 0 ? (diff / first) * 100 : 0;

  const segmented = Object.entries(METRICS).map(([key, m]) =>
    `<button class="${key === metric ? 'active' : ''}" data-action="set-metric" data-metric="${key}">${m.label}</button>`).join('');

  const chart = lineChart(history.map(h => ({ x: parseISO(h.date).getTime(), y: h[metric] })), color, METRICS[metric].unit);

  const list = [...history].reverse().map(h => `
    <button class="list-row clickable" data-action="edit-workout" data-id="${h.workoutId}">
      <span class="grow">
        <div>${formatDate(h.date)}</div>
        <div class="sub">${describeSets(h.sets)}</div>
      </span>
      <b>${formatNumber(h[metric])} kg</b>
    </button>`).join('');

  return {
    title: name,
    html: `
      <div class="segmented">${segmented}</div>
      <div class="card">
        ${chart}
        <div class="stats">
          <div class="stat"><div class="label">Start</div><div class="value">${formatNumber(first)} kg</div></div>
          <div class="stat"><div class="label">Aktuell</div><div class="value">${formatNumber(last)} kg</div></div>
          <div class="stat"><div class="label">Bestwert</div><div class="value">${formatNumber(best)} kg</div></div>
          <div class="stat"><div class="label">Steigerung</div>
            <div class="value ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}">${diff >= 0 ? '+' : ''}${formatNumber(diff)} kg
              <span style="font-size:13px">(${diff >= 0 ? '+' : ''}${formatNumber(pct, 0)} %)</span></div></div>
        </div>
      </div>
      ${metric === 'oneRM' ? '<p class="hint">1RM nach Epley: Gewicht × (1 + Wdh. / 30) des besten Satzes.</p>' : ''}
      ${metric === 'volume' ? '<p class="hint">Volumen = Summe aus Gewicht × Wiederholungen aller Sätze.</p>' : ''}
      <div class="section-title">Verlauf</div>
      <div class="list">${list}</div>
    `,
  };
};

/* ----- Tab: Körpergewicht ----- */
const WEIGHT_RANGES = { '1M': 31, '3M': 92, '6M': 183, '1J': 366, 'Alle': Infinity };

views.weight = () => {
  const entries = [...data.bodyWeights].sort((a, b) => a.date.localeCompare(b.date));
  const lastKg = entries.length ? entries[entries.length - 1].kg : '';

  const rangeDays = WEIGHT_RANGES[ui.weightRange];
  const cutoff = rangeDays === Infinity ? '' : toISO(new Date(Date.now() - rangeDays * 86400000));
  const visible = entries.filter(e => e.date >= cutoff);

  const segmented = Object.keys(WEIGHT_RANGES).map(key =>
    `<button class="${key === ui.weightRange ? 'active' : ''}" data-action="set-range" data-range="${key}">${key}</button>`).join('');

  let chartHTML = '<p class="hint center">Keine Einträge in diesem Zeitraum.</p>';
  let statsHTML = '';
  if (visible.length) {
    chartHTML = lineChart(visible.map(e => ({ x: parseISO(e.date).getTime(), y: e.kg })), '#1E88E5', 'kg', { zeroBased: false });
    const first = visible[0].kg, last = visible[visible.length - 1].kg;
    const diff = last - first;
    statsHTML = `
      <div class="stats">
        <div class="stat"><div class="label">Aktuell</div><div class="value">${formatNumber(last)} kg</div></div>
        <div class="stat"><div class="label">Veränderung</div><div class="value">${diff >= 0 ? '+' : ''}${formatNumber(diff)} kg</div></div>
        <div class="stat"><div class="label">Minimum</div><div class="value">${formatNumber(Math.min(...visible.map(e => e.kg)))} kg</div></div>
        <div class="stat"><div class="label">Maximum</div><div class="value">${formatNumber(Math.max(...visible.map(e => e.kg)))} kg</div></div>
      </div>`;
  }

  const list = [...entries].reverse().map(e => `
    <div class="list-row">
      <span class="grow">${formatDate(e.date)}</span>
      <b>${formatNumber(e.kg)} kg</b>
      <button class="icon-btn danger" data-action="delete-weight" data-id="${e.id}" aria-label="Eintrag löschen">✕</button>
    </div>`).join('');

  return {
    title: 'Körpergewicht',
    html: `
      <form class="card" data-form="add-weight">
        <div style="display:flex;gap:10px">
          <label class="field" style="flex:1;margin:0"><span>Datum</span>
            <input type="date" name="date" value="${todayISO()}" max="${todayISO()}" required></label>
          <label class="field" style="flex:1;margin:0"><span>Gewicht (kg)</span>
            <input type="text" inputmode="decimal" name="kg" placeholder="${lastKg !== '' ? formatNumber(lastKg) : 'z. B. 82,5'}" required></label>
        </div>
        <button class="btn primary block" style="margin-top:12px" type="submit">Eintragen</button>
      </form>
      ${entries.length ? `
        <div class="segmented">${segmented}</div>
        <div class="card">${chartHTML}${statsHTML}</div>
        <div class="section-title">Einträge</div>
        <div class="list">${list}</div>`
      : `<div class="empty"><div class="big">⚖️</div><p>Trage dein Körpergewicht ein, um den Verlauf zu sehen.</p></div>`}
    `,
  };
};

/* ----- Einstellungen / Backup ----- */
views.settings = () => ({
  title: 'Einstellungen',
  html: `
    <div class="section-title">Backup</div>
    <div class="card">
      <p class="hint" style="margin-top:0">Deine Daten werden nur auf diesem iPhone gespeichert. Exportiere regelmäßig ein Backup (z. B. in die Dateien-App oder iCloud Drive), damit nichts verloren geht.</p>
      <button class="btn primary block" data-action="export">Backup exportieren</button>
      <div style="height:10px"></div>
      <button class="btn block" data-action="import">Backup importieren</button>
      <input type="file" id="import-file" accept="application/json,.json" hidden>
    </div>
    <div class="section-title">Statistik</div>
    <div class="list">
      <div class="list-row"><span class="grow">Trainingspläne</span><b>${data.plans.length}</b></div>
      <div class="list-row"><span class="grow">Trainings</span><b>${data.workouts.length}</b></div>
      <div class="list-row"><span class="grow">Körpergewicht-Einträge</span><b>${data.bodyWeights.length}</b></div>
    </div>
    <div class="section-title">Gefahrenzone</div>
    <button class="btn danger block" data-action="reset-all">Alle Daten löschen</button>
    <p class="hint center" style="margin-top:24px">Fightclub 🥊</p>
  `,
});

/* ---------------------------------------------------------------------
 * Diagramm (SVG, ohne externe Bibliothek)
 * ------------------------------------------------------------------- */

function niceStep(range, targetTicks) {
  const raw = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

function lineChart(points, color, unit, { zeroBased = false } = {}) {
  const W = 340, H = 200, padL = 40, padR = 12, padT = 12, padB = 26;
  const innerW = W - padL - padR, innerH = H - padT - padB;

  let minY = Math.min(...points.map(p => p.y));
  let maxY = Math.max(...points.map(p => p.y));
  if (zeroBased) minY = 0;
  if (minY === maxY) { minY -= Math.max(1, Math.abs(minY) * 0.05); maxY += Math.max(1, Math.abs(maxY) * 0.05); }
  const step = niceStep(maxY - minY, 4);
  minY = Math.floor(minY / step) * step;
  maxY = Math.ceil(maxY / step) * step;

  let minX = Math.min(...points.map(p => p.x));
  let maxX = Math.max(...points.map(p => p.x));
  if (minX === maxX) { minX -= 86400000 * 3; maxX += 86400000 * 3; }

  const sx = x => padL + ((x - minX) / (maxX - minX)) * innerW;
  const sy = y => padT + innerH - ((y - minY) / (maxY - minY)) * innerH;

  let grid = '';
  for (let v = minY; v <= maxY + step / 2; v += step) {
    const y = sy(v).toFixed(1);
    grid += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}"/>`;
    grid += `<text class="axis-label" x="${padL - 6}" y="${Number(y) + 4}" text-anchor="end">${formatNumber(v)}</text>`;
  }

  // X-Achse: bis zu 4 Datumsbeschriftungen
  const spanDays = (maxX - minX) / 86400000;
  const xTicks = 4;
  let xLabels = '';
  for (let i = 0; i < xTicks; i++) {
    const t = minX + ((maxX - minX) * i) / (xTicks - 1);
    const d = new Date(t);
    const label = spanDays > 150 ? `${fmtAxisMonth.format(d)} ${String(d.getFullYear()).slice(2)}` : fmtDateShort.format(d);
    const anchor = i === 0 ? 'start' : i === xTicks - 1 ? 'end' : 'middle';
    xLabels += `<text class="axis-label" x="${sx(t).toFixed(1)}" y="${H - 6}" text-anchor="${anchor}">${label}</text>`;
  }

  const coords = points.map(p => [sx(p.x), sy(p.y)]);
  const path = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const area = coords.length > 1
    ? `<path class="area" fill="${color}" d="${path}L${coords[coords.length - 1][0].toFixed(1)},${padT + innerH}L${coords[0][0].toFixed(1)},${padT + innerH}Z"/>`
    : '';
  const dots = points.length <= 40
    ? coords.map(([x, y], i) => `<circle class="point" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${color}"><title>${fmtDateShort.format(new Date(points[i].x))}: ${formatNumber(points[i].y)} ${unit}</title></circle>`).join('')
    : '';

  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Verlaufsdiagramm">
      ${grid}${xLabels}${area}
      <path class="line" stroke="${color}" d="${path}"/>
      ${dots}
    </svg>`;
}

/* ---------------------------------------------------------------------
 * Sheets (Dialoge)
 * ------------------------------------------------------------------- */

function openSheet(html, onMount) {
  const root = $('#sheet-root');
  root.innerHTML = `<div class="sheet-backdrop" data-action="close-sheet-backdrop"><div class="sheet" role="dialog">${html}</div></div>`;
  onMount?.(root.querySelector('.sheet'));
}

function closeSheet() { $('#sheet-root').innerHTML = ''; }

function colorGridHTML(selected) {
  return `<div class="color-grid">${PALETTE.map(([name, hex]) =>
    `<button type="button" class="color-swatch ${hex === selected ? 'selected' : ''}" style="background:${hex}"
      data-action="pick-color" data-color="${hex}" aria-label="${name}"></button>`).join('')}</div>`;
}

function openPlanEditor(plan = null) {
  const used = data.plans.map(p => p.color);
  const color = plan?.color ?? (PALETTE.find(([, hex]) => !used.includes(hex))?.[1] ?? PALETTE[0][1]);
  openSheet(`
    <h2>${plan ? 'Plan bearbeiten' : 'Neuer Trainingsplan'}</h2>
    <form data-form="save-plan" data-id="${plan?.id ?? ''}">
      <label class="field"><span>Name</span>
        <input type="text" name="name" value="${esc(plan?.name ?? '')}" placeholder="z. B. Push" required autocomplete="off"></label>
      <label class="field"><span>Farbe im Kalender</span></label>
      ${colorGridHTML(color)}
      <input type="hidden" name="color" value="${color}">
      <div class="btn-row">
        <button type="button" class="btn" data-action="close-sheet">Abbrechen</button>
        <button type="submit" class="btn primary">Speichern</button>
      </div>
      ${plan ? `<button type="button" class="btn danger block" style="margin-top:14px" data-action="delete-plan" data-id="${plan.id}">Plan löschen</button>` : ''}
    </form>
  `, sheet => { if (!plan) sheet.querySelector('input[name=name]').focus(); });
}

function openExerciseEditor(plan, exercise) {
  openSheet(`
    <h2>Übung bearbeiten</h2>
    <form data-form="rename-exercise" data-plan="${plan.id}" data-id="${exercise.id}">
      <label class="field"><span>Name</span>
        <input type="text" name="name" value="${esc(exercise.name)}" required autocomplete="off"></label>
      <div class="btn-row">
        <button type="button" class="btn" data-action="close-sheet">Abbrechen</button>
        <button type="submit" class="btn primary">Speichern</button>
      </div>
      <button type="button" class="btn danger block" style="margin-top:14px" data-action="delete-exercise" data-plan="${plan.id}" data-id="${exercise.id}">Übung aus Plan entfernen</button>
      <p class="hint center">Bereits gespeicherte Trainings bleiben erhalten.</p>
    </form>
  `);
}

function openPlanPicker(date) {
  openSheet(`
    <h2>Welcher Plan am ${formatDateShort(date)}?</h2>
    ${data.plans.map(p => `
      <button class="plan-card" data-action="start-workout" data-id="${p.id}" data-date="${date}">
        <span class="stripe" style="background:${p.color}"></span>
        <span class="body"><div class="name">${esc(p.name)}</div></span>
        <span class="chev">›</span>
      </button>`).join('')}
    <button class="btn block" data-action="close-sheet">Abbrechen</button>
  `);
}

/* ---------------------------------------------------------------------
 * Aktionen
 * ------------------------------------------------------------------- */

function startWorkout(planId, date = todayISO()) {
  const plan = planById(planId);
  if (!plan) return;
  if (draft && !confirm('Es läuft bereits ein Training. Möchtest du es verwerfen und ein neues starten?')) {
    return;
  }
  draft = buildDraft(plan, date);
  saveDraft();
  closeSheet();
  push({ view: 'workout' });
}

function editWorkout(id) {
  const workout = workoutById(id);
  if (!workout) return;
  if (draft && draft.workoutId !== id && !confirm('Es läuft bereits ein Training. Möchtest du es verwerfen?')) return;
  if (!draft || draft.workoutId !== id) {
    draft = buildDraft(null, null, workout);
    saveDraft();
  }
  push({ view: 'workout' });
}

function finishWorkout() {
  if (!draft) return;
  const exercises = draft.exercises
    .map(e => ({
      name: e.name,
      sets: e.sets
        .map(s => ({ kg: parseNumber(s.kg) ?? 0, reps: Math.round(parseNumber(s.reps) ?? 0) }))
        .filter(s => s.reps > 0),
    }))
    .filter(e => e.sets.length);

  if (!exercises.length) {
    toast('Trage mindestens einen Satz mit Wiederholungen ein.');
    return;
  }

  if (draft.workoutId) {
    const w = workoutById(draft.workoutId);
    if (w) {
      w.date = draft.date;
      w.exercises = exercises;
    }
  } else {
    data.workouts.push({
      id: uid(),
      planId: draft.planId,
      planName: draft.planName,
      planColor: draft.planColor,
      date: draft.date,
      createdAt: Date.now(),
      exercises,
    });
  }
  save();
  draft = null;
  saveDraft();
  ui.stack.pop();
  toast('Training gespeichert 💪');
  render();
}

function exportBackup() {
  const json = JSON.stringify(data, null, 2);
  const fileName = `fightclub-backup-${todayISO()}.json`;
  const file = new File([json], fileName, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file], title: 'Fightclub Backup' }).catch(() => {});
    return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importBackup(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const imported = sanitizeData(parsed);
    const summary = `${imported.plans.length} Pläne, ${imported.workouts.length} Trainings, ${imported.bodyWeights.length} Gewichtseinträge`;
    if (!confirm(`Backup mit ${summary} importieren? Die aktuellen Daten werden ersetzt.`)) return;
    data = imported;
    save();
    toast('Backup importiert');
    render();
  } catch (err) {
    console.error(err);
    toast('Die Datei ist kein gültiges Fightclub-Backup.');
  }
}

const actions = {
  'open-plan': el => push({ view: 'plan', planId: el.dataset.id }),
  'new-plan': () => openPlanEditor(),
  'edit-plan': el => openPlanEditor(planById(el.dataset.id)),
  'pick-color': el => {
    const form = el.closest('form');
    form.querySelectorAll('.color-swatch').forEach(s => s.classList.toggle('selected', s === el));
    form.querySelector('input[name=color]').value = el.dataset.color;
  },
  'delete-plan': el => {
    const plan = planById(el.dataset.id);
    if (!plan || !confirm(`Plan „${plan.name}“ löschen? Deine gespeicherten Trainings bleiben erhalten.`)) return;
    data.plans = data.plans.filter(p => p.id !== plan.id);
    save();
    closeSheet();
    ui.stack = ui.stack.filter(v => v.planId !== plan.id);
    render();
  },
  'sample-plans': () => {
    SAMPLE_PLANS.forEach(([name, color, exercises]) => {
      data.plans.push({ id: uid(), name, color, exercises: exercises.map(n => ({ id: uid(), name: n })) });
    });
    save();
    render();
  },
  'edit-exercise': el => {
    const plan = planById(el.dataset.plan);
    const exercise = plan?.exercises.find(e => e.id === el.dataset.id);
    if (exercise) openExerciseEditor(plan, exercise);
  },
  'delete-exercise': el => {
    const plan = planById(el.dataset.plan);
    if (!plan) return;
    plan.exercises = plan.exercises.filter(e => e.id !== el.dataset.id);
    save();
    closeSheet();
    render();
  },
  'move-exercise': el => {
    const plan = planById(el.dataset.plan);
    const i = Number(el.dataset.index), j = i + Number(el.dataset.dir);
    if (!plan || j < 0 || j >= plan.exercises.length) return;
    [plan.exercises[i], plan.exercises[j]] = [plan.exercises[j], plan.exercises[i]];
    save();
    render();
  },
  'start-workout': el => startWorkout(el.dataset.id, el.dataset.date || todayISO()),
  'resume-draft': () => push({ view: 'workout' }),
  'discard-draft': () => {
    if (!confirm('Training wirklich verwerfen?')) return;
    const wasOpen = currentView().view === 'workout';
    draft = null;
    saveDraft();
    if (wasOpen) ui.stack.pop();
    render();
  },
  'edit-workout': el => editWorkout(el.dataset.id),
  'delete-workout': el => {
    if (!confirm('Dieses Training endgültig löschen?')) return;
    data.workouts = data.workouts.filter(w => w.id !== el.dataset.id);
    save();
    draft = null;
    saveDraft();
    ui.stack.pop();
    toast('Training gelöscht');
    render();
  },
  'finish-workout': () => finishWorkout(),
  'add-set': el => {
    const ex = draft.exercises[Number(el.dataset.ex)];
    const prev = ex.sets[ex.sets.length - 1];
    ex.sets.push({ kg: prev?.kg ?? null, reps: prev?.reps ?? null });
    saveDraft();
    render();
    // Fokus in das Gewicht des neuen Satzes
    const inputs = document.querySelectorAll(`input[data-bind=kg][data-ex="${el.dataset.ex}"]`);
    inputs[inputs.length - 1]?.focus();
  },
  'remove-set': el => {
    const ex = draft.exercises[Number(el.dataset.ex)];
    ex.sets.splice(Number(el.dataset.set), 1);
    saveDraft();
    render();
  },
  'remove-draft-exercise': el => {
    const ex = draft.exercises[Number(el.dataset.ex)];
    if (!confirm(`„${ex.name}“ aus diesem Training entfernen?`)) return;
    draft.exercises.splice(Number(el.dataset.ex), 1);
    saveDraft();
    render();
  },
  'select-day': el => { ui.calendarSelected = el.dataset.date; render(); },
  'cal-prev': () => { ui.calendarMonth = new Date(ui.calendarMonth.getFullYear(), ui.calendarMonth.getMonth() - 1, 1); render(); },
  'cal-next': () => { ui.calendarMonth = new Date(ui.calendarMonth.getFullYear(), ui.calendarMonth.getMonth() + 1, 1); render(); },
  'log-for-day': el => openPlanPicker(el.dataset.date),
  'open-exercise': el => push({ view: 'exercise', name: el.dataset.name }),
  'set-metric': el => { ui.progressMetric = el.dataset.metric; render(); },
  'set-range': el => { ui.weightRange = el.dataset.range; render(); },
  'delete-weight': el => {
    if (!confirm('Eintrag löschen?')) return;
    data.bodyWeights = data.bodyWeights.filter(b => b.id !== el.dataset.id);
    save();
    render();
  },
  'open-settings': () => push({ view: 'settings' }),
  'export': () => exportBackup(),
  'import': () => $('#import-file').click(),
  'reset-all': () => {
    if (!confirm('Wirklich ALLE Daten löschen? Das kann nicht rückgängig gemacht werden.')) return;
    if (!confirm('Bist du sicher? Exportiere vorher am besten ein Backup.')) return;
    data = emptyData();
    draft = null;
    save();
    saveDraft();
    switchTab('plans');
  },
  'close-sheet': () => closeSheet(),
  'close-sheet-backdrop': (el, event) => { if (event.target === el) closeSheet(); },
};

const forms = {
  'save-plan': form => {
    const name = form.elements.name.value.trim();
    if (!name) return;
    const color = form.elements.color.value;
    const id = form.dataset.id;
    if (id) {
      const plan = planById(id);
      plan.name = name;
      plan.color = color;
    } else {
      const plan = { id: uid(), name, color, exercises: [] };
      data.plans.push(plan);
      save();
      closeSheet();
      push({ view: 'plan', planId: plan.id });
      setTimeout(() => $('form[data-form=add-exercise] input')?.focus(), 50);
      return;
    }
    save();
    closeSheet();
    render();
  },
  'add-exercise': form => {
    const name = form.elements.name.value.trim();
    if (!name) return;
    planById(form.dataset.plan).exercises.push({ id: uid(), name });
    save();
    render();
    $('form[data-form=add-exercise] input')?.focus();
  },
  'rename-exercise': form => {
    const name = form.elements.name.value.trim();
    const plan = planById(form.dataset.plan);
    const exercise = plan?.exercises.find(e => e.id === form.dataset.id);
    if (!name || !exercise) return;
    exercise.name = name;
    save();
    closeSheet();
    render();
  },
  'add-draft-exercise': form => {
    const name = form.elements.name.value.trim();
    if (!name || !draft) return;
    draft.exercises.push(draftExercise(name, draft.date, draft.workoutId));
    // Neue Übung auch dauerhaft im Plan speichern
    const plan = planById(draft.planId);
    if (plan && !plan.exercises.some(e => normalizeName(e.name) === normalizeName(name))) {
      plan.exercises.push({ id: uid(), name });
      save();
    }
    saveDraft();
    render();
  },
  'add-weight': form => {
    const kg = parseNumber(form.elements.kg.value);
    const date = form.elements.date.value || todayISO();
    if (kg == null || kg <= 0 || kg > 500) { toast('Bitte ein gültiges Gewicht eingeben.'); return; }
    // Pro Tag ein Eintrag – ein neuer Wert ersetzt den alten.
    data.bodyWeights = data.bodyWeights.filter(b => b.date !== date);
    data.bodyWeights.push({ id: uid(), date, kg });
    save();
    toast('Gewicht eingetragen');
    render();
  },
};

/* ---------------------------------------------------------------------
 * Event-Handling
 * ------------------------------------------------------------------- */

document.addEventListener('click', event => {
  const el = event.target.closest('[data-action]');
  if (!el) return;
  const action = actions[el.dataset.action];
  if (!action) return;
  if (el.dataset.action !== 'close-sheet-backdrop') event.preventDefault();
  action(el, event);
});

document.addEventListener('submit', event => {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  forms[form.dataset.form]?.(form);
});

document.addEventListener('input', event => {
  const el = event.target;
  if (!draft || !el.dataset.bind) return;
  if (el.dataset.bind === 'date') {
    if (el.value) draft.date = el.value;
  } else {
    const set = draft.exercises[Number(el.dataset.ex)]?.sets[Number(el.dataset.set)];
    if (set) set[el.dataset.bind] = el.value;
  }
  saveDraft();
});

// Datum im Training geändert → „Letztes Mal“ neu berechnen
document.addEventListener('change', event => {
  if (event.target.dataset?.bind === 'date') render();
});

document.addEventListener('change', event => {
  if (event.target.id === 'import-file' && event.target.files[0]) {
    importBackup(event.target.files[0]);
    event.target.value = '';
  }
});

$('#back-btn').addEventListener('click', back);
document.querySelectorAll('#tabbar button').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

/* ---------------------------------------------------------------------
 * Start
 * ------------------------------------------------------------------- */

render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service Worker:', err));
}

// Bittet den Browser, die Daten nicht automatisch zu löschen.
navigator.storage?.persist?.().catch(() => {});
