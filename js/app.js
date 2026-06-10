/* ═══════════════════════════════════════════════════════════════════
   THE PRAYER REALM — engine
   Auth, live data, the altar, the watch (live world map),
   private words (messages), and the atmosphere of the realm.

   Two modes, same experience:
   • LIVE — Firebase configured in js/config.js → Google login,
     real-time shared database, protected by firestore.rules.
   • DEMO — no Firebase yet → everything works on this device only.
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

const CFG = window.REALM_CONFIG || { firebase: {}, adminEmails: [], shopUrl: '#', brand: 'KingdomCovers' };

/* ── tiny DOM helpers ─────────────────────────────────────────────── */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') n.className = v;
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k in n && k !== 'list') { try { n[k] = v; } catch { n.setAttribute(k, v); } }
    else n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(kid)); // text nodes only → XSS-safe
  }
  return n;
}

/* hand-forged icon (SVG sprite reference) — the realm uses no emoji */
function icon(name, cls = 'icon') {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('class', cls);
  const u = document.createElementNS(SVG_NS, 'use');
  u.setAttribute('href', '#i-' + name);
  s.append(u);
  return s;
}

function timeAgo(ms) {
  if (!ms) return 'just now';
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function toast(msg, kind = '') {
  const t = el('div', { class: `toast ${kind}` }, msg);
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 4200);
}

