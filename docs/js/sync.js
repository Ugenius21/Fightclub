'use strict';

/* =========================================================
   Login per E-Mail & Synchronisierung über Supabase
   (direkt über die REST-API, ohne zusätzliche Bibliothek)
   ========================================================= */

const Sync = (() => {
  const cfg = window.FIGHTCLUB_CONFIG || {};
  const baseUrl = String(cfg.supabaseUrl || '').trim().replace(/\/+$/, '');
  const apiKey = String(cfg.supabaseKey || '').trim();
  const SESSION_KEY = 'fightclub-session';
  const LAST_KEY = 'fightclub-lastsync';

  let session = null;
  try { session = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { session = null; }

  const state = { status: 'idle', error: null, last: Number(localStorage.getItem(LAST_KEY)) || null };
  const listeners = [];
  let hooks = { getData: null, setData: null };
  let running = false;
  let again = false;
  let timer = null;

  const configured = () => !!(baseUrl && apiKey);
  const user = () => (session && session.user) || null;
  const emit = () => listeners.forEach((fn) => { try { fn(state); } catch (e) { /* ignorieren */ } });

  function storeSession(s) {
    session = s;
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* ignorieren */ }
    emit();
  }

  function fromAuthResponse(r) {
    return {
      access_token: r.access_token,
      refresh_token: r.refresh_token,
      expires_at: r.expires_at || Math.floor(Date.now() / 1000) + (r.expires_in || 3600),
      user: r.user ? { id: r.user.id, email: r.user.email } : (session && session.user),
    };
  }

  async function request(path, { method = 'GET', body, token, headers = {} } = {}) {
    if (!configured()) throw new Error('Sync ist nicht eingerichtet.');
    const res = await fetch(baseUrl + path, {
      method,
      // Authorization nur mit echtem Benutzer-Token: Neue Supabase-Projekte
      // („publishable key“) lehnen den Key als Bearer-Token ab.
      headers: {
        apikey: apiKey,
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
    if (!res.ok) {
      const msg = (json && (json.msg || json.error_description || json.message || json.error)) || `Fehler ${res.status}`;
      const err = new Error(translate(msg));
      err.status = res.status;
      throw err;
    }
    return json;
  }

  function translate(msg) {
    const m = String(msg);
    if (/invalid login credentials/i.test(m)) return 'E-Mail oder Passwort ist falsch.';
    if (/email not confirmed/i.test(m)) return 'Bitte bestätige zuerst deine E-Mail-Adresse (Link in der Mail).';
    if (/already registered|already been registered/i.test(m)) return 'Für diese E-Mail gibt es schon ein Konto. Melde dich an.';
    if (/password should be at least/i.test(m)) return 'Das Passwort muss mindestens 6 Zeichen haben.';
    if (/rate limit|too many/i.test(m)) return 'Zu viele Versuche. Bitte warte kurz.';
    if (/unable to validate email|invalid email/i.test(m)) return 'Bitte gib eine gültige E-Mail-Adresse ein.';
    return m;
  }

  async function accessToken() {
    if (!session) throw new Error('Nicht angemeldet.');
    if (session.expires_at * 1000 < Date.now() + 60000) {
      try {
        const r = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token } });
        storeSession(fromAuthResponse(r));
      } catch (e) {
        if (e.status === 400 || e.status === 401) { storeSession(null); throw new Error('Sitzung abgelaufen – bitte erneut anmelden.'); }
        throw e;
      }
    }
    return session.access_token;
  }

  /* ---------- Konto ---------- */

  async function signIn(email, password) {
    const r = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
    storeSession(fromAuthResponse(r));
    await syncNow();
  }

  /** Gibt true zurück, wenn direkt angemeldet; false, wenn die E-Mail erst bestätigt werden muss. */
  async function signUp(email, password) {
    const redirect = location.origin + location.pathname;
    const r = await request('/auth/v1/signup?redirect_to=' + encodeURIComponent(redirect), { method: 'POST', body: { email, password } });
    if (r && r.access_token) {
      storeSession(fromAuthResponse(r));
      await syncNow();
      return true;
    }
    return false;
  }

  async function recover(email) {
    const redirect = location.origin + location.pathname;
    await request('/auth/v1/recover?redirect_to=' + encodeURIComponent(redirect), { method: 'POST', body: { email } });
  }

  async function setPassword(password) {
    const token = await accessToken();
    await request('/auth/v1/user', { method: 'PUT', token, body: { password } });
  }

  async function signOut() {
    try { if (session) await request('/auth/v1/logout', { method: 'POST', token: session.access_token }); } catch (e) { /* egal */ }
    storeSession(null);
    state.status = 'idle';
    state.error = null;
    emit();
  }

  /** Verarbeitet den Rücksprung aus einer Bestätigungs- oder Passwort-Mail (#access_token=…). */
  async function handleRedirect() {
    if (!location.hash.includes('access_token=')) return null;
    const p = new URLSearchParams(location.hash.slice(1));
    history.replaceState(null, '', location.pathname + location.search);
    const s = {
      access_token: p.get('access_token'),
      refresh_token: p.get('refresh_token'),
      expires_at: Number(p.get('expires_at')) || Math.floor(Date.now() / 1000) + Number(p.get('expires_in') || 3600),
      user: null,
    };
    try {
      const u = await request('/auth/v1/user', { token: s.access_token });
      s.user = { id: u.id, email: u.email };
    } catch (e) { return null; }
    storeSession(s);
    return p.get('type') || 'login';
  }

  /* ---------- Synchronisieren ---------- */

  async function syncNow() {
    if (!configured() || !session || !hooks.getData) return;
    if (running) { again = true; return; }
    running = true;
    state.status = 'syncing';
    emit();
    try {
      const token = await accessToken();
      const uid = session.user.id;
      const rows = await request(`/rest/v1/fightclub_data?select=data&user_id=eq.${encodeURIComponent(uid)}`, { token });
      const remote = rows && rows[0] ? FCData.normalize(rows[0].data) : null;
      const local = hooks.getData();
      const merged = remote ? FCData.merge(local, remote) : FCData.normalize(local);
      const mergedJson = JSON.stringify(merged);

      if (!remote || mergedJson !== JSON.stringify(remote)) {
        await request('/rest/v1/fightclub_data?on_conflict=user_id', {
          method: 'POST',
          token,
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: { user_id: uid, data: merged, updated_at: new Date().toISOString() },
        });
      }
      if (mergedJson !== JSON.stringify(local)) hooks.setData(merged);

      state.last = Date.now();
      try { localStorage.setItem(LAST_KEY, String(state.last)); } catch (e) { /* ignorieren */ }
      state.status = 'ok';
      state.error = null;
    } catch (e) {
      state.status = navigator.onLine === false || e instanceof TypeError ? 'offline' : 'error';
      state.error = state.status === 'offline' ? 'Keine Internetverbindung – wird später synchronisiert.' : e.message;
    } finally {
      running = false;
      emit();
      if (again) { again = false; syncNow(); }
    }
  }

  /** Nach einer Änderung kurz warten und dann synchronisieren. */
  function schedule(delay = 1500) {
    if (!configured() || !session) return;
    clearTimeout(timer);
    timer = setTimeout(syncNow, delay);
  }

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(300); });
  window.addEventListener('online', () => schedule(300));

  /** Prüft Schritt für Schritt, ob Login & Sync richtig eingerichtet sind. */
  async function diagnose() {
    if (!configured()) return [{ ok: false, text: 'In docs/config.js fehlen noch Project URL und Key.' }];
    const out = [];
    try {
      await request('/auth/v1/settings');
      out.push({ ok: true, text: 'Supabase erreichbar, Key gültig.' });
    } catch (e) {
      out.push({ ok: false, text: e.status === 401 || e.status === 403
        ? 'Der Key wird abgelehnt – prüfe den anon/publishable Key in config.js.'
        : `Supabase nicht erreichbar – prüfe die Project URL (${baseUrl}) und deine Internetverbindung.` });
      return out;
    }
    try {
      await request('/rest/v1/fightclub_data?select=user_id&limit=1', { token: session && session.access_token });
      out.push({ ok: true, text: 'Tabelle für den Sync ist vorhanden.' });
    } catch (e) {
      out.push({ ok: false, text: 'Tabelle fehlt – führe supabase/setup.sql im SQL-Editor von Supabase aus.' });
    }
    out.push(session ? { ok: true, text: `Angemeldet als ${session.user.email}.` } : { ok: false, text: 'Noch nicht angemeldet – Profil → Anmelden bzw. Neues Konto erstellen.' });
    if (session && state.status === 'error') out.push({ ok: false, text: 'Letzter Sync fehlgeschlagen: ' + state.error });
    return out;
  }

  return {
    configured, user, state, diagnose,
    attach(h) { hooks = h; },
    onChange(fn) { listeners.push(fn); },
    signIn, signUp, signOut, recover, setPassword, handleRedirect, syncNow, schedule,
  };
})();
