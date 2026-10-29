// Connexion en direct pour navigateurs anciens (TV) : Firebase 8 (scripts classiques).
(function () {
    var CFG_KEY = 'tdc-firebase-config';
    function parseConfig(text) { var out = {}; String(text || '').replace(/(\w+)\s*:\s*["']([^"']+)["']/g, function (m, k, v) { out[k] = v; return m; }); return out.apiKey && out.databaseURL ? out : null; }
    function encodeConfig(cfg) { var keep = { apiKey: cfg.apiKey, authDomain: cfg.authDomain, databaseURL: cfg.databaseURL, projectId: cfg.projectId, appId: cfg.appId }; return btoa(JSON.stringify(keep)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
    function decodeConfig(s) { try {
        var b = s.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(b + '==='.slice((b.length + 3) % 4)));
    }
    catch (e) {
        return null;
    } }
    var clean = function (v) { return v === undefined ? null : JSON.parse(JSON.stringify(v)); };
    var Q = function (k) { var m = new RegExp('[?&]' + k + '(=([^&#]*))?').exec(location.search); return m ? (m[2] != null ? decodeURIComponent(m[2]) : '') : null; };
    function mockNet() {
        var ch = new BroadcastChannel('tdc-mocknet'), tree = {}, subs = [];
        var uid = sessionStorage.getItem('mock-uid') || ('u' + Math.random().toString(36).slice(2, 9));
        sessionStorage.setItem('mock-uid', uid);
        var parts = function (p) { return p.split('/').filter(Boolean); };
        var getP = function (p) { return parts(p).reduce(function (o, k) { return o == null ? undefined : o[k]; }, tree); };
        var setP = function (p, v) { var ks = parts(p); if (!ks.length) {
            tree = v || {};
            return;
        } var o = tree; for (var i = 0; i < ks.length - 1; i++) {
            if (o[ks[i]] == null || typeof o[ks[i]] !== 'object')
                o[ks[i]] = {};
            o = o[ks[i]];
        } if (v == null)
            delete o[ks[ks.length - 1]];
        else
            o[ks[ks.length - 1]] = clean(v); };
        var val = function (p) { var v = getP(p); return v === undefined ? null : v; };
        var fire = function () { subs.forEach(function (s) { var v = val(s.p), j = JSON.stringify(v); if (j !== s.last) {
            s.last = j;
            s.cb(v);
        } }); };
        var apply = function (m) { if (m.op === 'set')
            setP(m.p, m.v); if (m.op === 'update')
            Object.keys(m.v).forEach(function (k) { setP(m.p + '/' + k, m.v[k]); }); if (m.op === 'full')
            tree = m.v; fire(); };
        var synced = false;
        ch.onmessage = function (e) { var m = e.data; if (m.op === 'hello') {
            ch.postMessage({ op: 'full', v: tree });
            return;
        } if (m.op === 'full') {
            if (synced || !m.v || !Object.keys(m.v).length)
                return;
            synced = true;
        } apply(m); };
        ch.postMessage({ op: 'hello' });
        var send = function (m) { apply(m); ch.postMessage(clean(m)); return Promise.resolve(); };
        return { ready: true, mock: true, uid: uid,
            set: function (p, v) { return send({ op: 'set', p: p, v: clean(v) }); }, update: function (p, v) { return send({ op: 'update', p: p, v: clean(v) }); }, remove: function (p) { return send({ op: 'set', p: p, v: null }); },
            get: function (p) { return Promise.resolve(val(p)); },
            on: function (p, cb) { var s = { p: p, cb: cb, last: undefined }; subs.push(s); setTimeout(function () { if (subs.indexOf(s) < 0)
                return; s.last = JSON.stringify(val(p)); cb(val(p)); }, 0); return function () { var i = subs.indexOf(s); if (i >= 0)
                subs.splice(i, 1); }; },
            push: function (p, v) { var k = 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); send({ op: 'set', p: p + '/' + k, v: clean(v) }); return k; },
            onDisconnectSet: function () { }, parseConfig: parseConfig, encodeConfig: encodeConfig, config: { mock: true } };
    }
    function load(src) { return new Promise(function (ok, ko) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); }); }
    function done() { window.dispatchEvent(new Event('net-ready')); }
    function fail(reason, err) { window.NET = { ready: false, reason: reason, error: String(err && err.message || err || ''), parseConfig: parseConfig, encodeConfig: encodeConfig, saveConfig: function (c) { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } }; done(); }
    if (Q('test') !== null) {
        window.NET = mockNet();
        done();
        return;
    }
    var fileCfg = fetch('firebase-config.js').then(function (r) { return r.text(); }).then(function (t) { var c = parseConfig(t); return c && !/REMPLIR/.test(c.apiKey) ? c : null; }).catch(function () { return null; });
    fileCfg.then(function (cfg) {
        if (!cfg) {
            var q = Q('c');
            if (q) {
                var d = decodeConfig(q);
                if (d && d.apiKey)
                    cfg = d;
            }
        }
        if (!cfg) {
            try {
                var l = JSON.parse(localStorage.getItem(CFG_KEY));
                if (l && l.apiKey)
                    cfg = l;
            }
            catch (e) { }
        }
        if (!cfg) {
            fail('config');
            return;
        }
        var V = '8.10.1';
        load('https://www.gstatic.com/firebasejs/' + V + '/firebase-app.js').then(function () { return load('https://www.gstatic.com/firebasejs/' + V + '/firebase-auth.js'); }).then(function () { return load('https://www.gstatic.com/firebasejs/' + V + '/firebase-database.js'); })
            .then(function () { firebase.initializeApp(cfg); return firebase.auth().signInAnonymously(); }).then(function () {
            var db = firebase.database(), uid = firebase.auth().currentUser.uid, R = function (p) { return db.ref(p); };
            window.NET = { ready: true, uid: uid, config: cfg,
                set: function (p, v) { return R(p).set(clean(v)); }, update: function (p, v) { return R(p).update(clean(v)); }, remove: function (p) { return R(p).remove(); },
                get: function (p) { return R(p).once('value').then(function (s) { return s.val(); }); },
                on: function (p, cb) { var r = R(p), h = function (s) { cb(s.val()); }; r.on('value', h, function (err) { console.warn('Lecture refusée', p, err); }); return function () { r.off('value', h); }; },
                push: function (p, v) { var r = R(p).push(); r.set(clean(v)); return r.key; },
                onDisconnectSet: function (p, v) { return R(p).onDisconnect().set(v); },
                parseConfig: parseConfig, encodeConfig: encodeConfig, saveConfig: function (c) { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } };
            done();
        }).catch(function (e) { console.error(e); fail('erreur', e); });
    });
})();