function tween(node, to) {
  const from = parseInt(node.dataset.v || '0', 10);
  if (from === to) return;
  node.dataset.v = to;
  const t0 = performance.now(), dur = 700;
  (function step(t) {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    node.textContent = Math.round(from + (to - from) * e).toLocaleString();
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}

/* ── realm constants ──────────────────────────────────────────────── */
const CATS = {
  healing:    { label: 'Healing',    icon: 'pulse' },
  family:     { label: 'Family',     icon: 'home' },
  faith:      { label: 'Faith',      icon: 'cross' },
  finances:   { label: 'Provision',  icon: 'wheat' },
  protection: { label: 'Protection', icon: 'shield' },
  guidance:   { label: 'Guidance',   icon: 'compass' },
  praise:     { label: 'Praise',     icon: 'crown' },
  other:      { label: 'Other',      icon: 'dove' },
};
const REACTS = { love: 'heart', dove: 'dove', cross: 'cross', fire: 'flame' };
const EMPTY_REACTIONS = () => ({ love: [], dove: [], cross: [], fire: [] });

const VERSES = [
  { t: '“Cast all your anxiety on Him because He cares for you.”', r: '1 Peter 5:7' },
  { t: '“Come to me, all you who are weary and burdened, and I will give you rest.”', r: 'Matthew 11:28' },
  { t: '“The prayer of a righteous person is powerful and effective.”', r: 'James 5:16' },
  { t: '“For where two or three gather in my name, there am I with them.”', r: 'Matthew 18:20' },
  { t: '“Do not be anxious about anything, but in every situation, by prayer and petition, present your requests to God.”', r: 'Philippians 4:6' },
  { t: '“Carry each other’s burdens, and in this way you will fulfill the law of Christ.”', r: 'Galatians 6:2' },
  { t: '“Call to me and I will answer you and tell you great and unsearchable things you do not know.”', r: 'Jeremiah 33:3' },
  { t: '“The LORD is near to all who call on him, to all who call on him in truth.”', r: 'Psalm 145:18' },
];

/* coarse timezone → coordinates, the no-permission fallback for the map */
const TZ_COORDS = {
  'America/New_York': [40.7, -74], 'America/Chicago': [41.9, -87.6], 'America/Denver': [39.7, -105],
  'America/Phoenix': [33.4, -112], 'America/Los_Angeles': [34.1, -118.2], 'America/Anchorage': [61.2, -149.9],
  'America/Toronto': [43.7, -79.4], 'America/Vancouver': [49.3, -123.1], 'America/Mexico_City': [19.4, -99.1],
  'America/Bogota': [4.7, -74.1], 'America/Lima': [-12, -77], 'America/Sao_Paulo': [-23.5, -46.6],
  'America/Argentina/Buenos_Aires': [-34.6, -58.4], 'America/Santiago': [-33.4, -70.7],
  'Europe/London': [51.5, -.1], 'Europe/Dublin': [53.3, -6.3], 'Europe/Paris': [48.9, 2.3],
  'Europe/Madrid': [40.4, -3.7], 'Europe/Lisbon': [38.7, -9.1], 'Europe/Berlin': [52.5, 13.4],
  'Europe/Rome': [41.9, 12.5], 'Europe/Amsterdam': [52.4, 4.9], 'Europe/Stockholm': [59.3, 18.1],
  'Europe/Oslo': [59.9, 10.8], 'Europe/Warsaw': [52.2, 21], 'Europe/Athens': [38, 23.7],
  'Europe/Kyiv': [50.5, 30.5], 'Europe/Moscow': [55.8, 37.6], 'Europe/Istanbul': [41, 28.9],
  'Africa/Lagos': [6.5, 3.4], 'Africa/Cairo': [30, 31.2], 'Africa/Nairobi': [-1.3, 36.8],
  'Africa/Johannesburg': [-26.2, 28], 'Africa/Accra': [5.6, -.2],
  'Asia/Jerusalem': [31.8, 35.2], 'Asia/Dubai': [25.2, 55.3], 'Asia/Riyadh': [24.7, 46.7],
  'Asia/Karachi': [24.9, 67], 'Asia/Kolkata': [19.1, 72.9], 'Asia/Dhaka': [23.8, 90.4],
  'Asia/Bangkok': [13.8, 100.5], 'Asia/Jakarta': [-6.2, 106.8], 'Asia/Singapore': [1.35, 103.8],
  'Asia/Manila': [14.6, 121], 'Asia/Hong_Kong': [22.3, 114.2], 'Asia/Shanghai': [31.2, 121.5],
  'Asia/Seoul': [37.6, 127], 'Asia/Tokyo': [35.7, 139.7],
  'Australia/Sydney': [-33.9, 151.2], 'Australia/Melbourne': [-37.8, 145], 'Australia/Perth': [-32, 115.9],
  'Pacific/Auckland': [-36.8, 174.8], 'Pacific/Honolulu': [21.3, -157.9],
};

/* ── state ────────────────────────────────────────────────────────── */
const state = {
  user: null,
  prayers: [],
  filter: 'all',
  sort: 'new',
  openComments: new Set(),
  commentsCache: new Map(),
  commentUnsubs: new Map(),
  souls: [],                       // live presence
  geo: null,                       // {mode:'on'|'off', lat, lng}
  dm: { threads: [], openId: null, other: null, msgs: [], unsubMsgs: null },
  loaded: false,
};

let backend = null;

try { state.geo = JSON.parse(localStorage.getItem('realm.geo')) || { mode: 'off' }; }
catch { state.geo = { mode: 'off' }; }

/* ═══════════════════════════════════════════════════════════════════
   BACKEND · DEMO (localStorage)
   ═══════════════════════════════════════════════════════════════════ */

function makeLocalBackend() {
  const KEY = 'prayerRealm.v2';
  const USER_KEY = 'prayerRealm.user.v1';
  const now = Date.now();

  const seed = {
    prayers: [
      { id: 'seed-1', uid: 'keeper', name: 'The Realm Keeper', photo: null, anonymous: false,
        text: 'Welcome to the Prayer Realm, saint. Lay whatever you are carrying on this altar — and take a moment to lift up someone else while you are here. This is a demo prayer; yours will appear above it.',
        category: 'faith', createdAt: now - 86400000 * 2, prayedBy: ['a', 'b', 'c'], prayedCount: 3,
        reactions: { love: ['a'], dove: ['b'], cross: ['c'], fire: [] }, answered: false, flags: [],
        commentCount: 1, loc: { lat: 36.2, lng: -86.8 } },
      { id: 'seed-2', uid: 'keeper', name: 'The Realm Keeper', photo: null, anonymous: true,
        text: 'Praying for every single person who finds this place. May you feel Him closer than your own breath.',
        category: 'praise', createdAt: now - 86400000 * 5, prayedBy: ['a'], prayedCount: 1,
        reactions: { love: [], dove: ['a'], cross: [], fire: ['b'] }, answered: true, flags: [],
        commentCount: 0, loc: { lat: 31.8, lng: 35.2 } },
    ],
    comments: { 'seed-1': [
      { id: 'c1', uid: 'keeper', name: 'The Realm Keeper', photo: null, anonymous: false,
        text: 'Standing with you in prayer.', createdAt: now - 86400000 },
    ] },
    dms: {},
  };

  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)) || seed; } catch { db = seed; }
  db.dms = db.dms || {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* storage full */ } };

  let user = null;
  try { user = JSON.parse(localStorage.getItem(USER_KEY)); } catch { user = null; }

  const userCbs = [], prayerCbs = [], soulCbs = [], threadCbs = [];
  const emitUser = () => userCbs.forEach(cb => cb(user));
  const emitPrayers = () => { save(); prayerCbs.forEach(cb => cb([...db.prayers])); };
  const commentCbs = new Map();
  const emitComments = id => { save(); (commentCbs.get(id) || []).forEach(cb => cb([...(db.comments[id] || [])])); };
  const msgCbs = new Map();
  const emitMsgs = id => { save(); (msgCbs.get(id) || []).forEach(cb => cb([...(db.dms[id]?.msgs || [])])); };
  const emitThreads = () => { save(); threadCbs.forEach(cb => cb(Object.values(db.dms).map(t => ({ ...t, msgs: undefined })))); };
  const uidGen = p => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* a handful of souls keeping watch, so the map breathes in demo */
  const demoSouls = [
    { uid: 'w1', name: 'A Saint in Nashville', photo: null, lat: 36.2, lng: -86.8 },
    { uid: 'w2', name: 'A Saint in Jerusalem', photo: null, lat: 31.8, lng: 35.2 },
    { uid: 'w3', name: 'A Saint in Lagos', photo: null, lat: 6.5, lng: 3.4 },
    { uid: 'w4', name: 'A Saint in Manila', photo: null, lat: 14.6, lng: 121 },
    { uid: 'w5', name: 'A Saint in São Paulo', photo: null, lat: -23.5, lng: -46.6 },
  ].map(s => ({ ...s, lastSeen: Date.now() }));
  let ownPresence = null;
  const emitSouls = () => soulCbs.forEach(cb =>
    cb([...demoSouls, ...(ownPresence ? [ownPresence] : [])].map(s => ({ ...s, lastSeen: Date.now() }))));

  return {
    isDemo: true,

    onUser(cb) { userCbs.push(cb); cb(user); },
    async signIn() {
      user = { uid: 'demo-' + Math.random().toString(36).slice(2, 8), name: 'Guest Saint',
               email: 'guest@demo', photo: null, admin: true };
      try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch {}
      emitUser();
      toast('Demo sign-in — connect Firebase (SETUP.md) for real Google login.', 'gold');
    },
    async signOut() { user = null; localStorage.removeItem(USER_KEY); ownPresence = null; emitUser(); emitSouls(); },

    onPrayers(cb) { prayerCbs.push(cb); cb([...db.prayers]); },
    async addPrayer({ text, category, anonymous, loc }) {
      db.prayers.unshift({
        id: uidGen('p'), uid: user.uid, name: user.name, photo: user.photo, anonymous,
        text, category, createdAt: Date.now(), prayedBy: [], prayedCount: 0,
        reactions: EMPTY_REACTIONS(), answered: false, flags: [], commentCount: 0,
        ...(loc ? { loc } : {}),
      });
      emitPrayers();
    },
    async prayFor(id) {
      const p = db.prayers.find(p => p.id === id);
      if (!p || p.prayedBy.includes(user.uid)) return;
      p.prayedBy.push(user.uid); p.prayedCount = p.prayedBy.length;
      emitPrayers();
    },
    async toggleReact(id, key, on) {
      const p = db.prayers.find(p => p.id === id); if (!p) return;
      p.reactions[key] = p.reactions[key] || [];
      const i = p.reactions[key].indexOf(user.uid);
      if (on && i < 0) p.reactions[key].push(user.uid);
      if (!on && i >= 0) p.reactions[key].splice(i, 1);
      emitPrayers();
    },
    onComments(id, cb) {
      if (!commentCbs.has(id)) commentCbs.set(id, new Set());
      commentCbs.get(id).add(cb);
      cb([...(db.comments[id] || [])]);
      return () => commentCbs.get(id)?.delete(cb);
    },
    async addComment(id, { text, anonymous }) {
      (db.comments[id] = db.comments[id] || []).push({
        id: uidGen('c'), uid: user.uid, name: user.name, photo: user.photo, anonymous,
        text, createdAt: Date.now(),
      });
      const p = db.prayers.find(p => p.id === id);
      if (p) p.commentCount = (p.commentCount || 0) + 1;
      emitComments(id); emitPrayers();
    },
    async deleteComment(prayerId, commentId) {
      db.comments[prayerId] = (db.comments[prayerId] || []).filter(c => c.id !== commentId);
      const p = db.prayers.find(p => p.id === prayerId);
      if (p) p.commentCount = Math.max(0, (p.commentCount || 0) - 1);
      emitComments(prayerId); emitPrayers();
    },
    async markAnswered(id, answered) {
      const p = db.prayers.find(p => p.id === id); if (!p) return;
      p.answered = answered; emitPrayers();
    },
    async deletePrayer(id) {
      db.prayers = db.prayers.filter(p => p.id !== id);
      delete db.comments[id];
      emitPrayers();
    },
    async flagPrayer(id) {
      const p = db.prayers.find(p => p.id === id); if (!p) return;
      p.flags = p.flags || [];
      if (!p.flags.includes(user.uid)) p.flags.push(user.uid);
      emitPrayers();
    },
    async totalPrayers() { return db.prayers.length; },

    /* presence */
    onSouls(cb) { soulCbs.push(cb); emitSouls(); },
    async setPresence({ lat, lng }) {
      if (!user) return;
      ownPresence = { uid: user.uid, name: user.name, photo: user.photo,
                      lat: lat ?? null, lng: lng ?? null, lastSeen: Date.now() };
      emitSouls();
    },

    /* private words */
    onThreads(cb) { threadCbs.push(cb); emitThreads(); return () => {}; },
    async ensureThread(other) {
      const id = [user.uid, other.uid].sort().join('_');
      if (!db.dms[id]) {
        db.dms[id] = { id, users: [user.uid, other.uid].sort(),
          names: { [user.uid]: user.name, [other.uid]: other.name },
          photos: { [user.uid]: user.photo, [other.uid]: other.photo || null },
          lastText: '', lastFrom: '', updatedAt: Date.now(), readAt: {}, msgs: [] };
        emitThreads();
      }
      return id;
    },
    onMessages(id, cb) {
      if (!msgCbs.has(id)) msgCbs.set(id, new Set());
      msgCbs.get(id).add(cb);
      cb([...(db.dms[id]?.msgs || [])]);
      return () => msgCbs.get(id)?.delete(cb);
    },
    async sendMessage(id, text) {
      const t = db.dms[id]; if (!t) return;
      t.msgs.push({ id: uidGen('m'), from: user.uid, text, createdAt: Date.now() });
      t.lastText = text.slice(0, 90); t.lastFrom = user.uid; t.updatedAt = Date.now();
      t.readAt[user.uid] = Date.now();
      emitMsgs(id); emitThreads();
    },
    async markRead(id) {
      const t = db.dms[id]; if (!t) return;
      t.readAt[user.uid] = Date.now() + 1; emitThreads();
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════
   BACKEND · LIVE (Firebase: Google Auth + Firestore)
   ═══════════════════════════════════════════════════════════════════ */

async function makeFirebaseBackend() {
  const V = '10.12.2';
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
  ]);

  const app  = initializeApp(CFG.firebase);
  const auth = A.getAuth(app);
  const db   = F.getFirestore(app);
  const provider = new A.GoogleAuthProvider();

  const isAdminEmail = email => (CFG.adminEmails || []).map(e => e.toLowerCase()).includes((email || '').toLowerCase());
  const tsToMs = ts => (ts && typeof ts.toMillis === 'function') ? ts.toMillis() : Date.now();

  A.getRedirectResult(auth).catch(() => {});

  const normalize = d => {
    const x = d.data();
    return {
      id: d.id, uid: x.uid, name: x.name || 'A Saint', photo: x.photo || null,
      anonymous: !!x.anonymous, text: x.text || '', category: x.category || 'other',
      createdAt: tsToMs(x.createdAt), prayedBy: x.prayedBy || [],
      prayedCount: x.prayedCount || 0,
      reactions: { ...EMPTY_REACTIONS(), ...(x.reactions || {}) },
      answered: !!x.answered, flags: x.flags || [], commentCount: x.commentCount || 0,
      loc: (x.loc && typeof x.loc.lat === 'number') ? { lat: x.loc.lat, lng: x.loc.lng } : null,
    };
  };

  return {
    isDemo: false,

    onUser(cb) {
      A.onAuthStateChanged(auth, u => {
        cb(u ? { uid: u.uid, name: u.displayName || 'A Saint', email: u.email,
                 photo: u.photoURL, admin: isAdminEmail(u.email) } : null);
      });
    },
    async signIn() {
      try {
        await A.signInWithPopup(auth, provider);
      } catch (e) {
        if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-closed-by-user'
                  || e.code === 'auth/operation-not-supported-in-this-environment'
                  || e.code === 'auth/cancelled-popup-request')) {
          await A.signInWithRedirect(auth, provider);
        } else {
          console.error(e);
          toast('Sign-in failed. If you are inside the TikTok app, open this page in Safari or Chrome.', 'rose');
        }
      }
    },
    async signOut() { await A.signOut(auth); },

    onPrayers(cb) {
      const q = F.query(F.collection(db, 'prayers'), F.orderBy('createdAt', 'desc'), F.limit(150));
      F.onSnapshot(q, snap => cb(snap.docs.map(normalize)),
        err => { console.error(err); toast('Could not reach the altar — check your connection.', 'rose'); });
    },
    async addPrayer({ text, category, anonymous, loc }) {
      const u = auth.currentUser;
      await F.addDoc(F.collection(db, 'prayers'), {
        uid: u.uid, name: u.displayName || 'A Saint', photo: u.photoURL || null,
        anonymous, text, category, createdAt: F.serverTimestamp(),
        prayedBy: [], prayedCount: 0, reactions: EMPTY_REACTIONS(),
        answered: false, flags: [], commentCount: 0,
        ...(loc ? { loc } : {}),
      });
    },
    async prayFor(id) {
      await F.updateDoc(F.doc(db, 'prayers', id), {
        prayedBy: F.arrayUnion(auth.currentUser.uid),
        prayedCount: F.increment(1),
      });
    },
    async toggleReact(id, key, on) {
      await F.updateDoc(F.doc(db, 'prayers', id), {
        [`reactions.${key}`]: on ? F.arrayUnion(auth.currentUser.uid) : F.arrayRemove(auth.currentUser.uid),
      });
    },
    onComments(id, cb) {
      const q = F.query(F.collection(db, 'prayers', id, 'comments'), F.orderBy('createdAt', 'asc'), F.limit(100));
      return F.onSnapshot(q, snap => cb(snap.docs.map(d => {
        const x = d.data();
        return { id: d.id, uid: x.uid, name: x.name || 'A Saint', photo: x.photo || null,
                 anonymous: !!x.anonymous, text: x.text || '', createdAt: tsToMs(x.createdAt) };
      })), err => console.error(err));
    },
    async addComment(id, { text, anonymous }) {
      const u = auth.currentUser;
      await F.addDoc(F.collection(db, 'prayers', id, 'comments'), {
        uid: u.uid, name: u.displayName || 'A Saint', photo: u.photoURL || null,
        anonymous, text, createdAt: F.serverTimestamp(),
      });
      await F.updateDoc(F.doc(db, 'prayers', id), { commentCount: F.increment(1) }).catch(() => {});
    },
    async deleteComment(prayerId, commentId) {
      await F.deleteDoc(F.doc(db, 'prayers', prayerId, 'comments', commentId));
      await F.updateDoc(F.doc(db, 'prayers', prayerId), { commentCount: F.increment(-1) }).catch(() => {});
    },
    async markAnswered(id, answered) {
      await F.updateDoc(F.doc(db, 'prayers', id), {
        answered, answeredAt: answered ? F.serverTimestamp() : null,
      });
    },
    async deletePrayer(id) {
      try {
        const snap = await F.getDocs(F.query(F.collection(db, 'prayers', id, 'comments'), F.limit(200)));
        await Promise.all(snap.docs.map(d => F.deleteDoc(d.ref)));
      } catch { /* ignore */ }
      await F.deleteDoc(F.doc(db, 'prayers', id));
    },
    async flagPrayer(id) {
      await F.updateDoc(F.doc(db, 'prayers', id), { flags: F.arrayUnion(auth.currentUser.uid) });
    },
    async totalPrayers() {
      try {
        const c = await F.getCountFromServer(F.collection(db, 'prayers'));
        return c.data().count;
      } catch { return null; }
    },

    /* presence — each signed-in soul keeps a single small doc alive */
    onSouls(cb) {
      const q = F.query(F.collection(db, 'presence'), F.orderBy('lastSeen', 'desc'), F.limit(300));
      F.onSnapshot(q, snap => cb(snap.docs.map(d => {
        const x = d.data();
        return { uid: d.id, name: x.name || 'A Saint', photo: x.photo || null,
                 lat: typeof x.lat === 'number' ? x.lat : null,
                 lng: typeof x.lng === 'number' ? x.lng : null,
                 lastSeen: tsToMs(x.lastSeen) };
      })), err => console.error(err));
    },
    async setPresence({ lat, lng }) {
      const u = auth.currentUser; if (!u) return;
      await F.setDoc(F.doc(db, 'presence', u.uid), {
        uid: u.uid, name: u.displayName || 'A Saint', photo: u.photoURL || null,
        lat: lat ?? null, lng: lng ?? null, lastSeen: F.serverTimestamp(),
      }).catch(() => {});
    },

    /* private words */
    onThreads(cb) {
      const u = auth.currentUser; if (!u) return () => {};
      const q = F.query(F.collection(db, 'dms'), F.where('users', 'array-contains', u.uid), F.limit(60));
      return F.onSnapshot(q, snap => cb(snap.docs.map(d => {
        const x = d.data();
        const readAt = {};
        for (const [k, v] of Object.entries(x.readAt || {})) readAt[k] = tsToMs(v);
        return { id: d.id, users: x.users || [], names: x.names || {}, photos: x.photos || {},
                 lastText: x.lastText || '', lastFrom: x.lastFrom || '',
                 updatedAt: tsToMs(x.updatedAt), readAt };
      })), err => console.error(err));
    },
    async ensureThread(other) {
      const u = auth.currentUser;
      const users = [u.uid, other.uid].sort();
      const id = users.join('_');
      const ref = F.doc(db, 'dms', id);
      const existing = await F.getDoc(ref).catch(() => null);
      if (!existing || !existing.exists()) {
        await F.setDoc(ref, {
          users,
          names: { [u.uid]: u.displayName || 'A Saint', [other.uid]: other.name || 'A Saint' },
          photos: { [u.uid]: u.photoURL || null, [other.uid]: other.photo || null },
          lastText: '', lastFrom: '', updatedAt: F.serverTimestamp(), readAt: {},
        });
      }
      return id;
    },
    onMessages(id, cb) {
      const q = F.query(F.collection(db, 'dms', id, 'messages'), F.orderBy('createdAt', 'asc'), F.limit(200));
      return F.onSnapshot(q, snap => cb(snap.docs.map(d => {
        const x = d.data();
        return { id: d.id, from: x.from, text: x.text || '', createdAt: tsToMs(x.createdAt) };
      })), err => console.error(err));
    },
    async sendMessage(id, text) {
      const u = auth.currentUser;
      await F.addDoc(F.collection(db, 'dms', id, 'messages'), {
        from: u.uid, text, createdAt: F.serverTimestamp(),
      });
      await F.updateDoc(F.doc(db, 'dms', id), {
        lastText: text.slice(0, 90), lastFrom: u.uid,
        updatedAt: F.serverTimestamp(), [`readAt.${u.uid}`]: F.serverTimestamp(),
      }).catch(() => {});
    },
    async markRead(id) {
      const u = auth.currentUser; if (!u) return;
      await F.updateDoc(F.doc(db, 'dms', id), { [`readAt.${u.uid}`]: F.serverTimestamp() }).catch(() => {});
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════
   THE ALTAR — rendering
   ═══════════════════════════════════════════════════════════════════ */

function avatarNode(photo, anonymous, big = true) {
  const cls = big ? 'pc-avatar' : 'comment-avatar';
  if (anonymous) {
    const n = el('div', { class: `${cls} anon-halo`, title: 'Anonymous' });
    n.append(icon('dove', big ? 'icon' : 'icon sm'));
    return n;
  }
  if (photo) return el('img', { class: cls, src: photo, alt: '', referrerPolicy: 'no-referrer' });
  const n = el('div', { class: `${cls} anon-halo` });
  n.append(icon('cross', big ? 'icon' : 'icon sm'));
  return n;
}

function displayName(p) { return p.anonymous ? 'Anonymous Saint' : p.name; }

function buildFilterChips() {
  const wrap = $('#filterChips');
  wrap.replaceChildren();
  const mk = (key, label, ic, gold = false) => el('button', {
    class: 'chip' + (state.filter === key ? (gold ? ' gold-on' : ' on') : ''),
    onclick: () => { state.filter = key; renderPrayers(); buildFilterChips(); },
  }, icon(ic), label);
  wrap.append(mk('all', 'All', 'spark'));
  if (state.user) wrap.append(mk('mine', 'Mine', 'user'));
  wrap.append(mk('answered', 'Answered', 'check', true));
  for (const [k, c] of Object.entries(CATS)) wrap.append(mk(k, c.label, c.icon));
}

function buildCatPick() {
  const wrap = $('#catPick');
  wrap.replaceChildren();
  for (const [k, c] of Object.entries(CATS)) {
    wrap.append(el('button', {
      class: 'chip', type: 'button',
      onclick: e => {
        wrap.dataset.sel = k;
        $$('.chip', wrap).forEach(x => x.classList.remove('on'));
        e.currentTarget.classList.add('on');
      },
    }, icon(c.icon), c.label));
  }
  wrap.dataset.sel = wrap.dataset.sel || 'other';
  const idx = Object.keys(CATS).indexOf(wrap.dataset.sel);
  if (idx >= 0) $$('.chip', wrap)[idx].classList.add('on');
}

function visiblePrayers() {
  let list = [...state.prayers];
  const f = state.filter;
  if (f === 'mine' && state.user) list = list.filter(p => p.uid === state.user.uid);
  else if (f === 'answered') list = list.filter(p => p.answered);
  else if (f !== 'all') list = list.filter(p => p.category === f);
  if (state.sort === 'amens') list.sort((a, b) => (b.prayedCount - a.prayedCount) || (b.createdAt - a.createdAt));
  else list.sort((a, b) => b.createdAt - a.createdAt);
  return list;
}

function renderPrayers() {
  const grid = $('#prayerGrid');

  if (!state.loaded) {
    grid.replaceChildren(...[0, 1, 2].map(() => {
      const sk = el('div', { class: 'glass skel' }); sk.append(el('i'));
      return sk;
    }));
    return;
  }

  let draft = null;
  const ae = document.activeElement;
  if (ae && ae.classList?.contains('comment-input') && ae.closest('.prayer-card')) {
    draft = { id: ae.closest('.prayer-card').dataset.id, value: ae.value,
              s: ae.selectionStart, e: ae.selectionEnd };
  }

  const list = visiblePrayers();
  grid.replaceChildren(...list.map((p, i) => prayerCard(p, i)));
  $('#emptyWall').hidden = list.length > 0;

  if (draft) {
    const input = grid.querySelector(`.prayer-card[data-id="${draft.id}"] .comment-input`);
    if (input) { input.value = draft.value; input.focus(); try { input.setSelectionRange(draft.s, draft.e); } catch {} }
  }
  updateStats();
}

function prayerCard(p, i) {
  const u = state.user;
  const mine = u && p.uid === u.uid;
  const admin = u && u.admin;
  const prayed = u && p.prayedBy.includes(u.uid);
  const cat = CATS[p.category] || CATS.other;

  const head = el('div', { class: 'pc-head' },
    avatarNode(p.photo, p.anonymous),
    el('div', { class: 'pc-who' },
      el('div', { class: 'pc-name' }, displayName(p)),
      el('div', { class: 'pc-meta' },
        el('span', { class: 'pc-cat' }, icon(cat.icon), cat.label),
        el('time', {}, timeAgo(p.createdAt)),
        admin && p.flags.length
          ? el('span', { class: 'flag-count', title: 'Reported by visitors' }, icon('flag'), String(p.flags.length))
          : null,
      ),
    ),
    p.answered ? el('span', { class: 'answered-badge' }, icon('check'), 'ANSWERED') : null,
  );

  const amenBtn = el('button', {
    class: 'amen-btn' + (prayed ? ' prayed' : ''),
    title: prayed ? 'You have lifted this prayer' : 'Lift this prayer up',
    onclick: async e => {
      if (!u) return needSignIn();
      if (prayed) return;
      const r = e.currentTarget.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top);
      e.currentTarget.classList.add('prayed');
      try { await backend.prayFor(p.id); } catch (err) { console.error(err); }
    },
  }, icon('hands'), prayed ? 'Amen' : 'I prayed',
     el('span', { class: 'cnt' }, p.prayedCount ? String(p.prayedCount) : ''));

  const reactBtns = Object.entries(REACTS).map(([k, ic]) => {
    const on = u && (p.reactions[k] || []).includes(u.uid);
    const n = (p.reactions[k] || []).length;
    return el('button', {
      class: 'react-btn' + (on ? ' on' : ''), title: k,
      onclick: () => {
        if (!u) return needSignIn();
        backend.toggleReact(p.id, k, !on).catch(console.error);
      },
    }, icon(ic), n ? el('span', { class: 'cnt' }, String(n)) : null);
  });

  const isOpen = state.openComments.has(p.id);
  const commentBtn = el('button', {
    class: 'react-btn' + (isOpen ? ' on' : ''), title: 'Words of encouragement',
    onclick: () => toggleComments(p.id),
  }, icon('chat'), p.commentCount ? el('span', { class: 'cnt' }, String(p.commentCount)) : null);

  const tools = el('span', { class: 'pc-tools' });
  if (u && !mine && !p.anonymous) tools.append(el('button', {
    class: 'tool-btn', title: `Send ${p.name} a private word`,
    onclick: () => openWord({ uid: p.uid, name: p.name, photo: p.photo }),
  }, icon('send'), 'Word'));
  if (mine) tools.append(el('button', {
    class: 'tool-btn', title: p.answered ? 'Unmark answered' : 'Mark as answered',
    onclick: () => backend.markAnswered(p.id, !p.answered).then(() => {
      if (!p.answered) toast('Glory! Marked as answered.', 'gold');
    }).catch(console.error),
  }, icon('check'), p.answered ? 'unmark' : 'answered'));
  if (mine || admin) tools.append(el('button', {
    class: 'tool-btn danger', title: 'Remove from the altar',
    onclick: () => {
      if (confirm('Remove this prayer from the altar?'))
        backend.deletePrayer(p.id).then(() => toast('Removed from the altar.')).catch(console.error);
    },
  }, icon('trash')));
  if (u && !mine) tools.append(el('button', {
    class: 'tool-btn danger', title: 'Report to the keeper',
    onclick: () => {
      if (confirm('Report this prayer to the keeper of the realm?'))
        backend.flagPrayer(p.id).then(() => toast('Reported. The keeper will review it.')).catch(console.error);
    },
  }, icon('flag')));

  const card = el('article', {
    class: 'prayer-card glass' + (p.answered ? ' answered span2' : ''),
    dataset: { id: p.id }, style: `animation-delay:${Math.min(i, 8) * 60}ms`,
  },
    head,
    el('p', { class: 'pc-text' }, p.text),
    el('div', { class: 'pc-actions' }, amenBtn, ...reactBtns, commentBtn, tools),
  );

  if (isOpen) card.append(commentsPanel(p));
  return card;
}

