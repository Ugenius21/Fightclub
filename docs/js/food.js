'use strict';

/* =========================================================
   ERNÄHRUNG – Kalorien-Tagebuch (wie MyFitnessPal)

   - Tagebuch mit Frühstück, Mittagessen, Abendessen, Snacks
   - Strichcode scannen → Nährwerte aus Open Food Facts
   - Suche (eigene/zuletzt gegessene Lebensmittel + Open Food Facts)
   - Eigene Lebensmittel anlegen, Schnell-Einträge, Tagesziele

   Diese Datei wird vor app.js geladen und nutzt deren Hilfsfunktionen
   ($, data, save, Keypad, …) erst zur Laufzeit.
   ========================================================= */

const MEALS = [
  ['breakfast', 'Frühstück', '🍳'],
  ['lunch', 'Mittagessen', '🍝'],
  ['dinner', 'Abendessen', '🍲'],
  ['snack', 'Snacks', '🍫'],
];
const mealInfo = (m) => MEALS.find((x) => x[0] === m) || MEALS[3];
const foodState = { date: null, tab: 'diary', foodQuery: '' };
const round1 = (x) => Math.round((Number(x) || 0) * 10) / 10;

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

/* ---------------- Open Food Facts ---------------- */

const OFF_FIELDS = 'code,product_name,product_name_de,generic_name_de,brands,quantity,serving_size,serving_quantity,nutriments';

async function offFetch(url, ms = 12000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok && r.status !== 404) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

function offToFood(p, code) {
  if (!p) return null;
  const n = p.nutriments || {};
  const num = (v) => (v === undefined || v === null || v === '' || !isFinite(Number(v)) ? null : Number(v));
  let kcal = num(n['energy-kcal_100g']);
  if (kcal == null && num(n.energy_100g) != null) kcal = num(n.energy_100g) / 4.184; // kJ → kcal
  const barcode = String(code || p.code || '');
  const quantity = String(p.quantity || '').toLowerCase();
  const serving = num(p.serving_quantity);
  return {
    id: 'off-' + barcode,
    barcode,
    name: (p.product_name_de || p.product_name || p.generic_name_de || '').trim() || 'Unbekanntes Produkt',
    brand: String(p.brands || '').split(',')[0].trim(),
    unit: /\d\s*(ml|cl|l)\b/.test(quantity) ? 'ml' : 'g',
    per100: { kcal: kcal == null ? null : Math.round(kcal), p: round1(num(n.proteins_100g)), c: round1(num(n.carbohydrates_100g)), f: round1(num(n.fat_100g)) },
    serving: serving && serving > 0 && serving < 2000 ? Math.round(serving) : null,
    servingName: p.serving_size || '',
    src: 'off',
  };
}

async function offProduct(code) {
  const j = await offFetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`);
  if (!j || j.status !== 1 || !j.product) return null;
  return offToFood(j.product, code);
}

async function offSearch(q) {
  const j = await offFetch(`https://de.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&fields=${OFF_FIELDS}`);
  return ((j && j.products) || []).map((p) => offToFood(p)).filter((f) => f && f.per100.kcal != null && f.name !== 'Unbekanntes Produkt');
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
    const own = e.foodId && data.foods.find((f) => f.id === e.foodId);
    out.push(own || { id: e.foodId || null, name: e.name, brand: e.brand || '', unit: e.unit || 'g', per100: e.per100, serving: e.serving || null, src: e.src || 'own', lastAmount: e.amount });
    if (out.length >= limit) break;
  }
  return out;
}

function localSearch(q) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  const match = (f) => words.every((w) => norm(f.name + ' ' + (f.brand || '')).includes(w));
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
  return `<button class="food-row" ${attr}>
    <div class="grow"><div class="t">${esc(f.name)}</div>
    <div class="s">${f.brand ? esc(f.brand) + ' · ' : ''}${fmtNum(f.per100.kcal, 0)} kcal / 100 ${f.unit || 'g'}${f.serving ? ` · Portion ${fmtNum(f.serving, 0)} ${f.unit || 'g'}` : ''}</div></div>
    <span class="plus">＋</span></button>`;
}

