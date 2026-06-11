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

/* Daily manna — one verse and one charge per day of the month. */
const MANNA = [
  { v: 'Give us this day our daily bread.', r: 'Matthew 6:11', p: 'Pray for someone whose needs are heavier than yours today.' },
  { v: 'The steadfast love of the LORD never ceases; his mercies never come to an end; they are new every morning.', r: 'Lamentations 3:22-23', p: 'Lift someone who needs a new morning.' },
  { v: 'Pray for one another, that you may be healed.', r: 'James 5:16', p: 'Find a healing request on the altar and stand over it.' },
  { v: 'And let us not grow weary of doing good, for in due season we will reap, if we do not give up.', r: 'Galatians 6:9', p: 'Encourage someone who has been waiting a long time.' },
  { v: 'Be still, and know that I am God.', r: 'Psalm 46:10', p: 'Before you lift anyone — be still for thirty seconds.' },
  { v: 'The light shines in the darkness, and the darkness has not overcome it.', r: 'John 1:5', p: 'Pray over the request with the fewest amens.' },
  { v: 'Bear one another’s burdens, and so fulfill the law of Christ.', r: 'Galatians 6:2', p: 'Carry a stranger’s burden as if it were your own.' },
  { v: 'Call to me and I will answer you, and will tell you great and hidden things that you have not known.', r: 'Jeremiah 33:3', p: 'Ask boldly today — for someone else.' },
  { v: 'If two of you agree on earth about anything they ask, it will be done for them by my Father in heaven.', r: 'Matthew 18:19', p: 'Add your agreement to a prayer that moved you.' },
  { v: 'Weeping may tarry for the night, but joy comes with the morning.', r: 'Psalm 30:5', p: 'Speak a word of hope over someone grieving.' },
  { v: 'Cast your burden on the LORD, and he will sustain you.', r: 'Psalm 55:22', p: 'Place something on the altar you have been carrying alone.' },
  { v: 'The prayer of a righteous person has great power as it is working.', r: 'James 5:16', p: 'Your amens are not small. Spend three of them today.' },
  { v: 'Fear not, for I am with you; be not dismayed, for I am your God.', r: 'Isaiah 41:10', p: 'Lift someone praying for protection.' },
  { v: 'Come to me, all who labor and are heavy laden, and I will give you rest.', r: 'Matthew 11:28', p: 'Pray rest over someone exhausted.' },
  { v: 'And my God will supply every need of yours according to his riches in glory in Christ Jesus.', r: 'Philippians 4:19', p: 'Stand with someone asking for provision.' },
  { v: 'Let your light shine before others.', r: 'Matthew 5:16', p: 'Shine your light on the Watch — then pray for the light nearest yours.' },
  { v: 'For where two or three are gathered in my name, there am I among them.', r: 'Matthew 18:20', p: 'You are not praying alone today. Act like it.' },
  { v: 'He heals the brokenhearted and binds up their wounds.', r: 'Psalm 147:3', p: 'Find the rawest prayer on the altar. Stay with it a while.' },
  { v: 'Rejoice in hope, be patient in tribulation, be constant in prayer.', r: 'Romans 12:12', p: 'Keep your watch even if today is hard.' },
  { v: 'The LORD bless you and keep you; the LORD make his face to shine upon you.', r: 'Numbers 6:24-25', p: 'Speak this blessing over three people by name.' },
  { v: 'Ask, and it will be given to you; seek, and you will find; knock, and it will be opened to you.', r: 'Matthew 7:7', p: 'Knock on heaven’s door for a stranger.' },
  { v: 'I sought the LORD, and he answered me and delivered me from all my fears.', r: 'Psalm 34:4', p: 'Pray courage over someone afraid.' },
  { v: 'Let all that you do be done in love.', r: '1 Corinthians 16:14', p: 'Send a private word of encouragement to someone today.' },
  { v: 'With God all things are possible.', r: 'Matthew 19:26', p: 'Find the most impossible request on the altar — pray for that one.' },
  { v: 'He gives power to the faint, and to him who has no might he increases strength.', r: 'Isaiah 40:29', p: 'Lift someone running on empty.' },
  { v: 'Your word is a lamp to my feet and a light to my path.', r: 'Psalm 119:105', p: 'Pray guidance over someone at a crossroads.' },
  { v: 'Greater love has no one than this, that someone lay down his life for his friends.', r: 'John 15:13', p: 'Lay down ten minutes of your day for someone else’s battle.' },
  { v: 'Peace I leave with you; my peace I give to you.', r: 'John 14:27', p: 'Pray peace over an anxious heart on the altar.' },
  { v: 'Children are a heritage from the LORD.', r: 'Psalm 127:3', p: 'Lift every family request you can find today.' },
  { v: 'Give thanks in all circumstances.', r: '1 Thessalonians 5:18', p: 'Visit the answered prayers — and thank Him for each one.' },
  { v: 'And they devoted themselves to the apostles’ teaching and the fellowship, to the breaking of bread and the prayers.', r: 'Acts 2:42', p: 'Devotion is daily. You showed up — now keep the watch.' },
];

