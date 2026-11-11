'use strict';

/* =========================================================
   ERNÄHRUNG – Kalorien-Tagebuch (wie MyFitnessPal)

   - Tagebuch mit Frühstück, Mittagessen, Abendessen, Snacks
   - Suche findet alles: eigene und zuletzt gegessene Lebensmittel, Rezepte,
     die eingebaute Liste (js/fooddb.js, sofort und offline) und – während
     des Tippens – Produkte aus Open Food Facts
   - Strichcode scannen → Nährwerte aus Open Food Facts
   - Eigene Lebensmittel anlegen, Schnell-Einträge, Tagesziele

   Diese Datei wird vor app.js geladen und nutzt deren Hilfsfunktionen
   ($, data, save, Keypad, openSheet, …) erst zur Laufzeit.
   ========================================================= */

const MEALS = [
  ['breakfast', 'Frühstück'],
  ['lunch', 'Mittagessen'],
  ['dinner', 'Abendessen'],
  ['snack', 'Snacks'],
];
const mealInfo = (m) => MEALS.find((x) => x[0] === m) || MEALS[3];
const foodState = { date: null, tab: 'diary', foodQuery: '' };
const round1 = (x) => Math.round((Number(x) || 0) * 10) / 10;
/** Kalorien aus Makros: Eiweiß und Kohlenhydrate 4 kcal/g, Fett 9 kcal/g. */
const kcalFromMacros = (p, c, f) => Math.round((Number(p) || 0) * 4 + (Number(c) || 0) * 4 + (Number(f) || 0) * 9);

function defaultMeal() {
  const h = new Date().getHours();
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 17 ? 'snack' : h < 22 ? 'dinner' : 'snack';
}
const entryMeal = (e) => (MEALS.some((m) => m[0] === e.meal) ? e.meal : 'snack');
const entryName = (e) => e.name || (e.src === 'mfp' ? 'MyFitnessPal-Import' : 'Schnell-Eintrag');

function calcNutrition(per100, amount) {
  const k = (Number(amount) || 0) / 100;
  return { kcal: Math.round((per100.kcal || 0) * k), p: round1((per100.p || 0) * k), c: round1((per100.c || 0) * k), f: round1((per100.f || 0) * k) };
}
function sumNutrition(entries) {
  return entries.reduce((a, e) => ({ kcal: a.kcal + (e.kcal || 0), p: a.p + (e.p || 0), c: a.c + (e.c || 0), f: a.f + (e.f || 0) }), { kcal: 0, p: 0, c: 0, f: 0 });
}
function foodByDate() {
  const m = {};
  data.food.forEach((e) => {
    const d = m[e.date] || (m[e.date] = { kcal: 0, p: 0, c: 0, f: 0, items: [] });
    d.kcal += e.kcal || 0; d.p += e.p || 0; d.c += e.c || 0; d.f += e.f || 0;
    d.items.push(e);
  });
  return m;
}
const macroLine = (n) => `E ${fmtNum(n.p, 0)} g · K ${fmtNum(n.c, 0)} g · F ${fmtNum(n.f, 0)} g`;

/* Portionsnamen der eingebauten Lebensmittel („1 Stück“, „2 Scheiben“ …) */
const SERVING_PLURAL = { Scheibe: 'Scheiben', Glas: 'Gläser', Dose: 'Dosen', Tasse: 'Tassen', Portion: 'Portionen', Kugel: 'Kugeln', Flasche: 'Flaschen', Zehe: 'Zehen', Hälfte: 'Hälften' };
const servingWord = (label, n) => (n === 1 ? label : SERVING_PLURAL[label] || label);

/* ---------------- Open Food Facts ---------------- */

const OFF_FIELDS = 'code,product_name,product_name_de,generic_name,generic_name_de,brands,quantity,serving_size,serving_quantity,nutriments,countries_tags';

/** Lädt JSON mit Zeitlimit. signal: Abbruch von außen (z. B. weil weitergetippt wurde). */
async function offFetch(url, ms = 12000, signal) {
  const ctl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, ms);
  const onAbort = () => ctl.abort();
  if (signal) {
    if (signal.aborted) ctl.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok && r.status !== 404) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) {
    if (timedOut) throw new Error('Zeitüberschreitung');
    throw e;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

/** Produkt aus Open Food Facts (Produkt-Abruf oder Suchtreffer) → Lebensmittel der App.
    Die beiden Such-Schnittstellen liefern leicht unterschiedliche Formen (z. B. Marken
    als Text oder als Liste) – beides wird verstanden. */
function offToFood(p, code) {
  if (!p) return null;
  const n = p.nutriments && typeof p.nutriments === 'object' ? p.nutriments : {};
  const num = (v) => (v === undefined || v === null || v === '' || !isFinite(Number(v)) ? null : Number(v));
  const str = (x) => (typeof x === 'string' ? x.trim() : '');
  // Namen kommen als Text oder nach Sprache aufgeteilt ({ de: …, main: … }) – Deutsch bevorzugt
  const lang = (x) => (x && typeof x === 'object'
    ? str(x.de) || str(x.main) || str(x.en) || str(Object.values(x).find((v) => str(v)))
    : str(x));
  let kcal = num(n['energy-kcal_100g']);
  if (kcal == null) {
    const kj = num(n['energy-kj_100g']) ?? num(n.energy_100g);
    if (kj != null) kcal = kj / 4.184;
  }
  const barcode = String(code || p.code || '');
  const quantity = String(p.quantity || '').toLowerCase();
  const serving = num(p.serving_quantity);
  const brand = Array.isArray(p.brands) ? p.brands[0] : String(p.brands || '').split(',')[0];
  const tags = Array.isArray(p.countries_tags) ? p.countries_tags : [];
  return {
    id: 'off-' + barcode,
    barcode,
    name: str(p.product_name_de) || lang(p.product_name) || str(p.generic_name_de) || lang(p.generic_name) || 'Unbekanntes Produkt',
    brand: str(brand),
    unit: /\d\s*(ml|cl|l)\b/.test(quantity) ? 'ml' : 'g',
    per100: { kcal: kcal == null ? null : Math.round(kcal), p: round1(num(n.proteins_100g)), c: round1(num(n.carbohydrates_100g)), f: round1(num(n.fat_100g)) },
    serving: serving && serving > 0 && serving < 2000 ? Math.round(serving) : null,
    servingName: str(p.serving_size),
    src: 'off',
    _de: !!str(p.product_name_de) || tags.includes('en:germany'),
  };
}

async function offProduct(code) {
  const j = await offFetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`);
  if (!j || j.status !== 1 || !j.product) return null;
  const { _de, ...food } = offToFood(j.product, code);
  return food;
}

/* Volltextsuche: zuerst die neue Such-Schnittstelle von Open Food Facts
   (search.openfoodfacts.org), bei Ausfall die bisherige (cgi/search.pl – sie war
   2026 zeitweise nicht erreichbar). Fällt eine aus, wird sie ein paar Minuten
   übersprungen. */
const offDown = { sal: 0, legacy: 0 };
let offLegacyAt = 0;
const offQuery = (q) => String(q).replace(/[+\-!(){}[\]^"~*?:\\/|&<>=]/g, ' ').replace(/\s+/g, ' ').trim();

async function offSearchSal(q, signal) {
  const base = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=30`;
  let j;
  try {
    j = await offFetch(`${base}&langs=de,en&fields=${OFF_FIELDS}`, 8000, signal);
  } catch (e) {
    // Lehnt die Schnittstelle die Zusatzangaben ab (HTTP 4xx), genügt die schlichte Anfrage.
    if ((signal && signal.aborted) || !/^HTTP 4/.test(e.message)) throw e;
    j = await offFetch(base, 8000, signal);
  }
  if (!j || !Array.isArray(j.hits)) throw new Error('Antwort unlesbar');
  return j.hits;
}

async function offSearchLegacy(q, signal) {
  // Die alte Schnittstelle erlaubt nur wenige Suchen pro Minute – deshalb Abstand halten.
  const wait = offLegacyAt + 6500 - Date.now();
  if (wait > 0) {
    await new Promise((resolve, reject) => {
      const t = setTimeout(resolve, wait);
      if (signal) signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('abgebrochen', 'AbortError')); }, { once: true });
    });
  }
  offLegacyAt = Date.now();
  const j = await offFetch(`https://de.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=30&fields=${OFF_FIELDS}`, 12000, signal);
  if (!j || !Array.isArray(j.products)) throw new Error('Antwort unlesbar');
  return j.products;
}