/* =========================================================
   ANSICHT
   ========================================================= */

function viewNutrition() {
  if (!foodState.date) foodState.date = todayStr();
  setHeader('Ernährung', `<button class="top-chip" id="scanTop" aria-label="Strichcode scannen">📷</button>`);
  const v = $('#view');
  const tabs = [['diary', '📖 Tagebuch'], ['stats', '📊 Statistik'], ['foods', '🥫 Produkte']];
  v.innerHTML = `<div class="seg">${tabs.map(([k, l]) => `<button data-ftab="${k}" class="${foodState.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="foodView"></div>`;
  $$('[data-ftab]', v).forEach((b) => b.onclick = () => { foodState.tab = b.dataset.ftab; render(); });
  $('#scanTop').onclick = () => openScanner(defaultMeal());
  const target = $('#foodView');
  if (foodState.tab === 'stats') viewFoodStats(target);
  else if (foodState.tab === 'foods') viewFoodList(target);
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

  const meals = MEALS.map(([key, name, emoji]) => {
    const list = entries.filter((e) => entryMeal(e) === key);
    const sum = sumNutrition(list);
    const yList = yesterday.filter((e) => entryMeal(e) === key);
    return `<section class="panel meal">
      <div class="meal-head"><span class="emoji">${emoji}</span><h3>${name}</h3><b>${fmtNum(sum.kcal, 0)}<small> kcal</small></b></div>
      ${list.map((e) => `<button class="food-row" data-entry="${e.id}">
        <div class="grow"><div class="t">${esc(entryName(e))}</div>
        <div class="s">${e.brand ? esc(e.brand) + ' · ' : ''}${e.amount ? `${fmtNum(e.amount, 0)} ${e.unit || 'g'} · ` : ''}${macroLine(e)}</div></div>
        <b>${fmtNum(e.kcal, 0)}</b></button>`).join('')}
      ${!list.length && yList.length ? `<button class="copy-link" data-copy="${key}">↺ Wie gestern übernehmen (${fmtNum(sumNutrition(yList).kcal, 0)} kcal)</button>` : ''}
      <div class="meal-actions">
        <button class="btn small" data-add="${key}">＋ Hinzufügen</button>
        <button class="ibtn scan" data-scan="${key}" aria-label="${name}: Strichcode scannen">📷</button>
      </div>
    </section>`;
  }).join('');

  v.innerHTML = `
    <div class="day-nav">
      <button class="ibtn" id="dPrev" aria-label="Vorheriger Tag">‹</button>
      <label class="day-label">${label}<input type="date" id="dPick" value="${d}" aria-label="Datum wählen"></label>
      <button class="ibtn" id="dNext" aria-label="Nächster Tag">›</button>
    </div>
    <button class="panel summary" id="goalBtn">
      <div class="row"><div class="grow"><div class="hint">Kalorien übrig</div>
        <div class="big-left ${left < 0 ? 'over' : ''}">${fmtNum(left, 0)}</div></div>
        <span class="hint small">Ziele ✎</span></div>
      <div class="equation">
        <span><b>${fmtNum(goal, 0)}</b>Ziel</span><span class="op">−</span>
        <span><b>${fmtNum(t.kcal, 0)}</b>Essen</span><span class="op">=</span>
        <span><b>${fmtNum(left, 0)}</b>Übrig</span>
      </div>
      <div class="hp"><i class="${goal && t.kcal > goal ? 'over' : ''}" style="width:${bar(t.kcal, goal)}%"></i></div>
      <div class="macro-bars">
        ${macro('Eiweiß', t.p, st.proteinGoal, 'var(--blue)')}
        ${macro('Kohlenh.', t.c, st.carbsGoal, 'var(--yellow)')}
        ${macro('Fett', t.f, st.fatGoal, '#fb8c00')}
      </div>
    </button>
    ${meals}
    <button class="btn dashed" id="quickAdd">⚡ Schnell-Eintrag (nur Kalorien)</button>`;

  $('#dPrev').onclick = () => { foodState.date = addDays(d, -1); render(); };
  $('#dNext').onclick = () => { foodState.date = addDays(d, 1); render(); };
  $('#dPick').onchange = (e) => { if (e.target.value) { foodState.date = e.target.value; render(); } };
  $('#goalBtn').onclick = goalsSheet;
  $('#quickAdd').onclick = () => quickEntry(defaultMeal());
  $$('[data-add]', v).forEach((b) => b.onclick = () => addFoodSheet(b.dataset.add));
  $$('[data-scan]', v).forEach((b) => b.onclick = () => openScanner(b.dataset.scan));
  $$('[data-entry]', v).forEach((b) => b.onclick = () => {
    const e = data.food.find((x) => x.id === b.dataset.entry);
    if (e.per100 && e.per100.kcal != null && e.amount) portionSheet(foodFromEntry(e), entryMeal(e), e);
    else quickEntry(entryMeal(e), e);
  });
  $$('[data-copy]', v).forEach((b) => b.onclick = () => {
    const meal = b.dataset.copy;
    yesterday.filter((e) => entryMeal(e) === meal).forEach((e) => {
      const { id, upd, ...rest } = e;
      data.food.push(touch({ ...rest, id: uid(), date: d, meal }));
    });
    save(); toast('Übernommen ✓'); render();
  });
}