/* daily helpers */
const dayInt = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const yesterdayInt = () => dayInt(new Date(Date.now() - 86400000));
function hashStr(s) {
  let h = 2166136261;
  for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function seededShuffle(arr, seed) {
  let s = seed >>> 0;
  const rand = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
  fire: { streak: 0, lastDay: 0, best: 0, watchHourUtc: null },   // your daily flame
  dailyIds: null,                  // today's three, frozen for the day
  loaded: false,
};

let backend = null;

try { state.geo = JSON.parse(localStorage.getItem('realm.geo')) || { mode: 'off' }; }
catch { state.geo = { mode: 'off' }; }
try { Object.assign(state.fire, JSON.parse(localStorage.getItem('realm.fire')) || {}); }
catch { /* fresh fire */ }

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
        text: 'Welcome to the Prayer Realm. Lay whatever you are carrying on this altar — and take a moment to lift up someone else while you are here. This is a demo prayer; yours will appear above it.',
        category: 'faith', createdAt: now - 86400000 * 2, prayedBy: ['a', 'b', 'c'], prayedCount: 3,
        reactions: { love: ['a'], dove: ['b'], cross: ['c'], fire: [] }, answered: false, flags: [],
        commentCount: 1, loc: { lat: 36.2, lng: -86.8 } },
      { id: 'seed-2', uid: 'keeper', name: 'The Realm Keeper', photo: null, anonymous: true,
        text: 'Praying for every single person who finds this place. May you feel Him closer than your own breath.',
        category: 'praise', createdAt: now - 86400000 * 5, prayedBy: ['a'], prayedCount: 1,
        reactions: { love: [], dove: ['a'], cross: [], fire: ['b'] }, answered: true, flags: [],
        commentCount: 0, loc: { lat: 32.8, lng: -96.8 } },
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
    { uid: 'w1', name: 'A light in Nashville', photo: null, lat: 36.2, lng: -86.8 },
    { uid: 'w2', name: 'A light in Dallas', photo: null, lat: 32.8, lng: -96.8 },
    { uid: 'w3', name: 'A light in Los Angeles', photo: null, lat: 34.1, lng: -118.2 },
    { uid: 'w4', name: 'A light in New York', photo: null, lat: 40.7, lng: -74 },
    { uid: 'w5', name: 'A light in Anchorage', photo: null, lat: 61.2, lng: -149.9 },
    { uid: 'w6', name: 'A light in London', photo: null, lat: 51.5, lng: -.1 },
  ].map(s => ({ ...s, lastSeen: Date.now() }));
  let ownPresence = null;
  const emitSouls = () => soulCbs.forEach(cb =>
    cb([...demoSouls, ...(ownPresence ? [ownPresence] : [])].map(s => ({ ...s, lastSeen: Date.now() }))));

  return {
    isDemo: true,

    onUser(cb) { userCbs.push(cb); cb(user); },
    async signIn() {
      user = { uid: 'demo-' + Math.random().toString(36).slice(2, 8), name: 'Guest',
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
    async setPresence({ lat, lng, streak, lastDay, best, watchHourUtc }) {
      if (!user) return;
      ownPresence = { uid: user.uid, name: user.name, photo: user.photo,
                      lat: lat ?? null, lng: lng ?? null, lastSeen: Date.now(),
                      streak: streak || 0, lastDay: lastDay || 0, best: best || 0,
                      watchHourUtc: watchHourUtc ?? null };
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
      id: d.id, uid: x.uid, name: x.name || 'A Believer', photo: x.photo || null,
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
        cb(u ? { uid: u.uid, name: u.displayName || 'A Believer', email: u.email,
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
        uid: u.uid, name: u.displayName || 'A Believer', photo: u.photoURL || null,
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
        return { id: d.id, uid: x.uid, name: x.name || 'A Believer', photo: x.photo || null,
                 anonymous: !!x.anonymous, text: x.text || '', createdAt: tsToMs(x.createdAt) };
      })), err => console.error(err));
    },
    async addComment(id, { text, anonymous }) {
      const u = auth.currentUser;
      await F.addDoc(F.collection(db, 'prayers', id, 'comments'), {
        uid: u.uid, name: u.displayName || 'A Believer', photo: u.photoURL || null,
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
        return { uid: d.id, name: x.name || 'A Believer', photo: x.photo || null,
                 lat: typeof x.lat === 'number' ? x.lat : null,
                 lng: typeof x.lng === 'number' ? x.lng : null,
                 lastSeen: tsToMs(x.lastSeen),
                 streak: x.streak || 0,
                 watchHourUtc: typeof x.watchHourUtc === 'number' ? x.watchHourUtc : null };
      })), err => console.error(err));
    },
    async setPresence({ lat, lng, streak, lastDay, best, watchHourUtc }) {
      const u = auth.currentUser; if (!u) return;
      await F.setDoc(F.doc(db, 'presence', u.uid), {
        uid: u.uid, name: u.displayName || 'A Believer', photo: u.photoURL || null,
        lat: lat ?? null, lng: lng ?? null, lastSeen: F.serverTimestamp(),
        streak: streak || 0, lastDay: lastDay || 0, best: best || 0,
        watchHourUtc: watchHourUtc ?? null,
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
          names: { [u.uid]: u.displayName || 'A Believer', [other.uid]: other.name || 'A Believer' },
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

function displayName(p) { return p.anonymous ? 'Anonymous' : p.name; }

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
  renderDaily();
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
      try { await backend.prayFor(p.id); markIntercession(); } catch (err) { console.error(err); }
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
        c.anonymous ? 'Anonymous' : c.name,
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
      try { await backend.addComment(p.id, { text, anonymous: $('#anonToggle').checked }); markIntercession(); }
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
   THE WATCH — the nation, live. Real map tiles (Leaflet + CARTO dark)
   with a living layer of prayer-light: glowing beacons, a prayer
   heatmap, fly-to, and real-time pulses when prayer moves. Falls back
   to a baked dot-matrix USA if the map library is ever blocked.
   ═══════════════════════════════════════════════════════════════════ */

const Watch = (() => {
  let started = false, map = null, leaflet = false;
  let cv, cx, W = 0, H = 0, t = 0;
  let beacons = [], hover = null, pulses = [], lastPts = [];
  const amenSeen = new Map();   // prayerId → last prayedCount (to ripple new amens)
  let seeded = false;

  /* ── baked Albers USA fallback (only if Leaflet is unavailable) ── */
  let ox = 0, oy = 0, mapW = 0, mapH = 0, mask = null, dots = null;
  const UW = 975, UH = 610, ASPECT = UW / UH, RAD = Math.PI / 180;
  function conicUsa(parallels, rotateLng, center, scale, translate) {
    const p0 = parallels[0] * RAD, p1 = parallels[1] * RAD;
    const sy0 = Math.sin(p0), n = (sy0 + Math.sin(p1)) / 2,
          c = 1 + sy0 * (2 * n - sy0), r0 = Math.sqrt(c) / n;
    const raw = (lDeg, latDeg) => {
      const th = lDeg * RAD * n, phi = latDeg * RAD;
      const r = Math.sqrt(Math.max(0, c - 2 * n * Math.sin(phi))) / n;
      return [r * Math.sin(th), r0 - r * Math.cos(th)];
    };
    const base = raw(center[0], center[1]);
    return (lng, lat) => {
      const l = ((lng + rotateLng + 540) % 360) - 180;
      const xy = raw(l, lat);
      return [translate[0] + scale * (xy[0] - base[0]), translate[1] - scale * (xy[1] - base[1])];
    };
  }
  const K = 1300;
  const projL48 = conicUsa([29.5, 45.5], 96, [-.6, 38.7], K, [487.5, 305]);
  const projAK  = conicUsa([55, 65], 154, [-2, 58.5], K * .35, [487.5 - .307 * K, 305 + .201 * K]);
  const projHI  = conicUsa([8, 18], 157, [-3, 19.9], K, [487.5 - .205 * K, 305 + .212 * K]);
  const albersUsa = (lng, lat) => {
    if (lat >= 18 && lat <= 23.5 && lng >= -161 && lng <= -154) return projHI(lng, lat);
    if (lat >= 50 && (lng <= -128 || lng >= 170)) return projAK(lng, lat);
    return projL48(lng, lat);
  };
  function albersPx(lng, lat) {
    const u = albersUsa(lng, lat);
    if (u[0] < -10 || u[0] > UW + 10 || u[1] < -10 || u[1] > UH + 10) return null;
    return [ox + u[0] / UW * mapW, oy + u[1] / UH * mapH];
  }
  function buildMask() {
    if (!window.REALM_USA) return;
    const off = el('canvas', { width: UW * 2, height: UH * 2 });
    const oc = off.getContext('2d'); oc.scale(2, 2); oc.fillStyle = '#fff';
    for (const poly of window.REALM_USA.states) {
      oc.beginPath();
      for (const ring of poly) { ring.forEach(([x, y], k) => k ? oc.lineTo(x, y) : oc.moveTo(x, y)); oc.closePath(); }
      oc.fill('evenodd');
    }
    mask = oc.getImageData(0, 0, UW * 2, UH * 2);
  }
  function landAt(x01, y01) {
    if (!mask) return false;
    const mx = Math.min(UW * 2 - 1, Math.max(0, Math.round(x01 * UW * 2)));
    const my = Math.min(UH * 2 - 1, Math.max(0, Math.round(y01 * UH * 2)));
    return mask.data[(my * UW * 2 + mx) * 4 + 3] > 100;
  }
  function buildDots() {
    if (!W || !H || !mapW) return;
    dots = el('canvas', { width: W, height: H });
    const dc = dots.getContext('2d');
    const step = Math.max(2.6, mapW / 320), r = Math.max(.8, step * .34);
    for (let y = oy + step / 2; y < oy + mapH; y += step)
      for (let x = ox + step / 2; x < ox + mapW; x += step) {
        const x01 = (x - ox) / mapW, y01 = (y - oy) / mapH;
        if (!(mask ? landAt(x01, y01) : (Math.abs(y01 * 180 - 90) % 15 < 1.1 || Math.abs(x01 * 360 - 180) % 15 < 1.1))) continue;
        dc.fillStyle = `rgba(158, 144, 205, ${mask ? .25 + Math.random() * .28 : .12})`;
        dc.beginPath(); dc.arc(x + (Math.random() - .5) * .8, y + (Math.random() - .5) * .8, r, 0, 7); dc.fill();
      }
    if (window.REALM_USA) {
      const sx = mapW / UW, sy = mapH / UH;
      const stroke = (lines, style, width) => {
        dc.strokeStyle = style; dc.lineWidth = width; dc.lineJoin = 'round'; dc.lineCap = 'round';
        for (const line of lines) { dc.beginPath(); line.forEach(([x, y], k) => k ? dc.lineTo(ox + x * sx, oy + y * sy) : dc.moveTo(ox + x * sx, oy + y * sy)); dc.stroke(); }
      };
      stroke(window.REALM_USA.borders, 'rgba(167, 152, 220, .30)', Math.max(.6, mapW / 1600));
      stroke(window.REALM_USA.outline, 'rgba(243, 201, 105, .40)', Math.max(.8, mapW / 1300));
    }
  }

  /* ── projection that serves both modes ── */
  function projPx(lng, lat) {
    if (leaflet && map) { const p = map.latLngToContainerPoint([lat, lng]); return [p.x, p.y]; }
    return albersPx(lng, lat);
  }

  function rebuildBeacons() {
    const me = state.user?.uid;
    const fresh = Date.now() - 150000;
    const out = [];
    for (const p of state.prayers) {
      if (!p.loc) continue;
      out.push({ lat: p.loc.lat, lng: p.loc.lng, type: 'prayer', id: p.id, label: displayName(p),
                 text: p.text.length > 70 ? p.text.slice(0, 70) + '…' : p.text,
                 amens: p.prayedCount || 0, phase: (p.id.charCodeAt(p.id.length - 1) || 0) % 7 });
    }
    for (const sObj of state.souls) {
      if (sObj.lat == null || sObj.lastSeen < fresh) continue;
      out.push({ lat: sObj.lat, lng: sObj.lng, type: sObj.uid === me ? 'me' : 'soul', id: sObj.uid,
                 label: sObj.uid === me ? 'You — keeping watch' : sObj.name,
                 text: sObj.uid === me ? '' : (sObj.streak > 1 ? `keeping watch — day ${sObj.streak} flame` : 'keeping watch'),
                 amens: 0, phase: hashStr(sObj.uid) % 7 });
    }
    beacons = out;
  }

  function notePulse(lng, lat, color) { pulses.push({ lng, lat, t0: t, color }); if (pulses.length > 50) pulses.shift(); }
  function detectChanges() {
    if (!seeded) { for (const p of state.prayers) amenSeen.set(p.id, p.prayedCount || 0); seeded = true; return; }
    for (const p of state.prayers) {
      const prev = amenSeen.get(p.id);
      if (prev === undefined) { amenSeen.set(p.id, p.prayedCount || 0); if (p.loc) notePulse(p.loc.lng, p.loc.lat, [255, 250, 240]); }
      else if ((p.prayedCount || 0) > prev) { amenSeen.set(p.id, p.prayedCount); if (p.loc) notePulse(p.loc.lng, p.loc.lat, [243, 201, 105]); }
    }
  }

  function frame() {
    requestAnimationFrame(frame);
    if (!started || document.hidden || !cx) return;
    t += .016;
    cx.clearRect(0, 0, W, H);
    if (!leaflet && dots) { cx.globalAlpha = .85 + Math.sin(t * .6) * .12; cx.drawImage(dots, 0, 0); cx.globalAlpha = 1; }

    const pts = [];
    for (const b of beacons) {
      const p = projPx(b.lng, b.lat);
      if (!p || p[0] < -50 || p[0] > W + 50 || p[1] < -50 || p[1] > H + 50) continue;
      pts.push({ b, x: p[0], y: p[1] });
    }
    lastPts = pts;

    /* prayer heatmap — additive gold density */
    cx.globalCompositeOperation = 'lighter';
    for (const { b, x, y } of pts) {
      if (b.type !== 'prayer') continue;
      const rad = 24 + Math.min(46, (b.amens || 0) * 6);
      const g = cx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(243, 176, 74, .13)'); g.addColorStop(1, 'rgba(243, 176, 74, 0)');
      cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, rad, 0, 7); cx.fill();
    }
    cx.globalCompositeOperation = 'source-over';

    /* live pulses */
    for (let i = pulses.length - 1; i >= 0; i--) {
      const pu = pulses[i], age = t - pu.t0;
      if (age > 2.4) { pulses.splice(i, 1); continue; }
      const p = projPx(pu.lng, pu.lat); if (!p) continue;
      cx.strokeStyle = `rgba(${pu.color[0]},${pu.color[1]},${pu.color[2]},${.55 * (1 - age / 2.4)})`;
      cx.lineWidth = 2.2 * (1 - age / 2.4) + .4;
      cx.beginPath(); cx.arc(p[0], p[1], age * 64, 0, 7); cx.stroke();
    }

    /* beacons */
    for (const { b, x, y } of pts) {
      const pulse = .5 + .5 * Math.sin(t * 2.2 + b.phase);
      const base = b.type === 'prayer' ? [243, 201, 105] : b.type === 'me' ? [255, 250, 240] : [159, 139, 255];
      const r = (b.type === 'me' ? 4.5 : 3) + pulse * 1.6 + (hover === b ? 1.8 : 0);
      const g = cx.createRadialGradient(x, y, 0, x, y, r * 4.2);
      g.addColorStop(0, `rgba(${base[0]},${base[1]},${base[2]},.95)`);
      g.addColorStop(.35, `rgba(${base[0]},${base[1]},${base[2]},.35)`);
      g.addColorStop(1, `rgba(${base[0]},${base[1]},${base[2]},0)`);
      cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r * 4.2, 0, 7); cx.fill();
      cx.fillStyle = `rgba(255,255,255,${.78 + pulse * .22})`;
      cx.beginPath(); cx.arc(x, y, r * .42, 0, 7); cx.fill();
      const ring = ((t * .55 + b.phase) % 3);
      if (ring < 1.1) { cx.strokeStyle = `rgba(${base[0]},${base[1]},${base[2]},${.4 * (1.1 - ring)})`; cx.lineWidth = 1.2; cx.beginPath(); cx.arc(x, y, r + ring * 16, 0, 7); cx.stroke(); }
    }
    if (hover) { const e = $('#mapTip'); e.style.left = tipX + 'px'; e.style.top = tipY + 'px'; }
  }

  let tipX = 0, tipY = 0;
  function showTip(b, x, y) { tipX = x; tipY = y; const e = $('#mapTip'); e.hidden = false; e.replaceChildren(el('b', {}, b.label), el('span', {}, b.text || '')); }
  function pick(mx, my) { let best = null, bd = 20; for (const pt of lastPts) { const d = Math.hypot(pt.x - mx, pt.y - my); if (d < bd) { bd = d; best = pt.b; } } return best; }

  function sizeCanvas() {
    const rect = $('#mapStage').getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = Math.round(rect.width); H = Math.round(rect.height);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cx = cv.getContext('2d'); cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!leaflet) { mapW = Math.min(W, H * ASPECT); mapH = mapW / ASPECT; ox = (W - mapW) / 2; oy = (H - mapH) / 2; buildDots(); }
  }

  function makeOverlay() { cv = el('canvas', { id: 'mapCanvas' }); $('#mapStage').append(cv); }

  function flyToPrayer(b) {
    if (map) map.flyTo([b.lat, b.lng], Math.max(map.getZoom(), 6), { duration: 1 });
    switchRoom('altar');
    const card = $(`.prayer-card[data-id="${b.id}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.animate([{ boxShadow: '0 0 0 rgba(243,201,105,0)' }, { boxShadow: '0 0 60px rgba(243,201,105,.55)' }, { boxShadow: '0 0 0 rgba(243,201,105,0)' }], { duration: 1800, easing: 'ease-out' });
    }
  }

  const USA_BOUNDS = [[24.5, -125], [49.5, -66.5]];
  function recenter() { if (map) map.flyToBounds(USA_BOUNDS, { padding: [24, 24], duration: 1.2 }); }

  function startLeaflet() {
    leaflet = true;
    map = L.map('mapStage', { zoomControl: true, attributionControl: true, worldCopyJump: true,
      minZoom: 2, maxZoom: 12, zoomSnap: .5, scrollWheelZoom: 'center' }).setView([39.5, -98.35], 4);
    const tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { subdomains: 'abcd', detectRetina: true, maxZoom: 19, attribution: '© OpenStreetMap, © CARTO' });
    let hid = false; const hide = () => { if (hid) return; hid = true; $('#mapLoading').classList.add('gone'); };
    tiles.on('load', hide); setTimeout(hide, 2500);
    tiles.addTo(map);
    makeOverlay();
    $('#mapRecenter').hidden = false;
    sizeCanvas();
    map.on('resize', sizeCanvas);
    addEventListener('resize', sizeCanvas);
    const container = map.getContainer();
    container.addEventListener('pointermove', e => {
      const r = container.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      hover = pick(mx, my);
      if (hover) { showTip(hover, mx, my); container.style.cursor = hover.type === 'prayer' ? 'pointer' : ''; }
      else { $('#mapTip').hidden = true; container.style.cursor = ''; }
    }, { passive: true });
    container.addEventListener('pointerleave', () => { hover = null; $('#mapTip').hidden = true; });
    map.on('click', () => { if (hover?.type === 'prayer') flyToPrayer(hover); });
    $('#mapRecenter').addEventListener('click', recenter);
    rebuildBeacons(); frame();
  }

  function startFallback() {
    leaflet = false;
    makeOverlay();
    cv.classList.add('solo');
    try { buildMask(); } catch (e) { console.warn('land veiled:', e); }
    $('#mapLoading').classList.add('gone');
    sizeCanvas();
    addEventListener('resize', sizeCanvas);
    cv.addEventListener('pointermove', e => {
      const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      hover = pick(mx, my);
      if (hover) { showTip(hover, mx, my); cv.style.cursor = hover.type === 'prayer' ? 'pointer' : 'crosshair'; }
      else { $('#mapTip').hidden = true; cv.style.cursor = 'crosshair'; }
    });
    cv.addEventListener('pointerleave', () => { hover = null; $('#mapTip').hidden = true; });
    cv.addEventListener('click', () => { if (hover?.type === 'prayer') flyToPrayer(hover); });
    rebuildBeacons(); frame();
  }

  async function start() {
    if (started) return; started = true;
    if (window.L) { try { startLeaflet(); } catch (e) { console.error('map tiles failed, falling back:', e); startFallback(); } }
    else startFallback();
  }

  function refresh() { if (!started) return; detectChanges(); rebuildBeacons(); }

  return { start, refresh, recenter };
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
  backend.setPresence({ ...loc, ...state.fire });
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
  renderChain();
}

/* ═══════════════════════════════════════════════════════════════════
   YOUR FLAME — pray for someone every day and it grows; rest, and
   it returns to embers. The realm rewards faithfulness, not noise.
   ═══════════════════════════════════════════════════════════════════ */

function saveFire() { try { localStorage.setItem('realm.fire', JSON.stringify(state.fire)); } catch {} }

function fireTier(streak) {
  if (streak >= 30) return { cls: 't4', name: 'Pillar of Fire' };
  if (streak >= 7)  return { cls: 't3', name: 'Blaze' };
  if (streak >= 3)  return { cls: 't2', name: 'Flame' };
  return { cls: 't1', name: 'Ember' };
}

function renderFlame() {
  const pill = $('#flamePill');
  const f = state.fire;
  /* a flame that wasn't tended yesterday has gone out */
  if (f.streak && f.lastDay !== dayInt() && f.lastDay !== yesterdayInt()) {
    f.streak = 0; saveFire();
  }
  if (!state.user || !f.streak) { pill.hidden = true; return; }
  const tier = fireTier(f.streak);
  pill.hidden = false;
  pill.className = tier.cls;
  pill.title = `${tier.name} — day ${f.streak} of your watch` + (f.best > f.streak ? ` (best: ${f.best})` : '');
  $('#flameCount').textContent = String(f.streak);
}

/* called after any true act of intercession (amen, word, encouragement) */
function markIntercession() {
  if (!state.user) return;
  const today = dayInt();
  const f = state.fire;
  if (f.lastDay === today) return;
  f.streak = (f.lastDay === yesterdayInt()) ? (f.streak || 0) + 1 : 1;
  f.lastDay = today;
  f.best = Math.max(f.best || 0, f.streak);
  saveFire(); renderFlame(); beatPresence();
  const tier = fireTier(f.streak);
  toast(`Day ${f.streak} — your ${tier.name.toLowerCase()} burns on.`, 'gold');
}

/* ═══════════════════════════════════════════════════════════════════
   TODAY'S WATCH — three souls entrusted to you each day, chosen
   where need is greatest, plus the day's manna.
   ═══════════════════════════════════════════════════════════════════ */

function pickDaily() {
  if (!state.user || !state.loaded) return [];
  const key = `realm.daily.${state.user.uid}.${dayInt()}`;
  if (!state.dailyIds) {
    try { state.dailyIds = JSON.parse(localStorage.getItem(key)); } catch {}
  }
  if (state.dailyIds) {
    const found = state.dailyIds.map(id => state.prayers.find(p => p.id === id)).filter(Boolean);
    if (found.length) return found;
  }
  const me = state.user.uid;
  const cands = state.prayers.filter(p => p.uid !== me && !p.answered);
  /* the least-lifted first — the realm sends you where need is greatest */
  cands.sort((a, b) => (a.prayedCount - b.prayedCount) || (b.createdAt - a.createdAt));
  const picks = seededShuffle(cands.slice(0, 12), hashStr(me + dayInt())).slice(0, 3);
  if (picks.length) {
    state.dailyIds = picks.map(p => p.id);
    try { localStorage.setItem(key, JSON.stringify(state.dailyIds)); } catch {}
  }
  return picks;
}

function renderDaily() {
  const box = $('#dailyWatch');
  if (!box) return;
  const today = new Date();
  $('#dwDate').textContent = today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const m = MANNA[(today.getDate() - 1) % MANNA.length];
  $('#dwManna').replaceChildren(`“${m.v}” `, el('b', {}, `— ${m.r}`));
  $('#dwPrompt').textContent = m.p;

  const list = $('#dwList'), foot = $('#dwFoot'), badge = $('#dwBadge');
  if (!state.user) {
    list.replaceChildren(el('div', { class: 'comment-hint' },
      'Enter with Google and the realm will entrust three people to you each day.'));
    foot.textContent = '';
    badge.hidden = true;
    return;
  }
  const picks = pickDaily();
  if (!picks.length) {
    list.replaceChildren(el('div', { class: 'comment-hint' },
      'The altar is quiet — place a prayer, or return when others have laid theirs down.'));
    foot.textContent = '';
    badge.hidden = true;
    return;
  }
  const me = state.user.uid;
  let done = 0;
  list.replaceChildren(...picks.map(p => {
    const lifted = p.prayedBy.includes(me);
    if (lifted) done++;
    const cat = CATS[p.category] || CATS.other;
    return el('div', { class: 'dw-item' + (lifted ? ' done' : '') },
      el('span', { class: 'dw-cat' }, icon(cat.icon)),
      el('div', { class: 'dw-body' },
        el('b', {}, displayName(p)),
        el('span', {}, p.text.length > 80 ? p.text.slice(0, 80) + '…' : p.text)),
      el('button', {
        class: 'amen-btn' + (lifted ? ' prayed' : ''),
        onclick: async e => {
          if (lifted) return;
          const r = e.currentTarget.getBoundingClientRect();
          burst(r.left + r.width / 2, r.top);
          try { await backend.prayFor(p.id); markIntercession(); } catch (err) { console.error(err); }
        },
      }, icon('hands'), lifted ? 'Amen' : 'Lift'),
    );
  }));
  foot.textContent = `${done} of ${picks.length} lifted today`;
  const kept = done === picks.length && picks.length > 0;
  badge.hidden = !kept;
  const keptKey = `realm.kept.${dayInt()}`;
  if (kept && !localStorage.getItem(keptKey)) {
    try { localStorage.setItem(keptKey, '1'); } catch {}
    celebrateKept();
  }
}

/* ═══════════════════════════════════════════════════════════════════
   THE UNBROKEN CHAIN — believers covering every hour of the day,
   in the spirit of the old Moravian watch: prayer that never sleeps.
   ═══════════════════════════════════════════════════════════════════ */

function hourLabel(utcHour) {
  const d = new Date();
  d.setUTCHours(utcHour, 0, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric' });
}

function renderChain() {
  const ring = $('#chainRing');
  if (!ring) return;
  const counts = Array(24).fill(0);
  const counted = new Set();
  for (const s of state.souls) {
    if (s.watchHourUtc == null || counted.has(s.uid)) continue;
    counted.add(s.uid);
    counts[s.watchHourUtc]++;
  }
  const mine = state.user ? state.fire.watchHourUtc : null;
  if (state.user && mine != null && !counted.has(state.user.uid)) counts[mine]++;

  const covered = counts.filter(c => c > 0).length;
  const SZ = 240, C = SZ / 2, R = 92, WID = 17;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${SZ} ${SZ}`);
  svg.setAttribute('class', 'chain-svg');
  for (let h = 0; h < 24; h++) {
    const a0 = (h / 24) * Math.PI * 2 - Math.PI / 2 + .02;
    const a1 = ((h + 1) / 24) * Math.PI * 2 - Math.PI / 2 - .02;
    const x0 = C + R * Math.cos(a0), y0 = C + R * Math.sin(a0);
    const x1 = C + R * Math.cos(a1), y1 = C + R * Math.sin(a1);
    const seg = document.createElementNS(SVG_NS, 'path');
    seg.setAttribute('d', `M ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1}`);
    seg.setAttribute('fill', 'none');
    seg.setAttribute('stroke-width', WID);
    seg.setAttribute('stroke-linecap', 'butt');
    const n = counts[h];
    seg.setAttribute('stroke', n
      ? `rgba(243, 201, 105, ${Math.min(.95, .45 + n * .18)})`
      : 'rgba(124, 92, 255, .13)');
    if (mine === h) seg.setAttribute('class', 'chain-mine');
    const tip = document.createElementNS(SVG_NS, 'title');
    tip.textContent = `${hourLabel(h)} — ${n ? n + ' keeping watch' : 'unguarded'}`;
    seg.append(tip);
    svg.append(seg);
  }
  const mid = document.createElementNS(SVG_NS, 'text');
  mid.setAttribute('x', C); mid.setAttribute('y', C - 6);
  mid.setAttribute('class', 'chain-num');
  mid.setAttribute('text-anchor', 'middle');
  mid.textContent = `${covered}/24`;
  const sub = document.createElementNS(SVG_NS, 'text');
  sub.setAttribute('x', C); sub.setAttribute('y', C + 16);
  sub.setAttribute('class', 'chain-sub');
  sub.setAttribute('text-anchor', 'middle');
  sub.textContent = 'hours guarded';
  svg.append(mid, sub);
  ring.replaceChildren(svg);

  $('#chainStat').textContent = covered === 24
    ? 'Every hour is guarded. Over this community, prayer never sleeps.'
    : `The chain holds ${covered} of 24 hours. Claim yours, and prayer never sleeps over this community.`;
  $('#claimLabel').textContent = mine != null
    ? `Your watch: ${hourLabel(mine)} — change it`
    : 'Claim my watch hour';
  $('#claimBtn').classList.toggle('lit', mine != null);
}

/* ═══════════════════════════════════════════════════════════════════
   WORDS — private messages between believers
   ═══════════════════════════════════════════════════════════════════ */

let threadsUnsub = null;

function otherOf(t) {
  const me = state.user?.uid;
  const uid = (t.users || []).find(x => x !== me) || '';
  return { uid, name: t.names?.[uid] || 'A Believer', photo: t.photos?.[uid] || null };
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
  $('#dmSub').textContent = 'private encouragement between believers';
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
  renderFlame();
  renderChain();
}

function needSignIn() {
  toast('Enter with Google first.', 'gold');
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
  /* a swelling major chord — for crossing the veil & keeping the watch */
  chord() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = this._cc || (this._cc = new Ctx());
      ctx.resume();
      const now = ctx.currentTime;
      const out = ctx.createGain();
      out.gain.setValueAtTime(.0001, now);
      out.gain.exponentialRampToValueAtTime(.16, now + .5);
      out.gain.exponentialRampToValueAtTime(.0001, now + 3.4);
      const rev = ctx.createBiquadFilter(); rev.type = 'lowpass'; rev.frequency.value = 2400;
      out.connect(rev).connect(ctx.destination);
      [261.63, 329.63, 392.0, 523.25, 659.25].forEach((f, k) => {
        const o = ctx.createOscillator(); o.type = k > 3 ? 'triangle' : 'sine';
        o.frequency.value = f; o.detune.value = (Math.random() - .5) * 6;
        const g = ctx.createGain(); g.gain.value = k > 3 ? .25 : .5;
        o.connect(g).connect(out); o.start(now + k * .07); o.stop(now + 3.6);
      });
    } catch { /* audio unavailable */ }
  }
}
const ambience = new Ambience();

