// Connexion en direct (Firebase Realtime Database + connexion anonyme).
// Expose window.NET puis déclenche l'événement « net-ready ».
import { firebaseConfig as FILE_CFG } from './firebase-config.js';
const V = '10.12.2';
const CFG_KEY = 'tdc-firebase-config';

export function parseConfig(text) {
  const out = {};
  String(text || '').replace(/(\w+)\s*:\s*["']([^"']+)["']/g, (m, k, v) => { out[k] = v; return m; });
  return out.apiKey && out.databaseURL ? out : null;
}
export function encodeConfig(cfg) {
  const keep = { apiKey: cfg.apiKey, authDomain: cfg.authDomain, databaseURL: cfg.databaseURL, projectId: cfg.projectId, appId: cfg.appId };
  return btoa(JSON.stringify(keep)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeConfig(s) {
  try { const b = s.replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(atob(b + '==='.slice((b.length + 3) % 4))); } catch (e) { return null; }
}
function pickConfig() {
  if (FILE_CFG && FILE_CFG.apiKey && !/REMPLIR/.test(FILE_CFG.apiKey) && FILE_CFG.databaseURL) return FILE_CFG;
  const q = new URLSearchParams(location.search).get('c');
  if (q) { const c = decodeConfig(q); if (c && c.apiKey) { try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (e) {} return c; } }
  try { const c = JSON.parse(localStorage.getItem(CFG_KEY)); if (c && c.apiKey) return c; } catch (e) {}
  return null;
}
const clean = v => v === undefined ? null : JSON.parse(JSON.stringify(v));

// Réseau de test : plusieurs onglets du même navigateur se parlent (?test=1 ou config { mock: true }).
function mockNet() {
  const ch = new BroadcastChannel('tdc-mocknet'); let tree = {}; const subs = [];
  const uid = sessionStorage.getItem('mock-uid') || ('u' + Math.random().toString(36).slice(2, 9)); sessionStorage.setItem('mock-uid', uid);
  const parts = p => p.split('/').filter(Boolean);
  const getP = p => parts(p).reduce((o, k) => (o == null ? undefined : o[k]), tree);
  const setP = (p, v) => { const ks = parts(p); if (!ks.length) { tree = v || {}; return; } let o = tree;
    for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null || typeof o[ks[i]] !== 'object') o[ks[i]] = {}; o = o[ks[i]]; }
    if (v == null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = clean(v); };
  const fire = () => subs.forEach(s => { const v = getP(s.p) ?? null, j = JSON.stringify(v); if (j !== s.last) { s.last = j; s.cb(v); } });
  const apply = m => { if (m.op === 'set') setP(m.p, m.v); if (m.op === 'update') Object.entries(m.v).forEach(([k, v]) => setP(m.p + '/' + k, v)); if (m.op === 'full') tree = m.v; fire(); };
  let synced = false;
  ch.onmessage = e => { const m = e.data; if (m.op === 'hello') { ch.postMessage({ op: 'full', v: tree }); return; } if (m.op === 'full') { if (synced || !m.v || !Object.keys(m.v).length) return; synced = true; } apply(m); };
  ch.postMessage({ op: 'hello' });
  setTimeout(() => { synced = true; }, 1500);
  const send = m => { apply(m); ch.postMessage(clean(m)); return Promise.resolve(); };
  return { ready: true, mock: true, uid,
    set: (p, v) => send({ op: 'set', p, v: clean(v) }), update: (p, v) => send({ op: 'update', p, v: clean(v) }), remove: p => send({ op: 'set', p, v: null }),
    get: p => Promise.resolve(getP(p) ?? null),
    on: (p, cb) => { const s = { p, cb, last: undefined }; subs.push(s); setTimeout(() => { if (!subs.includes(s)) return; s.last = JSON.stringify(getP(p) ?? null); cb(getP(p) ?? null); }, 0); return () => { const i = subs.indexOf(s); if (i >= 0) subs.splice(i, 1); }; },
    push: (p, v) => { const k = 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); send({ op: 'set', p: p + '/' + k, v: clean(v) }); return k; },
    onDisconnectSet: () => {}, onConn: cb => { setTimeout(() => cb(true), 0); return () => {}; }, parseConfig, encodeConfig, config: { mock: true } };
}

async function start() {
  const test = new URLSearchParams(location.search).has('test') || (FILE_CFG && FILE_CFG.mock);
  if (test) { window.NET = mockNet(); window.dispatchEvent(new Event('net-ready')); return; }
  const cfg = pickConfig();
  if (!cfg) { window.NET = { ready: false, reason: 'config', parseConfig, encodeConfig, saveConfig: c => localStorage.setItem(CFG_KEY, JSON.stringify(c)) }; window.dispatchEvent(new Event('net-ready')); return; }
  try {
    const [{ initializeApp }, A, D] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-database.js`)]);
    const app = initializeApp(cfg), auth = A.getAuth(app), db = D.getDatabase(app);
    await A.signInAnonymously(auth);
    const uid = auth.currentUser.uid, R = p => D.ref(db, p);
    window.NET = { ready: true, uid, config: cfg,
      set: (p, v) => D.set(R(p), clean(v)), update: (p, v) => D.update(R(p), clean(v)), remove: p => D.remove(R(p)),
      get: p => D.get(R(p)).then(s => s.val()),
      on: (p, cb) => D.onValue(R(p), s => cb(s.val()), err => console.warn('Lecture refusée', p, err)),
      push: (p, v) => { const r = D.push(R(p)); D.set(r, clean(v)); return r.key; },
      onDisconnectSet: (p, v) => D.onDisconnect(R(p)).set(v),
      onConn: cb => D.onValue(D.ref(db, '.info/connected'), s => cb(!!s.val())),
      parseConfig, encodeConfig, saveConfig: c => localStorage.setItem(CFG_KEY, JSON.stringify(c)) };
  } catch (e) {
    console.error(e);
    window.NET = { ready: false, reason: 'erreur', error: String(e && e.message || e), parseConfig, encodeConfig, saveConfig: c => localStorage.setItem(CFG_KEY, JSON.stringify(c)) };
  }
  window.dispatchEvent(new Event('net-ready'));
}
start();