function foodFromEntry(e) {
  return (e.foodId && data.foods.find((f) => f.id === e.foodId)) ||
    { id: e.foodId || null, name: e.name, brand: e.brand || '', unit: e.unit || 'g', per100: e.per100, serving: e.serving || null, src: e.src || 'own' };
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
      <div class="split"><i style="width:${pct(aP * 4)}%;background:var(--blue)"></i><i style="width:${pct(aC * 4)}%;background:var(--yellow)"></i><i style="width:${pct(aF * 9)}%;background:#fb8c00"></i></div>
      <div class="legend small"><span><i class="dot" style="background:var(--blue)"></i>Eiweiß ${pct(aP * 4)} %</span><span><i class="dot" style="background:var(--yellow)"></i>Kohlenh. ${pct(aC * 4)} %</span><span><i class="dot" style="background:#fb8c00"></i>Fett ${pct(aF * 9)} %</span></div>
    </div>` : ''}
    ${list.length ? `<span class="label">Tage</span>
      ${list.map((d) => `<button class="row-item" data-day="${d}"><div class="grow"><div class="t">${fmtDateLong(d)}</div><div class="s">${macroLine(days[d])}</div></div><b style="font:400 22px var(--display)">${fmtNum(days[d].kcal, 0)}</b><span class="chev">›</span></button>`).join('')}` : ''}`;

  barChart($('#fChart'), bars, st.kcalGoal, 'kcal');
  $$('[data-day]', v).forEach((b) => b.onclick = () => { foodState.date = b.dataset.day; foodState.tab = 'diary'; render(); });
}