function setSound(on, fromGesture = false) {
  localStorage.setItem('realm.sound', on ? '1' : '0');
  $('#soundBtn').classList.toggle('on', on);
  if (on && fromGesture) ambience.start();
  if (!on) ambience.stop();
}

/* ═══════════════════════════════════════════════════════════════════
   THE LOOK — WebGL liquid light, 3D depth, scroll reveals, celebration
   ═══════════════════════════════════════════════════════════════════ */

/* 1 ▸ Liquid-light background — godrays + gold mist + violet nebula,
       reacting to the cursor. Falls back to the CSS aurora if WebGL
       is unavailable. */
function startGL() {
  const canvas = $('#glCanvas');
  if (REDUCED) { canvas.hidden = true; return; }
  let gl = null;
  try {
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' })
      || canvas.getContext('experimental-webgl');
  } catch { gl = null; }
  if (!gl || typeof gl.createShader !== 'function') { canvas.hidden = true; return; }

  const vs = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
  const fs = `
    precision highp float;
    uniform vec2 u_res; uniform float u_time; uniform vec2 u_ptr;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
      float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
      return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
    float fbm(vec2 p){ float v=0.,a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.03+1.7; a*=.5; } return v; }
    void main(){
      vec2 uv = gl_FragCoord.xy/u_res.xy;
      vec2 p = uv; p.x *= u_res.x/u_res.y;
      float tm = u_time*0.025;
      vec2 ptr = (u_ptr - 0.5);
      float m = fbm(p*2.4 + vec2(tm, -tm*0.6) + ptr*0.4);
      m = fbm(p*2.0 + m + vec2(-tm*0.5, tm*0.8));
      vec2 c = vec2(u_res.x/u_res.y*0.5 + ptr.x*0.3, -0.25);
      vec2 d = p - c;
      float ang = atan(d.x, d.y);
      float rays = fbm(vec2(ang*4.0, length(d)*1.4 - tm*2.0));
      rays = pow(max(rays,0.0), 2.2) * smoothstep(1.4, 0.0, length(d));
      vec3 gold = vec3(0.96,0.80,0.44);
      vec3 violet = vec3(0.44,0.33,0.82);
      vec3 col = vec3(0.024,0.018,0.055);
      col += violet * m * 0.34;
      col += gold * rays * 0.55;
      col += gold * pow(max(1.0-length(uv-vec2(0.5,0.0)),0.0),3.0)*0.10;
      col *= smoothstep(1.35,0.25,length(uv-0.5));
      gl_FragColor = vec4(col, 1.0);
    }`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.hidden = true; return; }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'u_res'),
        uTime = gl.getUniformLocation(prog, 'u_time'),
        uPtr = gl.getUniformLocation(prog, 'u_ptr');

  const SCALE = 0.6;
  const resize = () => { canvas.width = Math.round(innerWidth * SCALE); canvas.height = Math.round(innerHeight * SCALE); gl.viewport(0, 0, canvas.width, canvas.height); };
  resize(); addEventListener('resize', resize);
  let px = 0.5, py = 0.5, tpx = 0.5, tpy = 0.5;
  addEventListener('pointermove', e => { tpx = e.clientX / innerWidth; tpy = e.clientY / innerHeight; }, { passive: true });
  const t0 = performance.now();
  (function loop(now) {
    requestAnimationFrame(loop);
    if (document.hidden) return;
    px += (tpx - px) * .05; py += (tpy - py) * .05;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (now - t0) / 1000);
    gl.uniform2f(uPtr, px, py);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  })(t0);
}