/** Brauchbare Treffer (mit Kalorien und Namen), ohne Doppelte; Produkte aus Deutschland zuerst. */
function offRank(raw) {
  const seen = new Set();
  const out = [];
  for (const p of raw) {
    const f = offToFood(p);
    if (!f || !f.barcode || f.per100.kcal == null || f.per100.kcal > 950 || f.name === 'Unbekanntes Produkt' || seen.has(f.id)) continue;
    seen.add(f.id);
    out.push(f);
  }
  return out.sort((a, b) => Number(b._de) - Number(a._de)).map(({ _de, ...f }) => f);
}

async function offSearch(q, signal) {
  const clean = offQuery(q);
  if (!clean) return [];
  const all = [['sal', offSearchSal], ['legacy', offSearchLegacy]];
  const up = all.filter(([name]) => Date.now() > offDown[name]);
  const list = up.length ? up : all;
  let lastErr = null;
  let empty = null;
  for (let i = 0; i < list.length; i++) {
    const [name, search] = list[i];
    try {
      const raw = await search(clean, signal);
      const found = offRank(raw);
      // Treffer ohne verwertbare Nährwerte: lieber noch die andere Schnittstelle fragen
      if (!found.length && raw.length && i < list.length - 1) { empty = found; continue; }
      return found;
    } catch (e) {
      if (signal && signal.aborted) throw e;
      lastErr = e;
      offDown[name] = Date.now() + 5 * 60000;
    }
  }
  if (empty) return empty;
  throw lastErr || new Error('Suche nicht möglich');
}

/* ---------------- Lebensmittel-Quellen ---------------- */

