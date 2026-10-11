'use strict';

/* =========================================================
   MyFitnessPal-Import
   MyFitnessPal bietet keine offene Schnittstelle. Über
   „Daten exportieren“ (MyFitnessPal Premium) erhältst du aber
   CSV-Dateien, die hier eingelesen werden:
   - Nutrition-Summary…csv   → Kalorien & Makros pro Tag
   - Measurement-Summary…csv → Körpergewicht
   Andere CSV-Dateien mit Spalten wie Datum/Kalorien/Eiweiß
   funktionieren ebenfalls.
   ========================================================= */

const MFP = (() => {
  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const firstLine = text.split(/\r?\n/, 1)[0] || '';
    const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') quoted = false;
        else field += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === delim) { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += ch;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim() !== ''));
  }

  function parseNum(s) {
    s = String(s || '').trim().replace(/\s/g, '');
    if (!s) return null;
    // "1.234,5" (deutsch) oder "1,234.5" (englisch)
    if (/,\d{1,2}$/.test(s) && !/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  function parseDate(s) {
    s = String(s || '').trim();
    let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    if ((m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/))) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    return null;
  }

  const find = (headers, re, not) => headers.findIndex((h) => re.test(h) && !(not && not.test(h)));

  /**
   * Liest eine CSV-Datei und liefert { food: {datum: {kcal,p,c,f}}, weights: {datum: kg} }.
   */
  function parse(text) {
    const rows = parseCSV(text);
    if (rows.length < 2) return { food: {}, weights: {} };
    const headers = rows[0].map((h) => h.trim().toLowerCase());

    const iDate = find(headers, /^(date|datum|day|tag)\b/);
    if (iDate < 0) throw new Error('Keine Datumsspalte gefunden.');
    const iKcal = find(headers, /calor|kalor|energ|kcal/, /fat|fett|burn|verbrannt|goal|ziel/);
    const iProt = find(headers, /prote|eiwei/);
    const iCarb = find(headers, /carb|kohlenh/);
    const iFat = find(headers, /^(fat|fett|total fat)\b/);
    const iWeight = find(headers, /weight|gewicht|körpergewicht/);

    const food = {};
    const weights = {};
    for (const r of rows.slice(1)) {
      const date = parseDate(r[iDate]);
      if (!date) continue;
      if (iKcal >= 0) {
        const kcal = parseNum(r[iKcal]);
        if (kcal != null) {
          const d = food[date] || (food[date] = { kcal: 0, p: 0, c: 0, f: 0 });
          d.kcal += kcal;
          if (iProt >= 0) d.p += parseNum(r[iProt]) || 0;
          if (iCarb >= 0) d.c += parseNum(r[iCarb]) || 0;
          if (iFat >= 0) d.f += parseNum(r[iFat]) || 0;
        }
      }
      if (iWeight >= 0 && iKcal < 0) {
        const kg = parseNum(r[iWeight]);
        if (kg && kg > 20 && kg < 400) weights[date] = kg;
      }
    }
    if (!Object.keys(food).length && !Object.keys(weights).length) {
      throw new Error('Keine Kalorien- oder Gewichtsdaten erkannt.');
    }
    return { food, weights };
  }

  return { parse, parseCSV };
})();