function viewFoodList(v) {
  const q = foodState.foodQuery;
  const foods = [...data.foods]
    .filter((f) => !q || norm(f.name + ' ' + (f.brand || '')).includes(norm(q)))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  v.innerHTML = `
    <input class="field" id="flQ" type="search" placeholder="Meine Lebensmittel durchsuchen …" value="${esc(q)}" autocomplete="off">
    <div style="height:12px"></div>
    <button class="btn yellow" id="flNew">＋ Eigenes Lebensmittel anlegen</button>
    <div style="height:16px"></div>
    <div class="panel" id="flList">${foods.length ? foods.map((f) => foodRowHtml(f, `data-fid="${f.id}"`)).join('')
      : `<p class="hint" style="margin:0">${q ? 'Nichts gefunden.' : 'Hier landen deine eigenen und gescannten Lebensmittel. Beim nächsten Mal findest du sie sofort – auch offline.'}</p>`}</div>`;
  const input = $('#flQ');
  input.oninput = () => {
    foodState.foodQuery = input.value;
    const pos = input.selectionStart;
    render();
    const again = $('#flQ');
    again.focus();
    try { again.setSelectionRange(pos, pos); } catch (e) { /* egal */ }
  };
  $('#flNew').onclick = () => customFoodSheet({}, null);
  $$('[data-fid]', v).forEach((b) => b.onclick = () => {
    const f = data.foods.find((x) => x.id === b.dataset.fid);
    openSheet(`<h2>${esc(f.name)}</h2>
      <p class="hint">${f.brand ? esc(f.brand) + ' · ' : ''}${f.barcode ? 'Strichcode ' + esc(f.barcode) : 'ohne Strichcode'}</p>
      <div class="panel small">Pro 100 ${f.unit || 'g'}: <b>${fmtNum(f.per100.kcal, 0)} kcal</b> · ${macroLine(f.per100)}${f.serving ? `<br>Portion: ${fmtNum(f.serving, 0)} ${f.unit || 'g'}` : ''}</div>
      <button class="btn primary" id="fdAdd">＋ Zum Tagebuch</button>
      <button class="btn" id="fdEdit">✎ Bearbeiten</button>
      <button class="btn danger" id="fdDel">Löschen</button>`, () => {
      $('#fdAdd').onclick = () => { foodState.date = todayStr(); portionSheet(f, defaultMeal()); };
      $('#fdEdit').onclick = () => customFoodSheet(f, null);
      $('#fdDel').onclick = () => {
        if (!confirm(`„${f.name}“ aus deinen Lebensmitteln löschen? Einträge im Tagebuch bleiben erhalten.`)) return;
        removeRec('foods', f.id); save(); closeSheet(); render();
      };
    });
  });
}

/* =========================================================
   HINZUFÜGEN
   ========================================================= */

function addFoodSheet(meal) {
  const [, name, emoji] = mealInfo(meal);
  let results = [];
  openSheet(`
    <h2>${emoji} ${name}</h2>
    <div class="btn-row">
      <button class="btn yellow" id="afScan">📷 Scannen</button>
      <button class="btn" id="afQuick">⚡ Schnell</button>
    </div>
    <form id="afForm" class="row" style="margin-top:16px">
      <input class="field grow" id="afQ" type="search" placeholder="Lebensmittel suchen …" autocomplete="off" enterkeyhint="search">
      <button class="btn primary" type="submit" style="width:auto;padding:12px 16px 9px" aria-label="Suchen">🔍</button>
    </form>
    <div id="afResults"></div>
    <button class="btn dashed" id="afOwn" style="margin-top:14px">＋ Eigenes Lebensmittel anlegen</button>
  `, (root) => {
    const box = $('#afResults', root);
    const draw = (sections) => {
      results = [];
      box.innerHTML = sections.map(([title, list, extra]) => {
        const rows = list.map((f) => { results.push(f); return foodRowHtml(f, `data-pick="${results.length - 1}"`); }).join('');
        return rows || extra ? `<div class="hint res-title">${title}</div>${rows}${extra || ''}` : '';
      }).join('');
      $$('[data-pick]', box).forEach((b) => b.onclick = () => portionSheet(results[Number(b.dataset.pick)], meal));
    };
    const showLocal = () => {
      const q = $('#afQ').value.trim();
      if (!q) {
        const recent = recentFoods();
        draw([['Zuletzt gegessen', recent, recent.length ? '' : '<p class="hint">Noch nichts eingetragen. Scanne einen Strichcode oder suche nach einem Lebensmittel.</p>']]);
      } else {
        const local = localSearch(q);
        draw([['Meine & zuletzt gegessen', local, local.length ? '' : '<p class="hint">Nichts Eigenes gefunden – tippe auf 🔍 für die Online-Suche.</p>']]);
      }
    };
    showLocal();
    $('#afQ').oninput = showLocal;
    $('#afForm').onsubmit = async (e) => {
      e.preventDefault();
      const q = $('#afQ').value.trim();
      if (!q) return;
      $('#afQ').blur();
      const local = localSearch(q);
      draw([['Meine & zuletzt gegessen', local], ['Open Food Facts', [], '<p class="hint">Suche online …</p>']]);
      try {
        const online = await offSearch(q);
        if ($('#afQ') && $('#afQ').value.trim() === q) {
          draw([['Meine & zuletzt gegessen', local], ['Open Food Facts', online, online.length ? '' : '<p class="hint">Nichts gefunden. Probier einen anderen Begriff oder leg das Lebensmittel selbst an.</p>']]);
        }
      } catch (err) {
        draw([['Meine & zuletzt gegessen', local], ['Open Food Facts', [], '<p class="hint">Online-Suche gerade nicht möglich (keine Verbindung?).</p>']]);
      }
    };
    $('#afScan').onclick = () => openScanner(meal);
    $('#afQuick').onclick = () => quickEntry(meal);
    $('#afOwn').onclick = () => customFoodSheet({}, meal);
  });
}