/* ── comments ─────────────────────────────────────────────────────── */

function toggleComments(id) {
  if (state.openComments.has(id)) {
    state.openComments.delete(id);
    state.commentUnsubs.get(id)?.();
    state.commentUnsubs.delete(id);
  } else {
    state.openComments.add(id);
    const unsub = backend.onComments(id, list => {
      state.commentsCache.set(id, list);
      const card = $(`.prayer-card[data-id="${id}"]`);
      if (card) {
        const old = card.querySelector('.pc-comments');
        const p = state.prayers.find(p => p.id === id);
        if (old && p) old.replaceWith(commentsPanel(p));
      }
    });
    state.commentUnsubs.set(id, unsub || (() => {}));
  }
  renderPrayers();
}

function commentsPanel(p) {
  const u = state.user;
  const list = state.commentsCache.get(p.id) || [];

  const items = list.map(c => el('div', { class: 'comment' },
    avatarNode(c.photo, c.anonymous, false),
    el('div', { class: 'comment-body' },
      el('div', { class: 'comment-name' },
        c.anonymous ? 'Anonymous Saint' : c.name,
        el('time', {}, timeAgo(c.createdAt))),
      el('div', { class: 'comment-text' }, c.text),
    ),
    (u && (c.uid === u.uid || u.admin || p.uid === u.uid))
      ? el('button', { class: 'tool-btn danger comment-del', title: 'Remove',
          onclick: () => backend.deleteComment(p.id, c.id).catch(console.error) }, icon('x', 'icon sm'))
      : null,
  ));

  let form;
  if (u) {
    const input = el('input', { class: 'comment-input', maxLength: 600,
      placeholder: 'Speak life over them…',
      onkeydown: e => { if (e.key === 'Enter') send(); } });
    const send = async () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      try { await backend.addComment(p.id, { text, anonymous: $('#anonToggle').checked }); }
      catch (err) { console.error(err); toast('Could not send — try again.', 'rose'); }
    };
    form = el('div', { class: 'comment-form' }, input,
      el('button', { class: 'comment-send', title: 'Send encouragement', onclick: send }, icon('send')));
  } else {
    form = el('div', { class: 'comment-hint' }, 'Sign in with Google to speak encouragement over this prayer.');
  }

  return el('div', { class: 'pc-comments' },
    items.length ? items : el('div', { class: 'comment-hint' }, 'Be the first to speak life here.'),
    form);
}