/* 3 ▸ 3D depth — section cards tilt toward the cursor */
function startTilt() {
  if (REDUCED || !matchMedia('(pointer: fine)').matches) return;
  let tilted = null;
  document.addEventListener('pointermove', e => {
    const card = e.target.closest?.('.tilt');
    if (tilted && tilted !== card) { tilted.style.transform = ''; tilted.classList.remove('tilting'); tilted = null; }
    if (!card) return;
    const r = card.getBoundingClientRect();
    const rx = ((e.clientY - r.top) / r.height - .5) * -3.2;
    const ry = ((e.clientX - r.left) / r.width - .5) * 3.2;
    card.style.transform = `perspective(1100px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    card.style.setProperty('--gx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
    card.style.setProperty('--gy', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    card.classList.add('tilting');
    tilted = card;
  }, { passive: true });
}

/* 5 ▸ Living typography — sections rise into being as you scroll */
function startReveals() {
  const els = $$('#hero, #rooms, #dailyWatch, #composer, #wallTools, .watch, .chain, footer');
  els.forEach(e => e.setAttribute('data-reveal', ''));
  if (!('IntersectionObserver' in window) || REDUCED) { els.forEach(e => e.classList.add('shown')); return; }
  const io = new IntersectionObserver((ents) => {
    for (const en of ents) if (en.isIntersecting) { en.target.classList.add('shown'); io.unobserve(en.target); }
  }, { threshold: .08, rootMargin: '0px 0px -8% 0px' });
  els.forEach(e => io.observe(e));
}

/* 11 ▸ Watch Kept — a full-screen seal when the day's three are lifted */
function celebrateKept() {
  const ov = $('#keptOverlay');
  ov.hidden = false;
  requestAnimationFrame(() => ov.classList.add('show'));
  if ($('#soundBtn').classList.contains('on')) ambience.chord();
  const cx = innerWidth / 2, cy = innerHeight * .42;
  for (let i = 0; i < 5; i++) setTimeout(() => burst(cx + (Math.random() * 120 - 60), cy), i * 160);
}
function closeKept() { const ov = $('#keptOverlay'); ov.classList.remove('show'); setTimeout(() => { ov.hidden = true; }, 600); }

/* a shareable seal image — TikTok / IG story fuel */
function shareSeal() {
  const W = 1080, H = 1920;
  const c = el('canvas', { width: W, height: H });
  const x = c.getContext('2d');
  const bg = x.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0b0820'); bg.addColorStop(.5, '#120c2e'); bg.addColorStop(1, '#06040f');
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 140; i++) { x.globalAlpha = Math.random() * .6 + .1; x.fillStyle = '#fff6e3'; x.beginPath(); x.arc(Math.random() * W, Math.random() * H, Math.random() * 2, 0, 7); x.fill(); }
  x.globalAlpha = 1;
  const gx = x.createRadialGradient(W / 2, 760, 0, W / 2, 760, 360);
  gx.addColorStop(0, 'rgba(243,201,105,.5)'); gx.addColorStop(1, 'rgba(243,201,105,0)');
  x.fillStyle = gx; x.beginPath(); x.arc(W / 2, 760, 360, 0, 7); x.fill();
  x.strokeStyle = '#f3c969'; x.lineWidth = 10; x.beginPath(); x.arc(W / 2, 760, 230, 0, 7); x.stroke();
  x.lineWidth = 22; x.lineCap = 'round'; x.strokeStyle = '#ffe9b8';
  x.beginPath(); x.moveTo(W / 2 - 70, 760); x.lineTo(W / 2 - 12, 822); x.lineTo(W / 2 + 86, 700); x.stroke();
  x.textAlign = 'center'; x.fillStyle = '#f3c969'; x.font = '600 34px Cinzel, serif';
  x.fillText('TODAY’S WATCH', W / 2, 1140);
  x.fillStyle = '#ffe9b8'; x.font = '900 130px Cinzel, serif';
  x.fillText('WATCH KEPT', W / 2, 1280);
  x.fillStyle = '#cfc2ff'; x.font = 'italic 40px "Cormorant Garamond", serif';
  x.fillText('I carried three souls to the throne today.', W / 2, 1380);
  x.fillStyle = '#9d93c0'; x.font = '500 32px Outfit, sans-serif';
  x.fillText(new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }), W / 2, 1460);
  x.fillStyle = '#f3c969'; x.font = '700 38px Cinzel, serif';
  x.fillText('THE PRAYER REALM', W / 2, 1760);
  x.fillStyle = '#6a6190'; x.font = '500 30px Outfit, sans-serif';
  x.fillText('a sanctuary by KingdomCovers', W / 2, 1812);

  c.toBlob(async (blob) => {
    if (!blob) return;
    const file = new File([blob], 'watch-kept.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Watch Kept', text: 'I kept my watch in The Prayer Realm today.' }); return; } catch { /* fall through to download */ }
    }
    const a = el('a', { href: URL.createObjectURL(blob), download: 'watch-kept.png' });
    document.body.append(a); a.click(); a.remove();
    toast('Seal saved — share it on your story.', 'gold');
  }, 'image/png');
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
  $$('#' + room + ' [data-reveal]').forEach(e => e.classList.add('shown'));
  if (room === 'map') Watch.start();
}

async function boot() {
  startGL(); startSky(); startHalo(); startVerses(); startTilt(); startReveals();

  /* cinematic entry — clouds part, light breaks, fly through the veil */
  $('#enterBtn').addEventListener('click', () => {
    const wantSound = $('#veilSound').checked;
    setSound(wantSound, true);
    if (wantSound) ambience.chord();
    const veil = $('#veil');
    veil.classList.add('parting');
    setTimeout(() => veil.classList.add('open'), 700);
    setTimeout(() => veil.remove(), 2300);
  });

  /* watch kept seal */
  $('#keptClose').addEventListener('click', closeKept);
  $('#keptShare').addEventListener('click', shareSeal);

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
    if (text.length < 3) return toast('Pour out a little more — the altar is listening.', 'gold');
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
      toast('Placed on the altar. The realm is praying with you.', 'gold');
      markIntercession();
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
  backend.onSouls(list => {
    state.souls = list;
    const own = state.user && list.find(s => s.uid === state.user.uid);
    if (own && (own.streak || 0) > (state.fire.streak || 0)) {
      state.fire.streak = own.streak;
      if (own.watchHourUtc != null && state.fire.watchHourUtc == null) state.fire.watchHourUtc = own.watchHourUtc;
      saveFire(); renderFlame();
    } else if (own && own.watchHourUtc != null && state.fire.watchHourUtc == null) {
      state.fire.watchHourUtc = own.watchHourUtc; saveFire();
    }
    updateSouls();
  });
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

  /* the unbroken chain — claim an hour */
  const hourSel = $('#hourSel');
  const localNow = new Date().getHours();
  for (let h = 0; h < 24; h++) {
    /* options listed in local-day order, values stored as UTC hours */
    const local = (localNow + h) % 24;
    const d = new Date(); d.setHours(local, 0, 0, 0);
    hourSel.append(el('option', { value: String(d.getUTCHours()) },
      d.toLocaleTimeString([], { hour: 'numeric' }) + (h === 0 ? ' (now)' : '')));
  }
  $('#claimBtn').addEventListener('click', () => {
    if (!state.user) return needSignIn();
    state.fire.watchHourUtc = parseInt(hourSel.value, 10);
    saveFire(); beatPresence(); renderChain();
    toast(`Your watch is set for ${hourLabel(state.fire.watchHourUtc)}. The realm counts on you.`, 'gold');
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
    try { await backend.sendMessage(state.dm.openId, text); markIntercession(); }
    catch (e) { console.error(e); toast('Could not send — try again.', 'rose'); }
  };
  $('#dmSend').addEventListener('click', sendWord);
  $('#dmInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendWord(); });

  renderAuth();
}

boot();