function mealChipsHtml(sel) {
  return `<div class="kp-chiprow">${MEALS.map(([k, n, e]) => `<button data-meal="${k}" class="${k === sel ? 'on' : ''}">${e} ${n}</button>`).join('')}</div>`;
}
function bindMealChips(root, tmp) {
  $$('[data-meal]', root).forEach((b) => b.onclick = () => {
    tmp.meal = b.dataset.meal;
    $$('[data-meal]', root).forEach((x) => x.classList.toggle('on', x === b));
  });
}

/** Menge wählen und eintragen (oder vorhandenen Eintrag ändern). */
function portionSheet(food, meal, entry) {
  const unit = food.unit || 'g';
  const tmp = { amount: entry ? entry.amount : food.lastAmount || food.serving || 100, meal: entry ? entryMeal(entry) : meal };
  const preview = () => {
    const n = calcNutrition(food.per100, tmp.amount);
    return `<b>${fmtNum(n.kcal, 0)} kcal</b> · ${macroLine(n)}`;
  };
  const amounts = [...new Set([food.serving, 50, 100, 150, 200, 250].filter(Boolean))];
  Keypad.open({
    owner: 'food',
    fields: [{ key: 'amount', label: 'Menge', unit, decimals: 0, int: true, step: food.serving && food.serving <= 60 ? food.serving : 10, get: () => tmp.amount, set: (x) => { tmp.amount = x; } }],
    title: () => `<b>${esc(food.name)}</b>${food.brand ? ' · ' + esc(food.brand) : ''}`,
    extraHtml: () => `
      ${mealChipsHtml(tmp.meal)}
      <div class="kp-chiprow">${amounts.map((a) => `<button data-amt="${a}">${a === food.serving ? `1 Portion · ${a} ${unit}` : `${a} ${unit}`}</button>`).join('')}</div>
      <div class="kp-preview" id="kpPreview">${preview()}</div>
      ${entry ? '<button class="kp-del" data-del>🗑 Eintrag entfernen</button>' : ''}`,
    onDraw: (root) => {
      bindMealChips(root, tmp);
      $$('[data-amt]', root).forEach((b) => b.onclick = () => Keypad.set(Number(b.dataset.amt)));
      const del = $('[data-del]', root);
      if (del) del.onclick = () => { removeRec('food', entry.id); save(); Keypad.close(); toast('Entfernt'); render(); };
    },
    onChange: () => { const p = $('#kpPreview'); if (p) p.innerHTML = preview(); },
    okLabel: entry ? 'Speichern' : 'Hinzufügen',
    onCancel: () => {},
    onDone: () => {
      if (!tmp.amount) { toast('Bitte eine Menge eingeben'); return; }
      const n = calcNutrition(food.per100, tmp.amount);
      const vals = {
        meal: tmp.meal, name: food.name, brand: food.brand || '', foodId: food.id || null,
        amount: tmp.amount, unit, per100: food.per100, serving: food.serving || null, src: food.src || 'own', ...n,
      };
      if (entry) { Object.assign(entry, vals); touch(entry); }
      else data.food.push(touch({ id: uid(), date: foodState.date || todayStr(), ...vals }));
      // Gescannte Produkte merken: nächstes Mal sofort da – auch offline und auf allen Geräten.
      if (food.src === 'off' && food.id && !data.foods.some((f) => f.id === food.id)) {
        const { lastAmount, ...clean } = food;
        data.foods.push(touch({ ...clean }));
      }
      save();
      toast(entry ? 'Gespeichert ✓' : `${mealInfo(tmp.meal)[2]} Eingetragen!`);
      foodState.tab = 'diary';
      if (nav.tab !== 'food') switchTab('food'); else render();
    },
  });
}