/** Zuletzt gegessene Lebensmittel (ohne Schnell-Einträge), neueste zuerst. */
function recentFoods(limit = 20) {
  const seen = new Set();
  const out = [];
  for (const e of [...data.food].sort((a, b) => (b.upd || 0) - (a.upd || 0))) {
    if (!e.per100 || e.per100.kcal == null) continue;
    const key = e.foodId || norm(e.name + '|' + (e.brand || ''));
    if (seen.has(key)) continue;
    seen.add(key);
    if (e.foodId && String(e.foodId).startsWith('r-')) {
      const r = data.recipes.find((x) => 'r-' + x.id === e.foodId);
      if (r) out.push({ ...recipeFood(r), lastAmount: e.amount });
      if (out.length >= limit) break;
      continue;
    }
    const own = e.foodId && data.foods.find((f) => f.id === e.foodId);
    out.push(own || {
      id: e.foodId || null, name: e.name, brand: e.brand || '', unit: e.unit || 'g', per100: e.per100,
      serving: e.serving || null, servingLabel: e.servingLabel || '', src: e.src || 'own', lastAmount: e.amount,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Eigene und zuletzt gegessene Lebensmittel, die zu allen Suchwörtern passen. */
function localSearch(q) {
  const words = foldText(q).split(' ').filter(Boolean);
  const match = (f) => { const hay = foldText(f.name + ' ' + (f.brand || '')); return words.every((w) => hay.includes(w)); };
  const seen = new Set();
  const out = [];
  for (const f of [...data.foods, ...recentFoods(200)]) {
    const key = f.id || norm(f.name + '|' + (f.brand || ''));
    if (seen.has(key) || !match(f)) continue;
    seen.add(key);
    out.push(f);
  }
  return out.slice(0, 30);
}

function foodRowHtml(f, attr) {
  const unit = f.unit || 'g';
  const portion = f.serving ? ` · ${f.servingLabel && f.servingLabel !== 'Portion' ? `1 ${esc(f.servingLabel)} =` : 'Portion'} ${fmtNum(f.serving, 0)} ${unit}` : '';
  return `<button class="food-row" ${attr}>
    <div class="grow"><div class="t">${esc(f.name)}</div>
    <div class="s">${f.brand ? esc(f.brand) + ' · ' : ''}${fmtNum(f.per100.kcal, 0)} kcal / 100 ${unit}${portion}</div></div>
    <span class="plus">${ico('plus')}</span></button>`;
}

/* =========================================================
   ANSICHT
   ========================================================= */

function viewNutrition() {
  if (!foodState.date) foodState.date = todayStr();
  setHeader('Ernährung', `<button class="top-chip" id="scanTop" aria-label="Strichcode scannen">${ico('scan')}</button>`);
  const v = $('#view');
  const tabs = [['diary', 'Tagebuch'], ['recipes', 'Rezepte'], ['foods', 'Produkte'], ['stats', 'Statistik']];
  v.innerHTML = `<div class="seg">${tabs.map(([k, l]) => `<button data-ftab="${k}" class="${foodState.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="foodView"></div>`;
  $$('[data-ftab]', v).forEach((b) => b.onclick = () => { if (foodState.tab !== b.dataset.ftab) { foodState.tab = b.dataset.ftab; render(true); scrollTop(); } });
  $('#scanTop').onclick = () => openScanner(defaultMeal());
  const target = $('#foodView');
  if (foodState.tab === 'stats') viewFoodStats(target);
  else if (foodState.tab === 'foods') viewFoodList(target);
  else if (foodState.tab === 'recipes') viewRecipes(target);
  else viewDiary(target);
}

function viewDiary(v) {
  const today = todayStr();
  const d = foodState.date;
  const entries = data.food.filter((e) => e.date === d);
  const t = sumNutrition(entries);
  const st = data.settings;
  const goal = st.kcalGoal || 0;
  const left = goal - t.kcal;
  const label = d === today ? 'Heute' : d === addDays(today, -1) ? 'Gestern' : d === addDays(today, 1) ? 'Morgen' : fmtDateLong(d);
  const yesterday = data.food.filter((e) => e.date === addDays(d, -1));

  const bar = (val, g) => (g ? Math.min(100, (val / g) * 100) : 0);
  const macro = (name, val, g, color) => `<div class="mbar"><div class="mtop"><span>${name}</span><b>${fmtNum(val, 0)}${g ? `<small>/${g} g</small>` : ' g'}</b></div><i><b style="width:${bar(val, g)}%;background:${val > (g || Infinity) * 1.05 ? 'var(--red)' : color}"></b></i></div>`;

  const meals = MEALS.map(([key, name]) => {
    const list = entries.filter((e) => entryMeal(e) === key);
    const sum = sumNutrition(list);
    const yList = yesterday.filter((e) => entryMeal(e) === key);
    return `<section class="panel meal">
      <div class="meal-head"><h3>${name}</h3><b>${fmtNum(sum.kcal, 0)}<small> kcal</small></b></div>
      ${list.map((e) => `<button class="food-row" data-entry="${e.id}">
        <div class="grow"><div class="t">${esc(entryName(e))}</div>
        <div class="s">${e.brand ? esc(e.brand) + ' · ' : ''}${e.amount ? `${fmtNum(e.amount, 0)} ${e.unit || 'g'} · ` : ''}${macroLine(e)}</div></div>
        <b>${fmtNum(e.kcal, 0)}</b></button>`).join('')}
      ${!list.length && yList.length ? `<button class="copy-link" data-copy="${key}">${ico('copy')}Wie gestern übernehmen (${fmtNum(sumNutrition(yList).kcal, 0)} kcal)</button>` : ''}
      <div class="meal-actions">
        <button class="btn small" data-add="${key}">${ico('plus')}Hinzufügen</button>
        <button class="ibtn scan" data-scan="${key}" aria-label="${name}: Strichcode scannen">${ico('scan')}</button>
      </div>
    </section>`;
  }).join('');

  v.innerHTML = `
    <button class="search-fake" id="fsOpen">${ico('search')}<span>Lebensmittel suchen …</span></button>
    <div class="day-nav">
      <button class="ibtn" id="dPrev" aria-label="Vorheriger Tag">${ico('chevl')}</button>
      <label class="day-label">${label}<input type="date" id="dPick" value="${d}" aria-label="Datum wählen"></label>
      <button class="ibtn" id="dNext" aria-label="Nächster Tag">${ico('chevr')}</button>
    </div>
    <button class="panel summary" id="goalBtn">
      <div class="row"><div class="grow"><div class="hint">Kalorien übrig</div>
        <div class="big-left ${left < 0 ? 'over' : ''}">${fmtNum(left, 0)}</div></div>
        <span class="hint small" style="display:flex;align-items:center;gap:4px">Ziele ${ico('edit')}</span></div>
      <div class="equation">
        <span><b>${fmtNum(goal, 0)}</b>Ziel</span><span class="op">−</span>
        <span><b>${fmtNum(t.kcal, 0)}</b>Essen</span><span class="op">=</span>
        <span><b>${fmtNum(left, 0)}</b>Übrig</span>
      </div>
      <div class="hp"><i class="${goal && t.kcal > goal ? 'over' : ''}" style="width:${bar(t.kcal, goal)}%"></i></div>
      <div class="macro-bars">
        ${macro('Eiweiß', t.p, st.proteinGoal, 'var(--blue)')}
        ${macro('Kohlenh.', t.c, st.carbsGoal, 'var(--yellow)')}
        ${macro('Fett', t.f, st.fatGoal, 'var(--orange)')}
      </div>
    </button>
    ${meals}
    <button class="btn dashed" id="quickAdd">${ico('zap')}Schnell-Eintrag (Makros)</button>`;

  $('#fsOpen').onclick = () => foodSearch(defaultMeal(), { focus: true });
  $('#dPrev').onclick = () => { foodState.date = addDays(d, -1); render(); };
  $('#dNext').onclick = () => { foodState.date = addDays(d, 1); render(); };
  $('#dPick').onchange = (e) => { if (e.target.value) { foodState.date = e.target.value; render(); } };
  $('#goalBtn').onclick = goalsSheet;
  $('#quickAdd').onclick = () => quickEntry(defaultMeal());
  $$('[data-add]', v).forEach((b) => b.onclick = () => foodSearch(b.dataset.add));
  $$('[data-scan]', v).forEach((b) => b.onclick = () => openScanner(b.dataset.scan));
  $$('[data-entry]', v).forEach((b) => b.onclick = () => {
    const e = data.food.find((x) => x.id === b.dataset.entry);
    if (!e) return;
    if (e.per100 && e.per100.kcal != null && e.amount) portionSheet(foodFromEntry(e), entryMeal(e), e);
    else quickEntry(entryMeal(e), e);
  });
  $$('[data-copy]', v).forEach((b) => b.onclick = () => {
    const meal = b.dataset.copy;
    yesterday.filter((e) => entryMeal(e) === meal).forEach((e) => {
      const { id, upd, ...rest } = e;
      data.food.push(touch({ ...rest, id: uid(), date: d, meal }));
    });
    save(); toast('Übernommen'); render();
  });
}

function foodFromEntry(e) {
  const recipeId = e.foodId && String(e.foodId).startsWith('r-') ? String(e.foodId).slice(2) : undefined;
  return (e.foodId && data.foods.find((f) => f.id === e.foodId)) ||
    { id: e.foodId || null, recipeId, name: e.name, brand: e.brand || '', unit: e.unit || 'g', per100: e.per100, serving: e.serving || null, servingLabel: e.servingLabel || '', src: e.src || 'own' };
}

function viewFoodStats(v) {
  const days = foodByDate();
  const today = todayStr();
  const st = data.settings;
  const bars = Array.from({ length: 14 }, (_, i) => { const d = addDays(today, i - 13); return { date: d, y: days[d] ? Math.round(days[d].kcal) : 0 }; });
  const tracked = Object.keys(days).filter((d) => d > addDays(today, -14) && d <= today && days[d].kcal > 0);
  const avg = (k) => (tracked.length ? tracked.reduce((a, d) => a + days[d][k], 0) / tracked.length : 0);
  const aK = avg('kcal'), aP = avg('p'), aC = avg('c'), aF = avg('f');
  const energy = aP * 4 + aC * 4 + aF * 9 || 1;
  const pct = (x) => Math.round((x / energy) * 100);
  const list = Object.keys(days).sort().reverse().slice(0, 45);

  v.innerHTML = `
    <span class="label">Letzte 14 Tage</span>
    <div class="panel" id="fChart"></div>
    <div class="stats">
      ${statCard('Ø Kalorien', tracked.length ? `${fmtNum(aK, 0)} kcal` : '–')}
      ${statCard('Tage im Ziel', tracked.length ? `${tracked.filter((d) => !st.kcalGoal || days[d].kcal <= st.kcalGoal * 1.05).length}/${tracked.length}` : '–')}
      ${statCard('Ø Eiweiß', tracked.length ? `${fmtNum(aP, 0)} g` : '–')}
      ${statCard('Getrackte Tage', tracked.length)}
    </div>
    ${tracked.length ? `<div class="panel">
      <div class="hint" style="margin-bottom:8px">Ø Verteilung der Kalorien</div>
      <div class="split"><i style="width:${pct(aP * 4)}%;background:var(--blue)"></i><i style="width:${pct(aC * 4)}%;background:var(--yellow)"></i><i style="width:${pct(aF * 9)}%;background:var(--orange)"></i></div>
      <div class="legend small"><span><i class="dot" style="background:var(--blue)"></i>Eiweiß ${pct(aP * 4)} %</span><span><i class="dot" style="background:var(--yellow)"></i>Kohlenh. ${pct(aC * 4)} %</span><span><i class="dot" style="background:var(--orange)"></i>Fett ${pct(aF * 9)} %</span></div>
    </div>` : ''}
    ${list.length ? `<span class="label">Tage</span>
      ${list.map((d) => `<button class="row-item" data-day="${d}"><div class="grow"><div class="t">${fmtDateLong(d)}</div><div class="s">${macroLine(days[d])}</div></div><b>${fmtNum(days[d].kcal, 0)}</b><span class="chev">${ico('chevr')}</span></button>`).join('')}` : ''}`;

  barChart($('#fChart'), bars, st.kcalGoal, 'kcal');
  $$('[data-day]', v).forEach((b) => b.onclick = () => { foodState.date = b.dataset.day; foodState.tab = 'diary'; render(true); scrollTop(); });
}

/** „Produkte“: eigene und gescannte Lebensmittel verwalten. */
function viewFoodList(v) {
  v.innerHTML = `
    <label class="search-box" style="margin-bottom:12px">${ico('search')}
      <input id="flQ" type="search" placeholder="Meine Lebensmittel durchsuchen …" value="${esc(foodState.foodQuery)}" autocomplete="off" autocorrect="off" enterkeyhint="search" aria-label="Meine Lebensmittel durchsuchen"></label>
    <button class="btn yellow" id="flNew">${ico('plus')}Eigenes Lebensmittel anlegen</button>
    <div class="gap"></div>
    <div id="flList"></div>
    <p class="hint small center" style="margin-top:4px">Hier stehen nur deine eigenen und gescannten Lebensmittel. Alles andere findest du über die Suche im Tagebuch.</p>`;

  const input = $('#flQ');
  // Nur die Liste wird neu gezeichnet – das Suchfeld bleibt stehen, die Tastatur offen.
  const draw = () => {
    const words = foldText(foodState.foodQuery).split(' ').filter(Boolean);
    const foods = [...data.foods]
      .filter((f) => { const hay = foldText(f.name + ' ' + (f.brand || '')); return words.every((w) => hay.includes(w)); })
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    $('#flList').innerHTML = `<div class="panel res-list">${foods.length ? foods.map((f) => foodRowHtml(f, `data-fid="${esc(f.id)}"`)).join('')
      : `<p class="hint" style="margin:12px 0">${words.length ? 'Nichts gefunden.' : 'Noch keine eigenen Lebensmittel. Gescannte und selbst angelegte Produkte landen hier – beim nächsten Mal findest du sie sofort, auch offline.'}</p>`}</div>`;
    $$('[data-fid]', v).forEach((b) => b.onclick = () => {
      const f = data.foods.find((x) => x.id === b.dataset.fid);
      if (f) ownFoodSheet(f);
    });
  };
  input.oninput = () => { foodState.foodQuery = input.value; draw(); };
  $('#flNew').onclick = () => customFoodSheet({}, null);
  draw();
}

function ownFoodSheet(f) {
  openSheet(`${sheetHead(esc(f.name))}
    <p class="hint">${f.brand ? esc(f.brand) + ' · ' : ''}${f.barcode ? 'Strichcode ' + esc(f.barcode) : 'ohne Strichcode'}</p>
    <div class="panel nut-line">Pro 100 ${f.unit || 'g'}: <b>${fmtNum(f.per100.kcal, 0)} kcal</b> · ${macroLine(f.per100)}${f.serving ? `<br>Portion: <b>${fmtNum(f.serving, 0)} ${f.unit || 'g'}</b>` : ''}</div>
    <button class="btn primary" id="fdAdd">${ico('plus')}Zum Tagebuch</button>
    <button class="btn" id="fdEdit">${ico('edit')}Bearbeiten</button>
    <button class="btn danger" id="fdDel">${ico('trash')}Löschen</button>`, () => {
    $('#fdAdd').onclick = () => { foodState.date = todayStr(); portionSheet(f, defaultMeal()); };
    $('#fdEdit').onclick = () => customFoodSheet(f, null);
    $('#fdDel').onclick = () => {
      if (!confirm(`„${f.name}“ aus deinen Lebensmitteln löschen? Einträge im Tagebuch bleiben erhalten.`)) return;
      removeRec('foods', f.id); save(); closeSheet(); render();
    };
  });
}

/* =========================================================
   SUCHEN & HINZUFÜGEN
   ========================================================= */

const offCache = new Map();   // Suchbegriff → Online-Treffer (für diese Sitzung)

/** Such-Seite: Suchfeld oben, Treffer darunter. Lokale Treffer (eigene, Rezepte,
    eingebaute Liste) erscheinen sofort beim Tippen, Online-Produkte kurz danach.
    meal: Mahlzeit oder RECIPE (Zutat fürs Rezept). opts.query / opts.focus */
function foodSearch(meal, opts = {}) {
  const isRecipe = meal === RECIPE;
  const state = { q: opts.query || '', status: 'idle', online: [], localIds: new Set(), localCount: 0 };
  let local = [];
  let online = [];
  let timer = null;
  let ctl = null;
  let token = 0;
  const stopOnline = () => { clearTimeout(timer); token += 1; if (ctl) { ctl.abort(); ctl = null; } };

  openSheet(`
    <div class="search-top">
      <button class="ibtn ghost" id="fsBack" aria-label="${isRecipe ? 'Zurück zum Rezept' : 'Schließen'}">${ico('chevl')}</button>
      <form class="search-box" id="fsForm" action="#" role="search">
        ${ico('search')}
        <input id="fsQ" type="search" enterkeyhint="search" placeholder="${isRecipe ? 'Zutat suchen …' : `${esc(mealInfo(meal)[1])}: Lebensmittel suchen …`}" value="${esc(state.q)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Lebensmittel suchen">
        <button type="button" class="search-clear" id="fsClear" aria-label="Eingabe löschen" ${state.q ? '' : 'hidden'}>${ico('x')}</button>
      </form>
    </div>
    <div class="search-actions">
      <button class="chip-btn" id="fsScan">${ico('scan')}Scannen</button>
      ${isRecipe ? '' : `<button class="chip-btn" id="fsQuick">${ico('zap')}Schnell-Eintrag</button>`}
      <button class="chip-btn" id="fsOwn">${ico('plus')}Selbst anlegen</button>
    </div>
    <div id="fsResults"><div id="fsLocal"></div><div id="fsOnline"></div></div>
  `, () => {
    const input = $('#fsQ');
    const pick = (f) => portionSheet(f, meal, null, () => foodSearch(meal, { query: state.q }));
    const bind = (box, list, prefix) => $$(`[data-pick^="${prefix}"]`, box).forEach((b) => b.onclick = () => pick(list[Number(b.dataset.pick.slice(1))]));

    const drawLocal = () => {
      const q = state.q.trim();
      local = [];
      const sec = (title, list) => (list.length
        ? `<div class="res-title">${title}</div><div class="panel res-list">${list.map((f) => { local.push(f); return foodRowHtml(f, `data-pick="l${local.length - 1}"`); }).join('')}</div>`
        : '');
      let html;
      if (!q) {
        const recipes = isRecipe ? [] : recipesMatching('');
        const recent = recentFoods(25).filter((f) => !(isRecipe && f.recipeId) && !(f.recipeId && !isRecipe));
        html = sec('Meine Rezepte', recipes) + sec(isRecipe ? 'Zuletzt verwendet' : 'Zuletzt gegessen', recent);
        html += html
          ? '<p class="hint small search-hint">Über das Suchfeld findest du auch alles, was du noch nie eingetragen oder gescannt hast.</p>'
          : '<p class="hint search-hint">Tippe oben z. B. <b>Banane</b>, <b>Skyr</b> oder <b>Haferflocken</b> ein – oder scanne den Strichcode auf der Verpackung.</p>';
      } else {
        const recipes = isRecipe ? [] : recipesMatching(q).slice(0, 6);
        const own = localSearch(q).filter((f) => !f.recipeId).slice(0, 12);
        const seen = new Set(own.map((f) => f.id).filter(Boolean));
        const basic = builtinSearch(q, 14).filter((f) => !seen.has(f.id));
        html = sec('Meine Rezepte', recipes) + sec('Meine Lebensmittel', own) + sec('Grundnahrungsmittel · Richtwerte', basic);
      }
      state.localIds = new Set(local.map((f) => f.id).filter(Boolean));
      state.localCount = local.length;
      const box = $('#fsLocal');
      box.innerHTML = html;
      bind(box, local, 'l');
    };

    const drawOnline = () => {
      const box = $('#fsOnline');
      if (!box) return;
      online = [];
      let html = '';
      const title = '<div class="res-title">Produkte · Open Food Facts</div>';
      if (state.status === 'loading') html = `${title}<div class="res-status"><span class="spinner"></span>Suche online nach Produkten …</div>`;
      else if (state.status === 'offline') html = `${title}<div class="res-status">Keine Internetverbindung – gesucht wird in deinen und den eingebauten Lebensmitteln.</div>`;
      else if (state.status === 'error') html = `${title}<div class="res-status">Online-Suche gerade nicht erreichbar.<button class="btn small" id="fsRetry">${ico('refresh')}Erneut</button></div>`;
      else if (state.status === 'done') {
        const list = state.online.filter((f) => !state.localIds.has(f.id));
        html = title + (list.length
          ? `<div class="panel res-list">${list.map((f) => { online.push(f); return foodRowHtml(f, `data-pick="o${online.length - 1}"`); }).join('')}</div>`
          : `<div class="res-status">Online keine ${state.localCount ? 'weiteren ' : ''}Treffer. Anderen Begriff probieren oder das Lebensmittel selbst anlegen.</div>`);
      }
      box.innerHTML = html;
      bind(box, online, 'o');
      const retry = $('#fsRetry');
      if (retry) retry.onclick = () => searchOnline(true);
    };

    /** Online suchen: beim Tippen mit kurzer Pause, bei „Suchen“ sofort. */
    const searchOnline = (now) => {
      stopOnline();
      const q = state.q.trim();
      const key = foldText(q);
      if (key.length < (now ? 2 : 3)) { state.status = 'idle'; drawOnline(); return; }
      if (offCache.has(key)) { state.online = offCache.get(key); state.status = 'done'; drawOnline(); return; }
      if (navigator.onLine === false) { state.status = 'offline'; drawOnline(); return; }
      state.status = 'loading';
      drawOnline();
      const my = token;
      timer = setTimeout(async () => {
        ctl = new AbortController();
        try {
          const list = await offSearch(q, ctl.signal);
          if (my !== token) return;
          offCache.set(key, list);
          if (offCache.size > 60) offCache.delete(offCache.keys().next().value);
          state.online = list;
          state.status = 'done';
        } catch (e) {
          if (my !== token) return;
          state.status = 'error';
        }
        ctl = null;
        drawOnline();
      }, now ? 0 : 500);
    };

    input.oninput = () => {
      state.q = input.value;
      $('#fsClear').hidden = !state.q;
      drawLocal();
      searchOnline(false);
    };
    $('#fsForm').onsubmit = (e) => { e.preventDefault(); input.blur(); searchOnline(true); };
    $('#fsClear').onclick = () => { input.value = ''; input.oninput(); input.focus(); };
    $('#fsBack').onclick = () => { if (isRecipe) recipeEditor(); else closeSheet(); };
    $('#fsScan').onclick = () => {
      if (isRecipe) { recipeDraft.scanning = true; saveRecipeDraft(); }
      openScanner(meal);
    };
    if ($('#fsQuick')) $('#fsQuick').onclick = () => quickEntry(meal);
    $('#fsOwn').onclick = () => customFoodSheet({ name: state.q.trim() }, meal);
    // Beim Durchblättern der Treffer verschwindet die Tastatur
    $('#fsResults').addEventListener('touchmove', () => { if (document.activeElement === input) input.blur(); }, { passive: true });

    drawLocal();
    searchOnline(true);
    if (opts.focus) {
      input.focus();
      try { input.setSelectionRange(state.q.length, state.q.length); } catch (e) { /* egal */ }
    }
  }, { full: true, cls: 'search-sheet', onClose: stopOnline });
}

function mealChipsHtml(sel) {
  return `<div class="kp-chiprow">${MEALS.map(([k, n]) => `<button data-meal="${k}" class="${k === sel ? 'on' : ''}">${n}</button>`).join('')}</div>`;
}
function bindMealChips(root, tmp) {
  $$('[data-meal]', root).forEach((b) => b.onclick = () => {
    tmp.meal = b.dataset.meal;
    $$('[data-meal]', root).forEach((x) => x.classList.toggle('on', x === b));
  });
}

const offAsked = new Set();   // Strichcodes, deren Portionsgröße schon nachgeschlagen wurde
let portionToken = 0;

/** Menge wählen und eintragen (oder vorhandenen Eintrag ändern).
    back: wohin „Abbrechen“ führt (z. B. zurück zur Suche). */
function portionSheet(food, meal, entry, back) {
  const isRecipe = meal === RECIPE;
  const unit = food.unit || 'g';
  const tmp = { amount: entry ? entry.amount : food.lastAmount || food.serving || 100, meal: entry ? entryMeal(entry) : meal };
  portionToken += 1;
  const my = portionToken;
  const preview = () => {
    const n = calcNutrition(food.per100, tmp.amount);
    return `<b>${fmtNum(n.kcal, 0)} kcal</b> · ${macroLine(n)}`;
  };
  /** Mengen-Knöpfe: Portionen bzw. Stück, dazu übliche Grammzahlen */
  const amountChips = () => {
    const s = food.serving;
    if (food.recipeId && s) {
      return [[0.5, '½ Portion'], [1, '1 Portion'], [1.5, '1½ Portionen'], [2, '2 Portionen']].map(([x, l]) => [Math.round(s * x), `${l} · ${Math.round(s * x)} g`]);
    }
    const chips = [];
    if (s) {
      const label = food.servingLabel || 'Portion';
      const counts = label === 'Portion' ? [1] : [1, 2, 3];
      counts.forEach((n) => chips.push([s * n, `${n} ${servingWord(label, n)} · ${fmtNum(s * n, 0)} ${unit}`]));
    }
    [50, 100, 150, 200, 250].forEach((a) => { if (!chips.some(([x]) => x === a)) chips.push([a, `${a} ${unit}`]); });
    return chips;
  };
  Keypad.open({
    owner: 'food',
    fields: [{ key: 'amount', label: 'Menge', unit, decimals: 0, int: true, step: food.serving && food.serving <= 60 ? food.serving : 10, get: () => tmp.amount, set: (x) => { tmp.amount = x; } }],
    title: () => `<b>${esc(food.name)}</b>${food.brand ? ' · ' + esc(food.brand) : ''}`,
    extraHtml: () => `
      ${isRecipe ? '<div class="kp-note">Zutat für das Rezept</div>' : mealChipsHtml(tmp.meal)}
      <div class="kp-chiprow">${amountChips().map(([a, l]) => `<button data-amt="${a}">${l}</button>`).join('')}</div>
      <div class="kp-preview" id="kpPreview">${preview()}</div>
      ${entry ? `<button class="kp-del" data-del>${ico('trash')}Eintrag entfernen</button>` : ''}`,
    onDraw: (root) => {
      bindMealChips(root, tmp);
      $$('[data-amt]', root).forEach((b) => b.onclick = () => Keypad.set(Number(b.dataset.amt)));
      const del = $('[data-del]', root);
      if (del) del.onclick = () => { removeRec('food', entry.id); save(); Keypad.close(); toast('Entfernt'); render(); };
    },
    onChange: () => { const p = $('#kpPreview'); if (p) p.innerHTML = preview(); },
    okLabel: entry ? 'Speichern' : isRecipe ? 'Zum Rezept' : 'Hinzufügen',
    validate: () => (tmp.amount ? '' : 'Bitte eine Menge eingeben'),
    onCancel: () => { if (back) back(); else if (isRecipe) recipeEditor(); },
    onDone: () => {
      if (isRecipe) { addIngredient(food, tmp.amount); return; }
      const n = calcNutrition(food.per100, tmp.amount);
      const vals = {
        meal: tmp.meal, name: food.name, brand: food.brand || '', foodId: food.id || null,
        amount: tmp.amount, unit, per100: food.per100, serving: food.serving || null, src: food.src || 'own', ...n,
      };
      if (food.servingLabel) vals.servingLabel = food.servingLabel;
      if (entry) { Object.assign(entry, vals); touch(entry); }
      else data.food.push(touch({ id: uid(), date: foodState.date || todayStr(), ...vals }));
      // Gescannte und online gefundene Produkte merken: nächstes Mal sofort da – auch offline und auf allen Geräten.
      if (food.src === 'off' && food.id && !data.foods.some((f) => f.id === food.id)) {
        const { lastAmount, ...clean } = food;
        data.foods.push(touch({ ...clean }));
      }
      save();
      toast(entry ? 'Gespeichert' : `${mealInfo(tmp.meal)[1]}: eingetragen`);
      foodState.tab = 'diary';
      if (nav.tab !== 'food') switchTab('food'); else render();
    },
  });

  // Suchtreffer kommen oft ohne Portionsgröße – sie wird im Hintergrund nachgeschlagen.
  if (!entry && food.src === 'off' && food.barcode && !food.serving && !offAsked.has(food.barcode) && navigator.onLine !== false) {
    offAsked.add(food.barcode);
    offProduct(food.barcode).then((full) => {
      if (!full || !full.serving) return;
      food.serving = full.serving;
      food.servingName = full.servingName;
      if (my === portionToken && Keypad.isOpen() && Keypad.owner() === 'food') Keypad.redrawExtra();
    }).catch(() => { /* ohne Portionsgröße geht es auch */ });
  }
}

/** Schnell-Eintrag: Makros eintragen, Kalorien werden daraus berechnet. */
function quickEntry(meal, entry) {
  const tmp = entry ? { p: entry.p || null, c: entry.c || null, f: entry.f || null, meal: entryMeal(entry) } : { p: null, c: null, f: null, meal };
  // Alte Einträge ohne Makros behalten ihre Kalorien, bis Makros eingetragen werden.
  const kcal = () => (tmp.p || tmp.c || tmp.f ? kcalFromMacros(tmp.p, tmp.c, tmp.f) : (entry && entry.kcal) || 0);
  const preview = () => `= <b>${fmtNum(kcal(), 0)} kcal</b> <span class="hint small">(Eiweiß & KH × 4, Fett × 9)</span>`;
  const mk = (key, label, unit, step) => ({ key, label, unit, decimals: 0, int: true, step, get: () => tmp[key], set: (x) => { tmp[key] = x == null ? null : Math.round(x); } });
  Keypad.open({
    owner: 'food',
    chips: true,
    fields: [mk('p', 'Eiweiß', 'g', 5), mk('c', 'Kohlenh.', 'g', 5), mk('f', 'Fett', 'g', 5)],
    title: () => `<b>${entry ? 'Eintrag ändern' : 'Schnell-Eintrag'}</b>`,
    extraHtml: () => `${mealChipsHtml(tmp.meal)}<div class="kp-preview" id="kpPreview">${preview()}</div>${entry ? `<button class="kp-del" data-del>${ico('trash')}Eintrag entfernen</button>` : ''}`,
    onDraw: (root) => {
      bindMealChips(root, tmp);
      const del = $('[data-del]', root);
      if (del) del.onclick = () => { removeRec('food', entry.id); save(); Keypad.close(); toast('Entfernt'); render(); };
    },
    onChange: () => { const p = $('#kpPreview'); if (p) p.innerHTML = preview(); },
    okLabel: 'Speichern',
    validate: () => (kcal() ? '' : 'Bitte Makros eintragen'),
    onCancel: () => {},
    onDone: () => {
      const vals = { meal: tmp.meal, kcal: kcal(), p: tmp.p || 0, c: tmp.c || 0, f: tmp.f || 0 };
      if (entry) { Object.assign(entry, vals); touch(entry); }
      else data.food.push(touch({ id: uid(), date: foodState.date || todayStr(), name: 'Schnell-Eintrag', src: 'quick', ...vals }));
      save(); toast('Eingetragen');
      foodState.tab = 'diary';
      if (nav.tab !== 'food') switchTab('food'); else render();
    },
  });
}

/** Eigenes Lebensmittel anlegen oder bearbeiten – in zwei ruhigen Schritten:
    erst Name und Marke (Tastatur), dann die Nährwerte von der Verpackung (Zahlenfeld). */
function customFoodSheet(food, meal) {
  const editing = !!(food && food.id && data.foods.some((f) => f.id === food.id));
  const f = {
    name: '', brand: '', unit: 'g', barcode: '', serving: null, ...food,
    per100: { kcal: null, p: null, c: null, f: null, ...((food && food.per100) || {}) },
  };
  if (f.name === 'Unbekanntes Produkt') f.name = '';
  const hasValues = () => f.per100.p != null || f.per100.c != null || f.per100.f != null;
  openSheet(`
    ${sheetHead(editing ? 'Lebensmittel bearbeiten' : 'Eigenes Lebensmittel')}
    ${f.barcode ? `<p class="hint">Strichcode <b>${esc(f.barcode)}</b> – beim nächsten Scan wird es sofort erkannt.</p>` : ''}
    <label class="lbl" for="cfName">Name</label>
    <input class="field" id="cfName" value="${esc(f.name)}" placeholder="z. B. Proteinriegel Cookie" autocomplete="off" autocapitalize="sentences" enterkeyhint="next">
    <label class="lbl" for="cfBrand">Marke (optional)</label>
    <input class="field" id="cfBrand" value="${esc(f.brand)}" placeholder="z. B. Eigenmarke" autocomplete="off" autocapitalize="words" enterkeyhint="done">
    <label class="lbl">Die Nährwerte auf der Verpackung gelten pro</label>
    <div class="seg">
      <button type="button" data-unit="g" class="${f.unit !== 'ml' ? 'on' : ''}">100 g</button>
      <button type="button" data-unit="ml" class="${f.unit === 'ml' ? 'on' : ''}">100 ml</button>
    </div>
    ${hasValues() ? `<div class="panel nut-line">Bisher: <b>${fmtNum(kcalFromMacros(f.per100.p, f.per100.c, f.per100.f), 0)} kcal</b> · ${macroLine(f.per100)}${f.serving ? ` · Portion ${fmtNum(f.serving, 0)} ${f.unit}` : ''}</div>` : ''}
    <button class="btn primary" id="cfNext">Weiter: Nährwerte eintragen</button>
  `, (root) => {
    $$('[data-unit]', root).forEach((b) => b.onclick = () => {
      f.unit = b.dataset.unit;
      $$('[data-unit]', root).forEach((x) => x.classList.toggle('on', x === b));
    });
    const next = () => {
      f.name = $('#cfName').value.trim();
      f.brand = $('#cfBrand').value.trim();
      if (!f.name) { $('#cfName').focus(); toast('Bitte einen Namen eingeben'); return; }
      customFoodValues(f, meal, editing);
    };
    $('#cfNext').onclick = next;
    $('#cfName').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#cfBrand').focus(); } });
    $('#cfBrand').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); next(); } });
    if (!f.name) $('#cfName').focus();
  }, { full: true });
}