/* ── stats ────────────────────────────────────────────────────────── */

async function updateStats() {
  const amens = state.prayers.reduce((n, p) => n + (p.prayedCount || 0), 0);
  const answered = state.prayers.filter(p => p.answered).length;
  tween($('#statAmens'), amens);
  tween($('#statAnswered'), answered);
  const total = await backend.totalPrayers();
  tween($('#statPrayers'), total == null ? state.prayers.length : total);
}

/* ═══════════════════════════════════════════════════════════════════
   THE WATCH — live world map (dot-matrix earth, beacons of prayer)
   ═══════════════════════════════════════════════════════════════════ */

const Watch = (() => {
  let started = false, cv, cx, W = 0, H = 0;
  let ox = 0, oy = 0, mapW = 0, mapH = 0;   // the world, letterboxed in the stage
  let mask = null;                          // land raster in mercator space
  const MW = 2048; let MH = 0;
  let dots = null;                          // prerendered land-dot layer
  let beacons = [];                         // projected interactive points
  let hover = null;
  let t = 0;

  /* Web Mercator clamped to the inhabited earth — the shapes people know
     from every map app, so the USA looks like the USA. */
  const LAT_TOP = 74, LAT_BOT = -60;
  const merc = lat => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
  const M_TOP = merc(LAT_TOP), M_BOT = merc(LAT_BOT);
  const ASPECT = (2 * Math.PI) / (M_TOP - M_BOT);   // ≈ 1.92 : 1

  const proj01 = (lng, lat) => [
    (lng + 180) / 360,
    (M_TOP - merc(Math.max(LAT_BOT, Math.min(LAT_TOP, lat)))) / (M_TOP - M_BOT),
  ];
  const projPx = (lng, lat) => {
    const [x01, y01] = proj01(lng, lat);
    return [ox + x01 * mapW, oy + y01 * mapH];
  };

  /* Earth landmass ships with the site (js/land.js) — no CDN, no
     ad-blocker failures, renders instantly. */
  function buildMask() {
    if (!window.REALM_LAND) return;
    MH = Math.round(MW / ASPECT);
    const off = el('canvas', { width: MW, height: MH });
    const oc = off.getContext('2d');
    oc.fillStyle = '#fff';
    for (const poly of window.REALM_LAND) {
      oc.beginPath();
      for (const ring of poly) {
        ring.forEach(([lng, lat], i) => {
          const [x01, y01] = proj01(lng, lat);
          i ? oc.lineTo(x01 * MW, y01 * MH) : oc.moveTo(x01 * MW, y01 * MH);
        });
        oc.closePath();
      }
      oc.fill('evenodd');
    }
    mask = oc.getImageData(0, 0, MW, MH);
  }

  function landAt(x01, y01) {
    if (!mask) return false;
    const mx = Math.min(MW - 1, Math.max(0, Math.round(x01 * MW)));
    const my = Math.min(MH - 1, Math.max(0, Math.round(y01 * MH)));
    return mask.data[(my * MW + mx) * 4 + 3] > 100;
  }

  function buildDots() {
    if (!W || !H || !mapW) return;
    dots = el('canvas', { width: W, height: H });
    const dc = dots.getContext('2d');
    const step = Math.max(2.8, mapW / 300);
    const r = Math.max(.8, step * .34);
    for (let y = oy + step / 2; y < oy + mapH; y += step) {
      for (let x = ox + step / 2; x < ox + mapW; x += step) {
        const x01 = (x - ox) / mapW, y01 = (y - oy) / mapH;
        const isLand = mask ? landAt(x01, y01)
          /* veiled-earth fallback: a graticule of faint dots */
          : (Math.abs(y01 * 180 - 90) % 15 < 1.1 || Math.abs(x01 * 360 - 180) % 15 < 1.1);
        if (!isLand) continue;
        const a = mask ? (.25 + Math.random() * .28) : .12;
        dc.fillStyle = `rgba(158, 144, 205, ${a})`;
        dc.beginPath();
        dc.arc(x + (Math.random() - .5) * .8, y + (Math.random() - .5) * .8, r, 0, 7);
        dc.fill();
      }
    }
  }

  function rebuildBeacons() {
    if (!W || !H) return;
    const me = state.user?.uid;
    const fresh = Date.now() - 150000;
    const out = [];
    for (const p of state.prayers) {
      if (!p.loc) continue;
      const [x, y] = projPx(p.loc.lng, p.loc.lat);
      out.push({ x, y, type: 'prayer', id: p.id, label: displayName(p),
                 text: p.text.length > 70 ? p.text.slice(0, 70) + '…' : p.text,
                 phase: (p.id.charCodeAt(p.id.length - 1) || 0) % 7 });
    }
    for (const s of state.souls) {
      if (s.lat == null || s.lastSeen < fresh) continue;
      const [x, y] = projPx(s.lng, s.lat);
      out.push({ x, y, type: s.uid === me ? 'me' : 'soul', id: s.uid,
                 label: s.uid === me ? 'You — keeping watch' : s.name,
                 text: s.uid === me ? '' : 'keeping watch in the realm', phase: x % 7 });
    }
    beacons = out;
  }

  function frame() {
    requestAnimationFrame(frame);
    if (!started || document.hidden || !cx) return;
    t += .016;
    cx.clearRect(0, 0, W, H);
    if (dots) {
      cx.globalAlpha = .85 + Math.sin(t * .6) * .12;
      cx.drawImage(dots, 0, 0);
      cx.globalAlpha = 1;
    }
    /* slow scanning light across the earth */
    const sx = ((t * 26) % (W * 1.6)) - W * .3;
    const grad = cx.createLinearGradient(sx - 130, 0, sx + 130, 0);
    grad.addColorStop(0, 'rgba(243,201,105,0)');
    grad.addColorStop(.5, 'rgba(243,201,105,.05)');
    grad.addColorStop(1, 'rgba(243,201,105,0)');
    cx.fillStyle = grad;
    cx.fillRect(0, 0, W, H);

    for (const b of beacons) {
      const pulse = .5 + .5 * Math.sin(t * 2.2 + b.phase);
      const base = b.type === 'prayer' ? [243, 201, 105] : b.type === 'me' ? [255, 250, 240] : [159, 139, 255];
      const r = (b.type === 'me' ? 4 : 3) + pulse * 1.6 + (hover === b ? 1.5 : 0);
      const g = cx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 4);
      g.addColorStop(0, `rgba(${base[0]},${base[1]},${base[2]},.9)`);
      g.addColorStop(.35, `rgba(${base[0]},${base[1]},${base[2]},.35)`);
      g.addColorStop(1, `rgba(${base[0]},${base[1]},${base[2]},0)`);
      cx.fillStyle = g;
      cx.beginPath(); cx.arc(b.x, b.y, r * 4, 0, 7); cx.fill();
      cx.fillStyle = `rgba(255,255,255,${.75 + pulse * .25})`;
      cx.beginPath(); cx.arc(b.x, b.y, r * .42, 0, 7); cx.fill();
      /* rising ring every few seconds */
      const ring = ((t * .55 + b.phase) % 3);
      if (ring < 1.1) {
        cx.strokeStyle = `rgba(${base[0]},${base[1]},${base[2]},${.4 * (1.1 - ring)})`;
        cx.lineWidth = 1.2;
        cx.beginPath(); cx.arc(b.x, b.y, r + ring * 16, 0, 7); cx.stroke();
      }
    }
  }

  function size() {
    const stage = $('#mapStage');
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = Math.round(rect.width); H = Math.round(rect.height);
    mapW = Math.min(W, H * ASPECT); mapH = mapW / ASPECT;
    ox = (W - mapW) / 2; oy = (H - mapH) / 2;
    cv.width = W * dpr; cv.height = H * dpr;
    cx = cv.getContext('2d');
    cx.scale(dpr, dpr);
    buildDots(); rebuildBeacons();
  }

  function pick(mx, my) {
    let best = null, bd = 18;
    for (const b of beacons) {
      const d = Math.hypot(b.x - mx, b.y - my);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  async function start() {
    if (started) return;
    started = true;
    cv = $('#mapCanvas');
    try { buildMask(); } catch (e) { console.warn('land veiled:', e); }
    $('#mapLoading').classList.add('gone');
    size();
    addEventListener('resize', size);
    const tip = $('#mapTip');
    cv.addEventListener('pointermove', e => {
      const r = cv.getBoundingClientRect();
      hover = pick(e.clientX - r.left, e.clientY - r.top);
      if (hover) {
        tip.hidden = false;
        tip.style.left = hover.x + 'px';
        tip.style.top = hover.y + 'px';
        tip.replaceChildren(el('b', {}, hover.label), el('span', {}, hover.text || ''));
        cv.style.cursor = hover.type === 'prayer' ? 'pointer' : 'crosshair';
      } else { tip.hidden = true; cv.style.cursor = 'crosshair'; }
    });
    cv.addEventListener('pointerleave', () => { hover = null; tip.hidden = true; });
    cv.addEventListener('click', () => {
      if (hover?.type === 'prayer') {
        switchRoom('altar');
        const card = $(`.prayer-card[data-id="${hover.id}"]`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.animate([
            { boxShadow: '0 0 0 rgba(243,201,105,0)' },
            { boxShadow: '0 0 60px rgba(243,201,105,.55)' },
            { boxShadow: '0 0 0 rgba(243,201,105,0)' },
          ], { duration: 1800, easing: 'ease-out' });
        }
      }
    });
    frame();
  }

  return { start, refresh: rebuildBeacons };
})();

/* ── presence: my light on the map ────────────────────────────────── */

let presenceTimer = null;

function saveGeo() { try { localStorage.setItem('realm.geo', JSON.stringify(state.geo)); } catch {} }

function geoLabel() {
  $('#geoBtnLabel').textContent = state.geo.mode === 'on' ? 'Dim my light' : 'Shine my light on the map';
  $('#geoBtn').classList.toggle('lit', state.geo.mode === 'on');
}

async function acquireGeo() {
  const round1 = v => Math.round(v * 10) / 10; // ~11km — city level, never exact
  const fromTz = () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (TZ_COORDS[tz]) return { lat: TZ_COORDS[tz][0], lng: TZ_COORDS[tz][1] };
    } catch {}
    return null;
  };
  const gps = await new Promise(res => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(
      pos => res({ lat: round1(pos.coords.latitude), lng: round1(pos.coords.longitude) }),
      () => res(null), { timeout: 8000, maximumAge: 600000 });
  });
  return gps || fromTz();
}