/** Schnell-Eintrag: nur Kalorien (und optional Makros). */
function quickEntry(meal, entry) {
  const tmp = entry ? { kcal: entry.kcal, p: entry.p, c: entry.c, f: entry.f, meal: entryMeal(entry) } : { kcal: null, p: null, c: null, f: null, meal };
  const mk = (key, label, unit, step) => ({ key, label, unit, decimals: 0, int: true, step, get: () => tmp[key], set: (x) => { tmp[key] = x == null ? null : Math.round(x); } });
  Keypad.open({
    owner: 'food',
    chips: true,
    fields: [mk('kcal', 'Kalorien', 'kcal', 50), mk('p', 'Eiweiß', 'g', 5), mk('c', 'Kohlenh.', 'g', 5), mk('f', 'Fett', 'g', 5)],
    title: () => `<b>⚡ ${entry ? 'Eintrag ändern' : 'Schnell-Eintrag'}</b>`,
    extraHtml: () => `${mealChipsHtml(tmp.meal)}${entry ? '<button class="kp-del" data-del>🗑 Eintrag entfernen</button>' : ''}`,
    onDraw: (root) => {
      bindMealChips(root, tmp);
      const del = $('[data-del]', root);
      if (del) del.onclick = () => { removeRec('food', entry.id); save(); Keypad.close(); toast('Entfernt'); render(); };
    },
    okLabel: 'Speichern',
    onCancel: () => {},
    onDone: () => {
      if (!tmp.kcal && !tmp.p && !tmp.c && !tmp.f) return;
      const vals = { meal: tmp.meal, kcal: tmp.kcal || 0, p: tmp.p || 0, c: tmp.c || 0, f: tmp.f || 0 };
      if (entry) { Object.assign(entry, vals); touch(entry); }
      else data.food.push(touch({ id: uid(), date: foodState.date || todayStr(), name: 'Schnell-Eintrag', src: 'quick', ...vals }));
      save(); toast('Eingetragen ⚡');
      foodState.tab = 'diary';
      if (nav.tab !== 'food') switchTab('food'); else render();
    },
  });
}