/** Schritt 2: Makros pro 100 g/ml (Kalorien werden berechnet) und Portionsgröße. */
function customFoodValues(f, meal, editing) {
  const tmp = { p: f.per100.p, c: f.per100.c, f: f.per100.f, serving: f.serving };
  const kcal = () => kcalFromMacros(tmp.p, tmp.c, tmp.f);
  const preview = () => `= <b>${fmtNum(kcal(), 0)} kcal</b> pro 100 ${f.unit} <span class="hint small">(berechnet)</span>`;
  const mk = (key, label, decimals) => ({ key, label, unit: 'g', decimals, step: 1, get: () => tmp[key], set: (x) => { tmp[key] = x; } });
  Keypad.open({
    owner: 'food',
    chips: true,
    fields: [
      mk('p', 'Eiweiß', 1), mk('c', 'Kohlenh.', 1), mk('f', 'Fett', 1),
      { key: 'serving', label: 'Portion', unit: f.unit, decimals: 0, int: true, step: 10, get: () => tmp.serving, set: (x) => { tmp.serving = x; } },
    ],
    title: () => `<b>${esc(f.name)}</b> · pro 100 ${f.unit}`,
    extraHtml: () => `<div class="kp-preview" id="kpPreview">${preview()}</div><div class="kp-note">„Portion“ ist freiwillig – z. B. 40 für einen Riegel mit 40 ${f.unit}.</div>`,
    onChange: () => { const p = $('#kpPreview'); if (p) p.innerHTML = preview(); },
    okLabel: meal === RECIPE ? 'Speichern & zum Rezept' : meal ? 'Speichern & eintragen' : 'Speichern',
    validate: () => (kcal() ? '' : 'Bitte Eiweiß, Kohlenhydrate oder Fett eintragen'),
    onCancel: () => { Object.assign(f.per100, { p: tmp.p, c: tmp.c, f: tmp.f }); f.serving = tmp.serving; customFoodSheet(f, meal); },
    onDone: () => {
      const rec = editing ? data.foods.find((x) => x.id === f.id) : { id: f.barcode ? 'off-' + f.barcode : uid() };
      Object.assign(rec, {
        name: f.name, brand: f.brand, unit: f.unit, barcode: f.barcode || '',
        per100: { kcal: kcal(), p: round1(tmp.p), c: round1(tmp.c), f: round1(tmp.f) },
        serving: tmp.serving ? Math.round(tmp.serving) : null,
        src: 'own',
      });
      touch(rec);
      if (!editing) {
        data.foods = data.foods.filter((x) => x.id !== rec.id);
        data.foods.push(rec);
      }
      save();
      if (meal) portionSheet(rec, meal);
      else { toast('Gespeichert'); render(); }
    },
  });
}