function beatPresence() {
  if (!state.user || !backend) return;
  const loc = state.geo.mode === 'on' ? { lat: state.geo.lat, lng: state.geo.lng } : { lat: null, lng: null };
  backend.setPresence(loc);
}

function startPresence() {
  stopPresence();
  beatPresence();
  presenceTimer = setInterval(beatPresence, 60000);
}
function stopPresence() { if (presenceTimer) { clearInterval(presenceTimer); presenceTimer = null; } }

function updateSouls() {
  const fresh = Date.now() - 150000;
  const live = state.souls.filter(s => s.lastSeen >= fresh);
  const n = Math.max(1, live.length + (state.user && !live.some(s => s.uid === state.user.uid) ? 1 : 0));
  $('#soulsCount').textContent = String(n);
  Watch.refresh();
}

/* ═══════════════════════════════════════════════════════════════════
   WORDS — private messages between saints
   ═══════════════════════════════════════════════════════════════════ */

let threadsUnsub = null;

function otherOf(t) {
  const me = state.user?.uid;
  const uid = (t.users || []).find(x => x !== me) || '';
  return { uid, name: t.names?.[uid] || 'A Saint', photo: t.photos?.[uid] || null };
}

function threadUnread(t) {
  const me = state.user?.uid;
  return t.lastFrom && t.lastFrom !== me && (!t.readAt?.[me] || t.readAt[me] < t.updatedAt);
}