/** Eigenes Lebensmittel anlegen oder bearbeiten (Nährwerte von der Verpackung). */
function customFoodSheet(food, meal) {
  const editing = !!(food && food.id && data.foods.some((f) => f.id === food.id));
  const f = {
    name: '', brand: '', unit: 'g', barcode: '', serving: null, ...food,
    per100: { kcal: null, p: null, c: null, f: null, ...((food && food.per100) || {}) },
  };
  const val = (x) => (x == null ? '' : String(x).replace('.', ','));
  const parse = (s) => { const n = parseFloat(String(s || '').replace(',', '.')); return isFinite(n) ? n : null; };
  openSheet(`
    <h2>${editing ? 'Lebensmittel bearbeiten' : 'Eigenes Lebensmittel'}</h2>
    ${f.barcode ? `<p class="hint">Strichcode: <b>${esc(f.barcode)}</b> – beim nächsten Scan wird es sofort erkannt.</p>` : ''}
    <label class="lbl">Name *</label>
    <input class="field" id="cfName" value="${esc(f.name === 'Unbekanntes Produkt' ? '' : f.name)}" placeholder="z. B. Haferflocken" autocomplete="off">
    <label class="lbl">Marke</label>
    <input class="field" id="cfBrand" value="${esc(f.brand)}" placeholder="optional" autocomplete="off">
    <label class="lbl">Nährwerte pro 100 (siehe Verpackung)</label>
    <div class="seg" style="margin-bottom:10px">
      <button type="button" data-unit="g" class="${f.unit !== 'ml' ? 'on' : ''}">pro 100 g</button>
      <button type="button" data-unit="ml" class="${f.unit === 'ml' ? 'on' : ''}">pro 100 ml</button>
    </div>
    <div class="nut-grid">
      <label>Kalorien (kcal) *<input class="field" id="cfKcal" inputmode="decimal" value="${val(f.per100.kcal)}"></label>
      <label>Eiweiß (g)<input class="field" id="cfP" inputmode="decimal" value="${val(f.per100.p)}"></label>
      <label>Kohlenhydrate (g)<input class="field" id="cfC" inputmode="decimal" value="${val(f.per100.c)}"></label>
      <label>Fett (g)<input class="field" id="cfF" inputmode="decimal" value="${val(f.per100.f)}"></label>
    </div>
    <label class="lbl">Portionsgröße (optional)</label>
    <input class="field" id="cfServ" inputmode="decimal" value="${val(f.serving)}" placeholder="z. B. 40 – für den Knopf „1 Portion“">
    <p class="hint small">Tipp: Steht auf der Verpackung nur kJ, teile den Wert durch 4,184.</p>
    <button class="btn primary" id="cfSave">${meal ? 'Speichern & eintragen' : 'Speichern'}</button>
  `, (root) => {
    $$('[data-unit]', root).forEach((b) => b.onclick = () => {
      f.unit = b.dataset.unit;
      $$('[data-unit]', root).forEach((x) => x.classList.toggle('on', x === b));
    });
    $('#cfSave').onclick = () => {
      const name = $('#cfName').value.trim();
      const kcal = parse($('#cfKcal').value);
      if (!name) { $('#cfName').focus(); return; }
      if (kcal == null) { $('#cfKcal').focus(); return; }
      const rec = editing ? data.foods.find((x) => x.id === food.id) : { id: f.barcode ? 'off-' + f.barcode : uid() };
      Object.assign(rec, {
        name, brand: $('#cfBrand').value.trim(), unit: f.unit, barcode: f.barcode || '',
        per100: { kcal: Math.round(kcal), p: round1(parse($('#cfP').value)), c: round1(parse($('#cfC').value)), f: round1(parse($('#cfF').value)) },
        serving: parse($('#cfServ').value) ? Math.round(parse($('#cfServ').value)) : null,
        src: 'own',
      });
      touch(rec);
      if (!editing) {
        data.foods = data.foods.filter((x) => x.id !== rec.id);
        data.foods.push(rec);
      }
      save();
      closeSheet();
      if (meal) portionSheet(rec, meal);
      else { toast('Gespeichert ✓'); render(); }
    };
    if (!f.name || f.name === 'Unbekanntes Produkt') setTimeout(() => $('#cfName') && $('#cfName').focus(), 80);
  });
}

function goalsSheet() {
  const st = data.settings;
  const parse = (s) => { const n = parseFloat(String(s || '').replace(',', '.')); return isFinite(n) && n > 0 ? Math.round(n) : null; };
  openSheet(`
    <h2>🎯 Tagesziele</h2>
    <div class="nut-grid">
      <label>Kalorien (kcal)<input class="field" id="gK" inputmode="numeric" value="${st.kcalGoal || ''}"></label>
      <label>Eiweiß (g)<input class="field" id="gP" inputmode="numeric" value="${st.proteinGoal || ''}"></label>
      <label>Kohlenhydrate (g)<input class="field" id="gC" inputmode="numeric" value="${st.carbsGoal || ''}"></label>
      <label>Fett (g)<input class="field" id="gF" inputmode="numeric" value="${st.fatGoal || ''}"></label>
    </div>
    <button class="btn" id="gAuto" style="margin-top:16px">Makros aus Kalorien berechnen<br><span class="small" style="font-family:var(--body)">30 % Eiweiß · 45 % Kohlenhydrate · 25 % Fett</span></button>
    <button class="btn primary" id="gSave">Speichern</button>
  `, () => {
    $('#gAuto').onclick = () => {
      const k = parse($('#gK').value);
      if (!k) { $('#gK').focus(); return; }
      $('#gP').value = Math.round((k * 0.3) / 4);
      $('#gC').value = Math.round((k * 0.45) / 4);
      $('#gF').value = Math.round((k * 0.25) / 9);
    };
    $('#gSave').onclick = () => {
      st.kcalGoal = parse($('#gK').value) || st.kcalGoal;
      st.proteinGoal = parse($('#gP').value);
      st.carbsGoal = parse($('#gC').value);
      st.fatGoal = parse($('#gF').value);
      touchSettings(); save(); closeSheet(); render();
    };
  });
}

