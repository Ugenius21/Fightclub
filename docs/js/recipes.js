'use strict';

/* =========================================================
   REZEPTE – Gerichte, die man häufig isst

   Ein Rezept besteht aus Zutaten (mit Menge) und einer Anzahl
   Portionen. Kalorien und Makros werden für das ganze Gericht und
   pro Portion berechnet. Zutaten lassen sich suchen oder nacheinander
   per Strichcode einscannen: Nach jeder gescannten Zutat öffnet sich
   der Scanner wieder, bis man auf „Fertig“ tippt.

   Im Tagebuch verhält sich ein Rezept wie ein Lebensmittel mit
   Portionsgröße (Gesamtgewicht ÷ Portionen).
   ========================================================= */

/** Kennung statt einer Mahlzeit, wenn Zutaten für ein Rezept gewählt werden. */
const RECIPE = '@recipe';
const RECIPE_DRAFT_KEY = 'fightclub-recipe-draft';

let recipeDraft = null;
try { recipeDraft = JSON.parse(localStorage.getItem(RECIPE_DRAFT_KEY)); } catch (e) { recipeDraft = null; }
if (recipeDraft && !Array.isArray(recipeDraft.items)) recipeDraft = null;

/** Scroll-Stand im Rezept-Formular – nach „Zutat suchen/scannen“ geht es an derselben Stelle weiter. */
let recipeScroll = 0;
/** Bei einem ganz neuen Rezept steht die Schreibmarke gleich im Namensfeld. */
let recipeFocusName = false;