function renderDmDot() {
  $('#dmDot').hidden = !state.dm.threads.some(threadUnread);
}

function renderThreads() {
  const wrap = $('#dmThreads');
  const list = [...state.dm.threads].sort((a, b) => b.updatedAt - a.updatedAt);
  if (!list.length) {
    wrap.replaceChildren(el('div', { class: 'dm-empty' },
      'No words yet. Open a prayer on the altar and tap "Word" to privately encourage its author.'));
    return;
  }
  wrap.replaceChildren(...list.map(t => {
    const o = otherOf(t);
    const unread = threadUnread(t);
    const av = o.photo
      ? el('img', { src: o.photo, alt: '', referrerPolicy: 'no-referrer' })
      : (() => { const d = el('div', { class: 'anon-halo' }); d.append(icon('cross')); return d; })();
    return el('button', { class: 'dm-thread' + (unread ? ' unread' : ''), onclick: () => openThreadUI(t.id, o) },
      av,
      el('div', { class: 'dm-t-body' },
        el('div', { class: 'dm-t-name' }, o.name, el('time', {}, timeAgo(t.updatedAt))),
        el('div', { class: 'dm-t-last' }, t.lastText || 'Say the first word…'),
      ),
      unread ? el('span', { class: 'dm-unread' }) : null,
    );
  }));
}