/** Tagesziele: Makros eintragen – das Kalorienziel wird daraus berechnet. */
function goalsSheet() {
  const st = data.settings;
  const tmp = { p: st.proteinGoal || null, c: st.carbsGoal || null, f: st.fatGoal || null };
  const kcal = () => kcalFromMacros(tmp.p, tmp.c, tmp.f);
  const preview = () => `Kalorienziel = <b>${fmtNum(kcal(), 0)} kcal</b> <span class="hint small">(Eiweiß & KH × 4, Fett × 9)</span>`;
  const mk = (key, label) => ({ key, label, unit: 'g', decimals: 0, int: true, step: 5, get: () => tmp[key], set: (x) => { tmp[key] = x == null ? null : Math.round(x); } });
  Keypad.open({
    owner: current().view,
    chips: true,
    fields: [mk('p', 'Eiweiß'), mk('c', 'Kohlenh.'), mk('f', 'Fett')],
    title: () => '<b>Tagesziele</b>',
    extraHtml: () => `<div class="kp-preview" id="kpPreview">${preview()}</div>`,
    onChange: () => { const p = $('#kpPreview'); if (p) p.innerHTML = preview(); },
    okLabel: 'Speichern',
    validate: () => (kcal() ? '' : 'Bitte Makros eintragen'),
    onCancel: () => {},
    onDone: () => {
      st.proteinGoal = tmp.p || 0;
      st.carbsGoal = tmp.c || 0;
      st.fatGoal = tmp.f || 0;
      st.kcalGoal = kcal();
      touchSettings(); save(); toast('Ziele gespeichert'); render();
    },
  });
}

