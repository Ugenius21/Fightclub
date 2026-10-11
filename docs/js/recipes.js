'use strict';

/* =========================================================
   REZEPTE – Gerichte, die man häufig isst

   Ein Rezept besteht aus Zutaten (mit Menge) und einer Anzahl
   Portionen. Kalorien und Makros werden für das ganze Gericht und
   pro Portion berechnet. Zutaten lassen sich nacheinander per
   Strichcode einscannen: Nach jeder Zutat öffnet sich der Scanner
   automatisch wieder, bis man auf „Fertig“ tippt.

   Im Tagebuch verhält sich ein Rezept wie ein Lebensmittel mit
   Portionsgröße (Gesamtgewicht ÷ Portionen).
   ========================================================= */

/** Kennung statt einer Mahlzeit, wenn Zutaten für ein Rezept gewählt werden. */
const RECIPE = '@recipe';
const RECIPE_DRAFT_KEY = 'fightclub-recipe-draft';

let recipeDraft = null;
try { recipeDraft = JSON.parse(localStorage.getItem(RECIPE_DRAFT_KEY)); } catch (e) { recipeDraft = null; }

function saveRecipeDraft() {
  try {
    if (recipeDraft) localStorage.setItem(RECIPE_DRAFT_KEY, JSON.stringify(recipeDraft));
    else localStorage.removeItem(RECIPE_DRAFT_KEY);
  } catch (e) { /* ignorieren */ }
}

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
    brand: `Rezept · ${t.servings} Portion${t.servings === 1 ? '' : 'en'}`,
    unit: 'g', per100: { kcal: per(t.sum.kcal), p: per(t.sum.p), c: per(t.sum.c), f: per(t.sum.f) },
    serving: t.servingWeight || null, src: 'recipe',
  };
}

function recipesMatching(q) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  return [...data.recipes]
    .filter((r) => words.every((w) => norm(r.name).includes(w)))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    .map(recipeFood);
}

function recipeRowHtml(r, attr) {
  const t = recipeTotals(r);
  return `<button class="food-row" ${attr}>
    <span class="emoji-big">${ico('pot')}</span>
    <div class="grow"><div class="t">${esc(r.name)}</div>
    <div class="s">${t.servings} Portion${t.servings === 1 ? '' : 'en'} · ${r.items.length} Zutat${r.items.length === 1 ? '' : 'en'} · ${macroLine(t.perServing)} pro Portion</div></div>
    <b>${fmtNum(t.perServing.kcal, 0)}<small> kcal</small></b></button>`;
}

/* ---------------- Liste ---------------- */

function viewRecipes(v) {
  const list = [...data.recipes].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  v.innerHTML = `
    ${recipeDraft ? `<button class="resume" id="rcResume">
      ${ico('pot')}
      <div class="grow"><div class="big">Rezept in Arbeit${recipeDraft.name ? ': ' + esc(recipeDraft.name) : ''}</div>
      <div class="small">${recipeDraft.items.length} Zutat${recipeDraft.items.length === 1 ? '' : 'en'} · Tippen zum Weitermachen</div></div>
      <span class="chev">${ico('chevr')}</span></button>` : ''}
    <div class="btn-row">
      <button class="btn yellow" id="rcScan">${ico('scan')}Per Scan</button>
      <button class="btn" id="rcNew">${ico('plus')}Neues Rezept</button>
    </div>
    <p class="hint small center" style="margin:10px 0 16px">Beim Scannen öffnet sich die Kamera nach jeder Zutat wieder – so scannst du alle Zutaten nacheinander ein.</p>
    <div class="panel">${list.length ? list.map((r) => recipeRowHtml(r, `data-rid="${r.id}"`)).join('')
      : '<p class="hint" style="margin:0">Noch keine Rezepte. Leg Gerichte an, die du oft isst – z. B. dein Frühstücks-Porridge oder Chili con Carne. Danach trägst du sie mit einem Tipp ins Tagebuch ein.</p>'}</div>`;

  if ($('#rcResume')) $('#rcResume').onclick = recipeEditor;
  $('#rcNew').onclick = () => { if (startRecipe()) recipeEditor(); };
  $('#rcScan').onclick = () => {
    if (!startRecipe()) return;
    recipeDraft.scanning = true;
    saveRecipeDraft();
    openScanner(RECIPE);
  };
  $$('[data-rid]', v).forEach((b) => b.onclick = () => recipeSheet(data.recipes.find((r) => r.id === b.dataset.rid)));
}

/** Neues Rezept beginnen (oder ein vorhandenes zum Bearbeiten öffnen). */
function startRecipe(existing) {
  if (recipeDraft && !(existing && recipeDraft.id === existing.id)) {
    if (!confirm('Es gibt ein angefangenes Rezept. Verwerfen und neu beginnen?')) { recipeEditor(); return false; }
  }
  recipeDraft = existing
    ? { ...JSON.parse(JSON.stringify(existing)), isNew: false }
    : { id: uid(), name: '', servings: 1, items: [], cookedWeight: null, isNew: true };
  saveRecipeDraft();
  return true;
}