function renderMsgs() {
  const wrap = $('#dmMsgs');
  const me = state.user?.uid;
  wrap.replaceChildren(...state.dm.msgs.map(m =>
    el('div', { class: 'dm-msg ' + (m.from === me ? 'mine' : 'theirs') },
      m.text, el('time', {}, timeAgo(m.createdAt)))));
  wrap.scrollTop = wrap.scrollHeight;
}

function openPanel() {
  $('#dmPanel').hidden = false;
  showThreadList();
}
function closePanel() {
  $('#dmPanel').hidden = true;
  closeThreadUI();
}
function showThreadList() {
  closeThreadUI();
  $('#dmTitle').textContent = 'Words';
  $('#dmSub').textContent = 'private encouragement between saints';
  $('#dmBack').hidden = true;
  $('#dmThreads').style.display = '';
  $('#dmConvo').hidden = true;
  renderThreads();
}
function closeThreadUI() {
  state.dm.openId = null;
  state.dm.unsubMsgs?.();
  state.dm.unsubMsgs = null;
  state.dm.msgs = [];
}
function openThreadUI(id, other) {
  closeThreadUI();
  state.dm.openId = id;
  state.dm.other = other;
  $('#dmTitle').textContent = other.name;
  $('#dmSub').textContent = 'a private word';
  $('#dmBack').hidden = false;
  $('#dmThreads').style.display = 'none';
  $('#dmConvo').hidden = false;
  renderMsgs();
  state.dm.unsubMsgs = backend.onMessages(id, list => {
    if (state.dm.openId !== id) return;
    state.dm.msgs = list;
    renderMsgs();
    backend.markRead(id);
  });
  backend.markRead(id);
  setTimeout(() => $('#dmInput').focus(), 60);
}

async function openWord(other) {
  if (!state.user) return needSignIn();
  try {
    const id = await backend.ensureThread(other);
    openPanel();
    openThreadUI(id, other);
  } catch (e) { console.error(e); toast('Could not open the conversation — try again.', 'rose'); }
}

function subscribeThreads() {
  threadsUnsub?.();
  threadsUnsub = null;
  state.dm.threads = [];
  renderDmDot();
  if (!state.user) return;
  threadsUnsub = backend.onThreads(list => {
    state.dm.threads = list;
    renderDmDot();
    if (!$('#dmPanel').hidden && state.dm.openId == null) renderThreads();
  });
}

/* ── auth-dependent chrome ────────────────────────────────────────── */

function renderAuth() {
  const u = state.user;
  const authBtn = $('#authBtn');
  authBtn.replaceChildren(icon('google'), el('span', {}, u ? 'Leave quietly' : 'Enter with Google'));
  $('#userChip').hidden = !u;
  $('#dmBtn').hidden = !u;
  if (u) {
    $('#userName').textContent = u.name;
    const ph = $('#userPhoto');
    if (u.photo) { ph.src = u.photo; ph.style.display = ''; } else ph.style.display = 'none';
  }
  $('#prayerText').disabled = !u;
  $('#submitPrayer').style.display = u ? '' : 'none';
  $('.composer-row.space .anon').style.visibility = u ? 'visible' : 'hidden';
  $('#composerLocked').hidden = !!u;
  buildFilterChips();
  renderPrayers();
  geoLabel();
}

function needSignIn() {
  toast('Enter with Google first, saint.', 'gold');
  $('#authBtn').animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }],
    { duration: 500, easing: 'ease-out' });
}

/* ═══════════════════════════════════════════════════════════════════
   ATMOSPHERE · stars, embers, halo, sparks, ambience
   ═══════════════════════════════════════════════════════════════════ */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

function startSky() {
  if (REDUCED) return;
  const small = innerWidth < 720;

  const sc = $('#skyStars'), sx = sc.getContext('2d');
  let stars = [];
  const seedStars = () => {
    sc.width = innerWidth * devicePixelRatio; sc.height = innerHeight * devicePixelRatio;
    sx.scale(devicePixelRatio, devicePixelRatio);
    stars = Array.from({ length: small ? 80 : 150 }, () => ({
      x: Math.random() * innerWidth, y: Math.random() * innerHeight,
      r: Math.random() * 1.3 + .3, p: Math.random() * Math.PI * 2,
      s: .4 + Math.random() * .9,
    }));
  };

  const ec = $('#skyEmbers'), ex = ec.getContext('2d');
  let embers = [];
  const newEmber = () => ({
    x: Math.random() * innerWidth, y: innerHeight + 20,
    r: Math.random() * 2.2 + .8, v: .18 + Math.random() * .5,
    sway: Math.random() * Math.PI * 2, sa: .3 + Math.random() * .7,
    a: .25 + Math.random() * .5,
  });
  const seedEmbers = () => {
    ec.width = innerWidth * devicePixelRatio; ec.height = innerHeight * devicePixelRatio;
    ex.scale(devicePixelRatio, devicePixelRatio);
    embers = Array.from({ length: small ? 26 : 54 }, () => {
      const e = newEmber(); e.y = Math.random() * innerHeight; return e;
    });
  };

  seedStars(); seedEmbers();
  addEventListener('resize', () => { seedStars(); seedEmbers(); });

  let t = 0;
  (function frame() {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    t += .016;

    sx.clearRect(0, 0, innerWidth, innerHeight);
    for (const s of stars) {
      const tw = .35 + .65 * Math.abs(Math.sin(s.p + t * s.s));
      sx.globalAlpha = tw;
      sx.fillStyle = '#fff6e3';
      sx.beginPath(); sx.arc(s.x, s.y, s.r, 0, 7); sx.fill();
    }

    ex.clearRect(0, 0, innerWidth, innerHeight);
    for (const e of embers) {
      e.y -= e.v; e.sway += .015;
      e.x += Math.sin(e.sway) * e.sa * .4;
      if (e.y < -20) Object.assign(e, newEmber());
      const g = ex.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 3);
      g.addColorStop(0, `rgba(255, 226, 160, ${e.a})`);
      g.addColorStop(1, 'rgba(255, 180, 80, 0)');
      ex.fillStyle = g;
      ex.beginPath(); ex.arc(e.x, e.y, e.r * 3, 0, 7); ex.fill();
    }
  })();
}

function startHalo() {
  if (REDUCED || !matchMedia('(pointer: fine)').matches) return;
  const halo = $('#cursorHalo');
  addEventListener('pointermove', e => {
    halo.style.left = e.clientX + 'px';
    halo.style.top = e.clientY + 'px';
  }, { passive: true });
}