/* =========================================================
   SCANNEN
   ========================================================= */

function openScanner(meal) {
  const isRecipe = meal === RECIPE && recipeDraft;
  closeSheet();
  Keypad.close();
  $$('.scanner').forEach((x) => x.remove());
  const el = document.createElement('div');
  el.className = 'scanner';
  el.innerHTML = `
    <video playsinline muted autoplay></video>
    <div class="scan-frame"><i></i></div>
    <div class="scan-top"><b>${isRecipe ? `Zutat ${recipeDraft.items.length + 1} scannen` : `${esc(mealInfo(meal)[1])}: Strichcode scannen`}</b>
      ${isRecipe && recipeDraft.items.length ? `<span class="scan-count">${recipeDraft.items.length} Zutat${recipeDraft.items.length === 1 ? '' : 'en'} · ${fmtNum(recipeTotals(recipeDraft).sum.kcal, 0)} kcal</span><br>` : ''}
      <span id="scanStatus">Kamera wird gestartet …</span></div>
    <div class="scan-bottom">
      <button class="btn small" id="scanType">${ico('keyboard')}Eintippen</button>
      <button class="btn small" id="scanPhoto">${ico('image')}Foto</button>
      ${isRecipe ? `<button class="btn small green scan-done" id="scanClose">${ico('check')}Fertig</button>` : `<button class="btn small primary" id="scanClose" aria-label="Schließen">${ico('x')}</button>`}
    </div>
    <input type="file" accept="image/*" capture="environment" id="scanFile" hidden>`;
  document.body.appendChild(el);
  const status = (t) => { const s = $('#scanStatus', el); if (s) s.textContent = t; };
  const close = () => { Scanner.stop(); el.remove(); };
  const found = (code) => { close(); lookupBarcode(code, meal); };

  // Beim Rezept-Scan: dieselbe Packung nicht gleich nochmal erkennen, wenn sie noch vor der Kamera ist.
  const lastCode = isRecipe ? recipeDraft.lastCode : null;
  const ignoreUntil = Date.now() + 4000;
  const accept = (code) => !(code === lastCode && Date.now() < ignoreUntil);
  Scanner.start($('video', el), found, status, accept).catch((err) => {
    el.classList.add('error');
    status(err && err.name === 'NotAllowedError'
      ? 'Kein Kamerazugriff. Erlaube die Kamera (Einstellungen → Safari → Kamera) oder nutze „Foto“ bzw. „Eintippen“.'
      : (err && err.message) || 'Kamera nicht verfügbar – nutze „Foto“ oder „Eintippen“.');
  });
  $('#scanClose', el).onclick = () => { close(); if (isRecipe) recipeEditor(); };
  $('#scanType', el).onclick = () => { close(); manualBarcodeSheet(meal); };
  $('#scanPhoto', el).onclick = () => $('#scanFile', el).click();
  $('#scanFile', el).onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    status('Foto wird gelesen …');
    try {
      const code = await Scanner.fromFile(file);
      if (code) found(code);
      else status('Kein Strichcode erkannt – näher ran und scharf fotografieren.');
    } catch (err) { status('Foto konnte nicht gelesen werden.'); }
  };
}

