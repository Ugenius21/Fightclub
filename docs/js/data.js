'use strict';

/* =========================================================
   Datenmodell, Migration und Zusammenführen (für den Sync)

   Jeder Datensatz hat eine feste id und einen Zeitstempel `upd`
   (letzte Änderung). Gelöschte Datensätze werden in `deleted`
   vermerkt. So lassen sich die Daten von mehreren Geräten
   zusammenführen, ohne dass Einträge verloren gehen.
   ========================================================= */

const FCData = (() => {
  const COLLECTIONS = ['plans', 'workouts', 'weights', 'food', 'foods', 'recipes', 'notes'];

  const DEFAULT_SETTINGS = { restSec: 90, kcalGoal: 2500, proteinGoal: 150, carbsGoal: 280, fatGoal: 80, sound: true, upd: 0 };

  function empty() {
    return { v: 2, plans: [], workouts: [], weights: [], food: [], foods: [], recipes: [], notes: [], settings: { ...DEFAULT_SETTINGS }, deleted: {} };
  }

  /** Bringt Daten jeder Version (auch v1 und Teildaten) in die aktuelle Form. */
  function normalize(raw) {
    const d = empty();
    if (!raw || typeof raw !== 'object') return d;
    for (const c of COLLECTIONS) {
      d[c] = (Array.isArray(raw[c]) ? raw[c] : []).filter((r) => r && r.id).map((r) => ({ ...r, upd: r.upd || 1 }));
    }
    d.settings = { ...DEFAULT_SETTINGS, ...(raw.settings || {}) };
    d.deleted = { ...(raw.deleted || {}) };

    // v1: Körpergewicht bekommt eine id pro Tag, damit zwei Geräte nicht doppelt eintragen.
    const byDate = new Map();
    for (const w of d.weights) {
      const id = 'w-' + w.date;
      const prev = byDate.get(id);
      if (!prev || w.upd >= prev.upd) byDate.set(id, { ...w, id });
    }
    d.weights = [...byDate.values()];

    d.plans.forEach((p) => { p.exercises = Array.isArray(p.exercises) ? p.exercises : []; });
    d.workouts.forEach((w) => {
      w.entries = Array.isArray(w.entries) ? w.entries : [];
      w.entries.forEach((e) => { e.sets = Array.isArray(e.sets) ? e.sets : []; });
    });
    return d;
  }

  /** Führt zwei Datenstände zusammen. Bei Konflikten gewinnt die neuere Änderung. */
  function merge(a, b) {
    a = normalize(a);
    b = normalize(b);
    const out = empty();

    out.deleted = { ...a.deleted };
    for (const [id, ts] of Object.entries(b.deleted)) out.deleted[id] = Math.max(out.deleted[id] || 0, ts);

    for (const c of COLLECTIONS) {
      const map = new Map();
      for (const r of a[c]) map.set(r.id, r);
      for (const r of b[c]) {
        const cur = map.get(r.id);
        if (!cur || r.upd > cur.upd) map.set(r.id, r);
      }
      out[c] = [...map.values()].filter((r) => !(out.deleted[r.id] >= r.upd));
    }
    out.settings = (b.settings.upd || 0) > (a.settings.upd || 0) ? b.settings : a.settings;
    return out;
  }

  return { COLLECTIONS, empty, normalize, merge };
})();