function saveRecipeDraft() {
  try {
    if (recipeDraft) localStorage.setItem(RECIPE_DRAFT_KEY, JSON.stringify(recipeDraft));
    else localStorage.removeItem(RECIPE_DRAFT_KEY);
  } catch (e) { /* ignorieren */ }
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function recipeTotals(r) {
  const items = r.items || [];
  const sum = { kcal: 0, p: 0, c: 0, f: 0 };
  let raw = 0;
  for (const it of items) {
    const n = calcNutrition(it.per100, it.amount);
    sum.kcal += n.kcal; sum.p += n.p; sum.c += n.c; sum.f += n.f;
    raw += Number(it.amount) || 0;
  }
  const weight = r.cookedWeight || raw;
  const servings = Math.max(1, r.servings || 1);
  const perServing = { kcal: sum.kcal / servings, p: sum.p / servings, c: sum.c / servings, f: sum.f / servings };
  return { sum, raw, weight, servings, perServing, servingWeight: weight ? Math.round(weight / servings) : 0 };
}

/** Rezept als „Lebensmittel“ (Nährwerte pro 100 g, Portion = Gesamtgewicht ÷ Portionen). */
function recipeFood(r) {
  const t = recipeTotals(r);
  const per = (x) => (t.weight ? round1((x / t.weight) * 100) : 0);
  return {
    id: 'r-' + r.id, recipeId: r.id, name: r.name || 'Rezept',
    brand: `Rezept · ${plural(t.servings, 'Portion', 'Portionen')}`,
    unit: 'g', per100: { kcal: per(t.sum.kcal), p: per(t.sum.p), c: per(t.sum.c), f: per(t.sum.f) },
    serving: t.servingWeight || null, src: 'recipe',
  };
}

function recipesMatching(q) {
  const words = foldText(q).split(' ').filter(Boolean);
  return [...data.recipes]
    .filter((r) => { const hay = foldText(r.name); return words.every((w) => hay.includes(w)); })
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    .map(recipeFood);
}

function recipeRowHtml(r, attr) {
  const t = recipeTotals(r);
  return `<button class="food-row" ${attr}>
    <span class="emoji-big">${ico('pot')}</span>
    <div class="grow"><div class="t">${esc(r.name)}</div>
    <div class="s">${plural(t.servings, 'Portion', 'Portionen')} · ${plural(r.items.length, 'Zutat', 'Zutaten')} · ${macroLine(t.perServing)} pro Portion</div></div>
    <b>${fmtNum(t.perServing.kcal, 0)}<small> kcal</small></b></button>`;
}

/* ---------------- Liste ---------------- */

function viewRecipes(v) {
  const list = [...data.recipes].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  v.innerHTML = `
    ${recipeDraft ? `<button class="resume" id="rcResume">
      ${ico('pot')}
      <div class="grow"><div class="big">Rezept in Arbeit${recipeDraft.name ? ': ' + esc(recipeDraft.name) : ''}</div>
      <div class="small">${plural(recipeDraft.items.length, 'Zutat', 'Zutaten')} · Tippen zum Weitermachen</div></div>
      <span class="chev">${ico('chevr')}</span></button>` : ''}
    <div class="btn-row">
      <button class="btn yellow" id="rcNew">${ico('plus')}Neues Rezept</button>
      <button class="btn" id="rcScan">${ico('scan')}Per Scan</button>
    </div>
    <div class="gap"></div>
    ${list.length
      ? `<div class="panel res-list">${list.map((r) => recipeRowHtml(r, `data-rid="${r.id}"`)).join('')}</div>`
      : `<div class="empty"><div class="big">${ico('pot')}</div><p>Noch keine Rezepte.<br>Leg Gerichte an, die du oft isst – danach trägst du sie mit einem Tipp ins Tagebuch ein.</p></div>`}
    <p class="hint small center">„Per Scan“ öffnet die Kamera nach jeder Zutat wieder – so scannst du alle Zutaten nacheinander ein.</p>`;

  if ($('#rcResume')) $('#rcResume').onclick = () => { recipeScroll = 0; recipeEditor(); };
  $('#rcNew').onclick = () => { if (startRecipe()) recipeEditor(); };
  $('#rcScan').onclick = () => {
    if (!startRecipe()) return;
    recipeFocusName = false;
    recipeDraft.scanning = true;
    saveRecipeDraft();
    openScanner(RECIPE);
  };
  $$('[data-rid]', v).forEach((b) => b.onclick = () => {
    const r = data.recipes.find((x) => x.id === b.dataset.rid);
    if (r) recipeSheet(r);
  });
}

/** Neues Rezept beginnen (oder ein vorhandenes zum Bearbeiten öffnen). */
function startRecipe(existing) {
  recipeScroll = 0;
  if (recipeDraft && !(existing && recipeDraft.id === existing.id)) {
    if (!confirm('Es gibt ein angefangenes Rezept. Verwerfen und neu beginnen?')) { recipeEditor(); return false; }
  }
  recipeDraft = existing
    ? { ...JSON.parse(JSON.stringify(existing)), isNew: false }
    : { id: uid(), name: '', servings: 1, items: [], cookedWeight: null, isNew: true };
  recipeFocusName = !existing;
  saveRecipeDraft();
  return true;
}

function recipeSheet(r) {
  const t = recipeTotals(r);
  openSheet(`
    ${sheetHead(esc(r.name), 'pot')}
    <div class="panel recipe-sum">${recipeSumHtml(r)}</div>
    <button class="btn primary" id="rsAdd">${ico('plus')}Ins Tagebuch · ${fmtNum(t.perServing.kcal, 0)} kcal pro Portion</button>
    <span class="label">Zutaten</span>
    <div class="panel res-list">${r.items.map((it) => `<div class="food-row"><div class="grow"><div class="t">${esc(it.name)}</div>
      <div class="s">${it.brand ? esc(it.brand) + ' · ' : ''}${fmtNum(it.amount, 0)} ${it.unit || 'g'}</div></div>
      <b>${fmtNum(calcNutrition(it.per100, it.amount).kcal, 0)}</b></div>`).join('')}</div>
    <button class="btn" id="rsEdit">${ico('edit')}Bearbeiten</button>
    <button class="btn danger" id="rsDel">${ico('trash')}Rezept löschen</button>
  `, () => {
    $('#rsAdd').onclick = () => { foodState.date = foodState.date || todayStr(); portionSheet(recipeFood(r), defaultMeal()); };
    $('#rsEdit').onclick = () => { if (startRecipe(r)) recipeEditor(); };
    $('#rsDel').onclick = () => {
      if (!confirm(`Rezept „${r.name}“ löschen? Einträge im Tagebuch bleiben erhalten.`)) return;
      removeRec('recipes', r.id); save(); closeSheet(); render();
    };
  });
}

function recipeSumHtml(r) {
  const t = recipeTotals(r);
  if (!r.items.length) return '<p class="hint">Sobald Zutaten dabei sind, stehen hier Kalorien und Makros pro Portion.</p>';
  return `<div class="row">
    <div class="grow"><div class="hint">Pro Portion${t.servingWeight ? ` · ${fmtNum(t.servingWeight, 0)} g` : ''}</div>
      <div class="big-kcal">${fmtNum(t.perServing.kcal, 0)} kcal</div>
      <div class="small">${macroLine(t.perServing)}</div></div>
    <div class="center"><div class="hint">Ganzes Gericht</div><b class="mid-kcal">${fmtNum(t.sum.kcal, 0)} kcal</b>
      <div class="hint small">${fmtNum(t.weight, 0)} g${r.cookedWeight ? ' (gekocht)' : ''}</div></div>
  </div>`;
}

/* ---------------- Bearbeiten ---------------- */

function recipeEditor() {
  const r = recipeDraft;
  if (!r) return;
  r.scanning = false;
  saveRecipeDraft();
  const ingRows = r.items.map((it, i) => {
    const n = calcNutrition(it.per100, it.amount);
    return `<button class="food-row" data-ing="${i}">
      <div class="grow"><div class="t">${esc(it.name)}</div>
      <div class="s">${it.brand ? esc(it.brand) + ' · ' : ''}${fmtNum(it.amount, 0)} ${it.unit || 'g'} · ${macroLine(n)}</div></div>
      <b>${fmtNum(n.kcal, 0)}</b></button>`;
  }).join('');

  openSheet(`
    ${sheetHead(r.isNew ? 'Neues Rezept' : 'Rezept bearbeiten', 'pot')}
    <label class="lbl" for="rcName">Name</label>
    <input class="field" id="rcName" value="${esc(r.name)}" placeholder="z. B. Chili con Carne" autocomplete="off" autocapitalize="sentences" enterkeyhint="done">
    <div class="row servings">
      <span class="grow">Portionen</span>
      <button class="ibtn" id="rcMinus" aria-label="Weniger Portionen">${ico('minus')}</button>
      <b id="rcServ">${r.servings}</b>
      <button class="ibtn" id="rcPlus" aria-label="Mehr Portionen">${ico('plus')}</button>
    </div>
    <span class="label">Zutaten (${r.items.length})</span>
    ${ingRows ? `<div class="panel res-list">${ingRows}</div>` : '<p class="hint">Noch keine Zutaten. Suche sie oder scanne sie nacheinander ein.</p>'}
    <div class="btn-row">
      <button class="btn yellow" id="rcSearch">${ico('search')}Zutat suchen</button>
      <button class="btn" id="rcScanIng">${ico('scan')}Scannen</button>
    </div>
    <span class="label">Nährwerte</span>
    <div class="panel recipe-sum" id="rcSum">${recipeSumHtml(r)}</div>
    <button class="value-btn" id="rcCooked">${ico('scale')}<span>Gewicht fertig gekocht<br><span class="hint small">freiwillig – für genaue Gramm-Angaben</span></span><b class="${r.cookedWeight ? '' : 'unset'}">${r.cookedWeight ? withUnit(fmtNum(r.cookedWeight, 0) + ' g') : '–'}</b></button>
    <div class="gap-l"></div>
    <button class="btn primary" id="rcSave">Rezept speichern</button>
    <button class="btn danger" id="rcDiscard">${r.isNew ? 'Rezept verwerfen' : 'Änderungen verwerfen'}</button>
  `, () => {
    const updateSum = () => { $('#rcSum').innerHTML = recipeSumHtml(r); $('#rcServ').textContent = r.servings; };
    const name = $('#rcName');
    name.oninput = () => { r.name = name.value; saveRecipeDraft(); };
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); name.blur(); } });
    $('#rcMinus').onclick = () => { r.servings = Math.max(1, r.servings - 1); saveRecipeDraft(); updateSum(); };
    $('#rcPlus').onclick = () => { r.servings = Math.min(50, r.servings + 1); saveRecipeDraft(); updateSum(); };
    $$('[data-ing]').forEach((b) => b.onclick = () => ingredientPad(Number(b.dataset.ing)));
    $('#rcScanIng').onclick = () => { r.scanning = true; saveRecipeDraft(); openScanner(RECIPE); };
    $('#rcSearch').onclick = () => foodSearch(RECIPE, { focus: true });
    $('#rcCooked').onclick = cookedWeightPad;
    $('#rcSave').onclick = () => {
      if (!r.name.trim()) { name.focus(); toast('Bitte einen Namen eingeben'); return; }
      if (!r.items.length) { toast('Füge mindestens eine Zutat hinzu'); return; }
      const rec = { id: r.id, name: r.name.trim(), servings: r.servings, cookedWeight: r.cookedWeight || null, items: r.items };
      const i = data.recipes.findIndex((x) => x.id === rec.id);
      if (i >= 0) data.recipes[i] = touch(rec); else data.recipes.push(touch(rec));
      recipeDraft = null; saveRecipeDraft();
      save(); closeSheet();
      toast('Rezept gespeichert');
      foodState.tab = 'recipes';
      if (nav.tab !== 'food') switchTab('food'); else render();
    };
    $('#rcDiscard').onclick = () => {
      if (!confirm(r.isNew ? 'Rezept verwerfen?' : 'Änderungen verwerfen?')) return;
      recipeDraft = null; saveRecipeDraft(); closeSheet(); render();
    };
    // An der Stelle weitermachen, an der man das Formular verlassen hat
    sheetCard.scrollTop = recipeScroll;
    sheetCard.onscroll = () => { recipeScroll = sheetCard.scrollTop; };
    if (recipeFocusName) { recipeFocusName = false; name.focus(); }
  }, {
    full: true,
    // Beim Schließen die Liste auffrischen („Rezept in Arbeit“), sobald nichts mehr offen ist
    onClose: () => { sheetCard.onscroll = null; pendingRender = true; },
  });
}