function manualBarcodeSheet(meal) {
  openSheet(`
    ${sheetHead('Strichcode eintippen', 'keyboard')}
    <p class="hint">Die Ziffern stehen unter den Strichen (meist 13 Stellen).</p>
    <form id="mbForm">
      <input class="field" id="mbCode" inputmode="numeric" pattern="[0-9]*" placeholder="z. B. 4000417025005" autocomplete="off" enterkeyhint="search" style="font-size:22px;letter-spacing:2px">
      <div class="gap"></div>
      <button class="btn primary" type="submit">${ico('search')}Suchen</button>
    </form>
    <p class="hint center" id="mbMsg" style="margin-top:10px"></p>`, () => {
    $('#mbForm').onsubmit = (e) => {
      e.preventDefault();
      const code = $('#mbCode').value.replace(/\D/g, '');
      if (!Scanner.validCode(code)) { $('#mbMsg').textContent = 'Das ist kein gültiger Strichcode – bitte prüfen.'; return; }
      closeSheet();
      lookupBarcode(code, meal);
    };
    $('#mbCode').focus();
  }, { full: true });
}

async function lookupBarcode(code, meal) {
  if (meal === RECIPE && recipeDraft) { recipeDraft.lastCode = code; saveRecipeDraft(); }
  const local = data.foods.find((f) => f.barcode === code);
  if (local) { portionSheet(local, meal); return; }
  toast('Suche Produkt …');
  try {
    const food = await offProduct(code);
    if (food && food.per100.kcal != null) portionSheet(food, meal);
    else notFoundSheet(code, meal, food, false);
  } catch (e) {
    notFoundSheet(code, meal, null, true);
  }
}