/* =========================================================
   SCANNEN
   ========================================================= */

function blip() {
  if (!audioCtx || !data.settings.sound) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'square'; o.frequency.value = 1320;
  g.gain.setValueAtTime(0.12, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);
  o.connect(g).connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + 0.13);
}

function openScanner(meal) {
  unlockAudio();
  closeSheet();
  Keypad.close();
  $$('.scanner').forEach((x) => x.remove());
  const el = document.createElement('div');
  el.className = 'scanner';
  el.innerHTML = `
    <video playsinline muted autoplay></video>
    <div class="scan-frame"><i></i></div>
    <div class="scan-top"><b>📷 ${esc(mealInfo(meal)[1])}: Strichcode scannen</b><span id="scanStatus">Kamera wird gestartet …</span></div>
    <div class="scan-bottom">
      <button class="btn small" id="scanType">⌨ Eintippen</button>
      <button class="btn small" id="scanPhoto">🖼 Foto</button>
      <button class="btn small primary" id="scanClose">✕</button>
    </div>
    <input type="file" accept="image/*" capture="environment" id="scanFile" hidden>`;
  document.body.appendChild(el);
  const status = (t) => { const s = $('#scanStatus', el); if (s) s.textContent = t; };
  const close = () => { Scanner.stop(); el.remove(); };
  const found = (code) => { close(); blip(); lookupBarcode(code, meal); };

  Scanner.start($('video', el), found, status).catch((err) => {
    el.classList.add('error');
    status(err && err.name === 'NotAllowedError'
      ? 'Kein Kamerazugriff. Erlaube die Kamera (Einstellungen → Safari → Kamera) oder nutze „Foto“ bzw. „Eintippen“.'
      : (err && err.message) || 'Kamera nicht verfügbar – nutze „Foto“ oder „Eintippen“.');
  });
  $('#scanClose', el).onclick = close;
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
    <h2>⌨ Strichcode eintippen</h2>
    <p class="hint">Die Ziffern stehen unter den Strichen (meist 13 Stellen).</p>
    <form id="mbForm">
      <input class="field" id="mbCode" inputmode="numeric" pattern="[0-9]*" placeholder="z. B. 4000417025005" autocomplete="off" style="font-size:22px;letter-spacing:2px">
      <div style="height:14px"></div>
      <button class="btn primary" type="submit">Suchen</button>
    </form>
    <p class="hint center" id="mbMsg"></p>`, () => {
    setTimeout(() => $('#mbCode') && $('#mbCode').focus(), 80);
    $('#mbForm').onsubmit = (e) => {
      e.preventDefault();
      const code = $('#mbCode').value.replace(/\D/g, '');
      if (!Scanner.validCode(code)) { $('#mbMsg').textContent = 'Das ist kein gültiger Strichcode – bitte prüfen.'; return; }
      closeSheet();
      lookupBarcode(code, meal);
    };
  });
}

async function lookupBarcode(code, meal) {
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
    <h2>${offline ? '📡 Keine Verbindung' : '🤷 Unbekanntes Produkt'}</h2>
    <p>${offline ? 'Ohne Internet kann das Produkt nicht nachgeschlagen werden.'
      : partial ? `„${esc(partial.name)}“ ist bekannt, aber ohne Nährwerte.` : 'Dieses Produkt ist noch nicht in der Datenbank.'}
      <br><span class="hint">Strichcode: <b>${esc(code)}</b></span></p>
    <p class="hint">Leg es einmal selbst an – die Nährwerte stehen auf der Verpackung. Beim nächsten Scan wird es sofort erkannt.</p>
    <button class="btn primary" id="nfCreate">Selbst anlegen</button>
    <button class="btn" id="nfRetry">📷 Nochmal scannen</button>`, () => {
    $('#nfCreate').onclick = () => customFoodSheet({ ...(partial || {}), id: undefined, barcode: code }, meal);
    $('#nfRetry').onclick = () => openScanner(meal);
  });
}