/** Gewicht des fertigen Gerichts (freiwillig): Beim Kochen verdampft Wasser oder
    Nudeln und Reis nehmen welches auf – damit stimmt die Eingabe in Gramm trotzdem. */
function cookedWeightPad() {
  const r = recipeDraft;
  if (!r) return;
  const raw = recipeTotals({ ...r, cookedWeight: null }).raw;
  const tmp = { g: r.cookedWeight || null };
  Keypad.open({
    owner: 'food',
    fields: [{ key: 'g', label: 'Gewicht', unit: 'g', decimals: 0, int: true, step: 50, get: () => tmp.g, set: (x) => { tmp.g = x; }, fallback: () => raw }],
    title: () => '<b>Gewicht fertig gekocht</b>',
    extraHtml: () => `<div class="kp-note">${raw ? `Zutaten zusammen: ${fmtNum(raw, 0)} g. ` : ''}Leer lassen, wenn du das fertige Gericht nicht wiegst.</div>`,
    okLabel: 'Übernehmen',
    onCancel: () => recipeEditor(),
    onDone: () => {
      r.cookedWeight = tmp.g > 0 ? Math.round(tmp.g) : null;
      saveRecipeDraft();
      recipeEditor();
    },
  });
}

/** Menge einer Zutat ändern oder sie entfernen. */
function ingredientPad(i) {
  const r = recipeDraft;
  const it = r && r.items[i];
  if (!it) return;
  const tmp = { amount: it.amount };
  const preview = () => { const n = calcNutrition(it.per100, tmp.amount); return `<b>${fmtNum(n.kcal, 0)} kcal</b> · ${macroLine(n)}`; };
  Keypad.open({
    owner: 'food',
    fields: [{ key: 'amount', label: 'Menge', unit: it.unit || 'g', decimals: 0, int: true, step: 10, get: () => tmp.amount, set: (x) => { tmp.amount = x; } }],
    title: () => `<b>${esc(it.name)}</b> · Zutat`,
    extraHtml: () => `<div class="kp-preview" id="kpPreview">${preview()}</div><button class="kp-del" data-del>${ico('trash')}Zutat entfernen</button>`,
    onDraw: (root) => {
      $('[data-del]', root).onclick = () => { r.items.splice(i, 1); saveRecipeDraft(); Keypad.close(); recipeEditor(); };
    },
    onChange: () => { const p = $('#kpPreview'); if (p) p.innerHTML = preview(); },
    okLabel: 'Übernehmen',
    validate: () => (tmp.amount ? '' : 'Bitte eine Menge eingeben'),
    onCancel: () => recipeEditor(),
    onDone: () => {
      it.amount = tmp.amount;
      saveRecipeDraft();
      recipeEditor();
    },
  });
}

/** Zutat übernehmen – beim Scannen geht es direkt mit der nächsten weiter. */
function addIngredient(food, amount) {
  const r = recipeDraft;
  if (!r) return;
  r.items.push({ name: food.name, brand: food.brand || '', foodId: food.id || null, unit: food.unit || 'g', per100: food.per100, amount });
  // Gescannte und online gefundene Produkte merken (wie im Tagebuch)
  if (food.src === 'off' && food.id && !data.foods.some((f) => f.id === food.id)) {
    const { lastAmount, ...clean } = food;
    data.foods.push(touch({ ...clean }));
    save();
  }
  saveRecipeDraft();
  toast(`${food.name} hinzugefügt`);
  if (r.scanning) openScanner(RECIPE);
  else recipeEditor();
}