function notFoundSheet(code, meal, partial, offline) {
  openSheet(`
    ${sheetHead(offline ? 'Keine Verbindung' : 'Unbekanntes Produkt', 'info')}
    <p>${offline ? 'Ohne Internet kann das Produkt nicht nachgeschlagen werden.'
      : partial ? `„${esc(partial.name)}“ ist bekannt, aber ohne Nährwerte.` : 'Dieses Produkt ist noch nicht in der Datenbank.'}
      <br><span class="hint">Strichcode: <b>${esc(code)}</b></span></p>
    <p class="hint">Leg es einmal selbst an – die Nährwerte stehen auf der Verpackung. Beim nächsten Scan wird es sofort erkannt.</p>
    <button class="btn primary" id="nfCreate">${ico('plus')}Selbst anlegen</button>
    <button class="btn" id="nfRetry">${ico('scan')}Nochmal scannen</button>
    <button class="btn" id="nfSearch">${ico('search')}Stattdessen suchen</button>
    ${meal === RECIPE ? `<button class="btn quiet" id="nfBack">${ico('chevl')}Zurück zum Rezept</button>` : ''}`, () => {
    $('#nfCreate').onclick = () => customFoodSheet({ ...(partial || {}), id: undefined, barcode: code }, meal);
    $('#nfRetry').onclick = () => openScanner(meal);
    $('#nfSearch').onclick = () => foodSearch(meal, { focus: true, query: partial && partial.name !== 'Unbekanntes Produkt' ? partial.name : '' });
    if ($('#nfBack')) $('#nfBack').onclick = recipeEditor;
  });
}