function burst(x, y) {
  if (REDUCED) return;
  for (let i = 0; i < 9; i++) {
    const s = el('span', { class: 'spark' });
    s.append(icon(Math.random() < .3 ? 'dove' : 'spark', 'icon sm'));
    s.style.left = x + (Math.random() * 36 - 18) + 'px';
    s.style.top = y + 'px';
    document.body.append(s);
    s.animate([
      { transform: 'translateY(0) scale(1)', opacity: 1 },
      { transform: `translate(${Math.random() * 40 - 20}px, ${-(90 + Math.random() * 90)}px) scale(.4)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.3,1)' })
      .onfinish = () => s.remove();
  }
}

/* Generated ambient pad — no audio files needed. Quiet, warm, holy. */
class Ambience {
  constructor() { this.ctx = null; this.master = null; }
  start() {
    if (this.ctx) { this.ctx.resume(); this.master.gain.linearRampToValueAtTime(.05, this.ctx.currentTime + 2); return; }
    try {
      const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const master = this.master = ctx.createGain();
      master.gain.value = .0001;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 850; lp.Q.value = .4;
      master.connect(lp).connect(ctx.destination);
      const freqs = [110, 164.81, 220, 261.63, 329.63, 880];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine'; osc.frequency.value = f;
        osc.detune.value = (Math.random() - .5) * 7;
        const g = ctx.createGain();
        g.gain.value = i === 5 ? .006 : .05 + Math.random() * .04;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = .02 + Math.random() * .06;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = i === 5 ? .004 : .03;
        lfo.connect(lfoGain).connect(g.gain);
        osc.connect(g).connect(master);
        osc.start(); lfo.start();
      });
      master.gain.linearRampToValueAtTime(.05, ctx.currentTime + 4);
    } catch { /* audio unavailable */ }
  }
  stop() {
    if (!this.ctx) return;
    this.master.gain.linearRampToValueAtTime(.0001, this.ctx.currentTime + 1);
    setTimeout(() => this.ctx && this.ctx.suspend(), 1200);
  }
}
const ambience = new Ambience();

function setSound(on, fromGesture = false) {
  localStorage.setItem('realm.sound', on ? '1' : '0');
  $('#soundBtn').classList.toggle('on', on);
  if (on && fromGesture) ambience.start();
  if (!on) ambience.stop();
}

function startVerses() {
  const node = $('#verse');
  let i = Math.floor(Math.random() * VERSES.length);
  const show = () => {
    const v = VERSES[i % VERSES.length];
    node.replaceChildren(v.t, ' ', el('b', {}, `— ${v.r}`));
    i++;
  };
  show();
  setInterval(() => {
    node.classList.add('fade');
    setTimeout(() => { show(); node.classList.remove('fade'); }, 900);
  }, 9000);
}

/* ═══════════════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════════════ */

function isConfigured() {
  try { return !/YOUR_/.test(JSON.stringify(CFG.firebase)) && !!CFG.firebase.apiKey; }
  catch { return false; }
}

function isInAppBrowser() {
  return /TikTok|musical_ly|Instagram|FBAN|FBAV|Line\/|GSA\//i.test(navigator.userAgent);
}

function switchRoom(room) {
  $$('.room-tab').forEach(tb => tb.classList.toggle('active', tb.dataset.room === room));
  document.body.dataset.room = room;
  $$('.room').forEach(r => r.classList.toggle('active', r.id === room));
  if (room === 'map') Watch.start();
}

async function boot() {
  startSky(); startHalo(); startVerses();

  $('#enterBtn').addEventListener('click', () => {
    const wantSound = $('#veilSound').checked;
    setSound(wantSound, true);
    $('#veil').classList.add('open');
    setTimeout(() => $('#veil').remove(), 1600);
  });

  const soundPref = localStorage.getItem('realm.sound');
  if (soundPref === '0') $('#veilSound').checked = false;
  $('#soundBtn').addEventListener('click', () =>
    setSound(!$('#soundBtn').classList.contains('on'), true));

  $$('.room-tab').forEach(tab => tab.addEventListener('click', () => switchRoom(tab.dataset.room)));

  if (CFG.shopUrl) $('#shopLink').href = CFG.shopUrl;

  /* backend */
  if (isConfigured()) {
    try { backend = await makeFirebaseBackend(); }
    catch (e) {
      console.error('Firebase failed to load, falling back to demo:', e);
      toast('Could not reach the live realm — running in demo mode.', 'rose');
      backend = makeLocalBackend();
    }
  } else {
    backend = makeLocalBackend();
  }
  $('#demoBanner').hidden = !backend.isDemo;

  /* auth */
  const doAuth = () => {
    if (state.user) { backend.signOut(); return; }
    if (!backend.isDemo && isInAppBrowser())
      toast('Tip: Google blocks sign-in inside the TikTok app. Tap the menu, then "Open in browser".', 'gold');
    backend.signIn();
  };
  $('#authBtn').addEventListener('click', doAuth);
  $('#lockedAuthBtn').addEventListener('click', doAuth);

  backend.onUser(u => {
    state.user = u;
    renderAuth();
    subscribeThreads();
    if (u) startPresence(); else { stopPresence(); closePanel(); }
    updateSouls();
  });

  /* composer */
  buildCatPick();
  $('#submitPrayer').addEventListener('click', async () => {
    const ta = $('#prayerText');
    const text = ta.value.trim();
    if (!state.user) return needSignIn();
    if (text.length < 3) return toast('Pour out a little more, saint — the altar is listening.', 'gold');
    const btn = $('#submitPrayer');
    btn.disabled = true;
    try {
      await backend.addPrayer({
        text,
        category: $('#catPick').dataset.sel || 'other',
        anonymous: $('#anonToggle').checked,
        loc: state.geo.mode === 'on' ? { lat: state.geo.lat, lng: state.geo.lng } : null,
      });
      ta.value = '';
      const r = btn.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top);
      toast('Placed on the altar. The saints are with you.', 'gold');
    } catch (e) {
      console.error(e);
      toast('The altar could not receive it — try again.', 'rose');
    } finally { btn.disabled = false; }
  });

  /* wall tools */
  $$('#sortSeg .seg-btn').forEach(b => b.addEventListener('click', () => {
    $$('#sortSeg .seg-btn').forEach(x => x.classList.toggle('active', x === b));
    state.sort = b.dataset.sort;
    renderPrayers();
  }));
  buildFilterChips();
  renderPrayers(); // skeletons until first snapshot

  /* live data */
  backend.onPrayers(list => { state.prayers = list; state.loaded = true; renderPrayers(); Watch.refresh(); });
  backend.onSouls(list => { state.souls = list; updateSouls(); });
  setInterval(updateSouls, 30000);

  /* the watch — my light */
  geoLabel();
  $('#geoBtn').addEventListener('click', async () => {
    if (!state.user) return needSignIn();
    if (state.geo.mode === 'on') {
      state.geo = { mode: 'off' };
      saveGeo(); geoLabel(); beatPresence();
      toast('Your light is dimmed. You remain counted among the watchers.');
      return;
    }
    const got = await acquireGeo();
    if (!got) return toast('Could not place your light — location unavailable.', 'rose');
    state.geo = { mode: 'on', lat: got.lat, lng: got.lng };
    saveGeo(); geoLabel(); beatPresence();
    toast('Your light now shines on the watch.', 'gold');
  });

  /* words */
  $('#dmBtn').addEventListener('click', () => { $('#dmPanel').hidden ? openPanel() : closePanel(); });
  $('#dmClose').addEventListener('click', closePanel);
  $('#dmBack').addEventListener('click', showThreadList);
  const sendWord = async () => {
    const input = $('#dmInput');
    const text = input.value.trim();
    if (!text || !state.dm.openId) return;
    input.value = '';
    try { await backend.sendMessage(state.dm.openId, text); }
    catch (e) { console.error(e); toast('Could not send — try again.', 'rose'); }
  };
  $('#dmSend').addEventListener('click', sendWord);
  $('#dmInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendWord(); });

  renderAuth();
}

boot();