function recipeSheet(r) {
  const t = recipeTotals(r);
  openSheet(`
    <h2>${ico('pot')}${esc(r.name)}</h2>
    <div class="panel recipe-sum">${recipeSumHtml(r)}</div>
    <span class="label">Zutaten</span>
    <div class="panel">${r.items.map((it) => `<div class="food-row"><div class="grow"><div class="t">${esc(it.name)}</div>
      <div class="s">${it.brand ? esc(it.brand) + ' · ' : ''}${fmtNum(it.amount, 0)} ${it.unit || 'g'}</div></div>
      <b>${fmtNum(calcNutrition(it.per100, it.amount).kcal, 0)}</b></div>`).join('')}</div>
    <button class="btn primary" id="rsAdd">${ico('plus')}Ins Tagebuch (${fmtNum(t.perServing.kcal, 0)} kcal/Portion)</button>
    <button class="btn" id="rsEdit">${ico('edit')}Bearbeiten</button>
    <button class="btn danger" id="rsDel">Rezept löschen</button>
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
  if (!r.items.length) return '<p class="hint" style="margin:0">Noch keine Zutaten.</p>';
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
    <h2>${ico('pot')}${r.isNew ? 'Neues Rezept' : 'Rezept bearbeiten'}</h2>
    <label class="lbl">Name</label>
    <input class="field" id="rcName" value="${esc(r.name)}" placeholder="z. B. Chili con Carne" autocomplete="off" enterkeyhint="done">
    <div class="row servings">
      <span class="grow">Portionen</span>
      <button class="ibtn" id="rcMinus" aria-label="Weniger Portionen">${ico('minus')}</button>
      <b id="rcServ">${r.servings}</b>
      <button class="ibtn" id="rcPlus" aria-label="Mehr Portionen">${ico('plus')}</button>
    </div>
    <span class="label">Zutaten (${r.items.length})</span>
    <div class="panel">${ingRows || '<p class="hint" style="margin:0">Noch keine Zutaten. Scanne sie nacheinander ein oder suche sie.</p>'}</div>
    <div class="btn-row">
      <button class="btn yellow" id="rcScanIng">${ico('scan')}Zutaten scannen</button>
      <button class="btn" id="rcSearch">${ico('search')}Suchen</button>
    </div>
    <div style="height:16px"></div>
    <div class="panel recipe-sum" id="rcSum">${recipeSumHtml(r)}</div>
    <label class="lbl">Gewicht fertig gekocht (optional, in g)<br><span class="hint">Damit stimmt auch die Eingabe in Gramm, wenn beim Kochen Wasser verdampft oder Nudeln Wasser aufnehmen.</span></label>
    <input class="field" id="rcCooked" inputmode="numeric" value="${r.cookedWeight || ''}" placeholder="${recipeTotals(r).raw ? `Zutaten zusammen: ${fmtNum(recipeTotals(r).raw, 0)} g` : 'z. B. 1200'}">
    <div style="height:16px"></div>
    <button class="btn primary" id="rcSave">Rezept speichern</button>
    <button class="btn danger" id="rcDiscard">${r.isNew ? 'Verwerfen' : 'Änderungen verwerfen'}</button>
  `, () => {
    const updateSum = () => { $('#rcSum').innerHTML = recipeSumHtml(r); $('#rcServ').textContent = r.servings; };
    $('#rcName').oninput = (e) => { r.name = e.target.value; saveRecipeDraft(); };
    $('#rcCooked').oninput = (e) => {
      const n = parseInt(String(e.target.value).replace(/\D/g, ''), 10);
      r.cookedWeight = n > 0 ? n : null;
      saveRecipeDraft(); updateSum();
    };
    $('#rcMinus').onclick = () => { r.servings = Math.max(1, r.servings - 1); saveRecipeDraft(); updateSum(); };
    $('#rcPlus').onclick = () => { r.servings = Math.min(50, r.servings + 1); saveRecipeDraft(); updateSum(); };
    $$('[data-ing]').forEach((b) => b.onclick = () => ingredientPad(Number(b.dataset.ing)));
    $('#rcScanIng').onclick = () => { r.scanning = true; saveRecipeDraft(); openScanner(RECIPE); };
    $('#rcSearch').onclick = () => addFoodSheet(RECIPE);
    $('#rcSave').onclick = () => {
      if (!r.name.trim()) { $('#rcName').focus(); toast('Bitte einen Namen eingeben'); return; }
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
  });
}

/** Menge einer Zutat ändern oder sie entfernen. */
function ingredientPad(i) {
  const r = recipeDraft;
  const it = r.items[i];
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
    onCancel: () => recipeEditor(),
    onDone: () => {
      if (tmp.amount) { it.amount = tmp.amount; saveRecipeDraft(); }
      recipeEditor();
    },
  });
}

/** Zutat übernehmen – beim Scannen geht es direkt mit der nächsten weiter. */
function addIngredient(food, amount) {
  const r = recipeDraft;
  if (!r) return;
  r.items.push({ name: food.name, brand: food.brand || '', foodId: food.id || null, unit: food.unit || 'g', per100: food.per100, amount });
  // Gescannte Produkte merken (wie im Tagebuch)
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
