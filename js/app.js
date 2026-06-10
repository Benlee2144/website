/* ═══════════════════════════════════════════════════════════════════
   THE PRAYER REALM — engine
   Auth, live data, rendering, and the atmosphere of the realm.

   Runs in two modes, same experience either way:
   • LIVE — Firebase configured in js/config.js → real Google login,
     real-time shared database, protected by firestore.rules.
   • DEMO — no Firebase yet → everything works on this device only,
     so the realm can be felt before it is connected.
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

const CFG = window.REALM_CONFIG || { firebase: {}, adminEmails: [], shopUrl: '#', brand: 'KingdomCovers' };

/* ── tiny DOM helpers ─────────────────────────────────────────────── */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

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
  healing:    { label: 'Healing',    icon: '🌿' },
  family:     { label: 'Family',     icon: '🏠' },
  faith:      { label: 'Faith',      icon: '✝️' },
  finances:   { label: 'Provision',  icon: '🍞' },
  protection: { label: 'Protection', icon: '🛡️' },
  guidance:   { label: 'Guidance',   icon: '🕯️' },
  praise:     { label: 'Praise',     icon: '👑' },
  other:      { label: 'Other',      icon: '🕊️' },
};
const REACTS = { love: '❤️', dove: '🕊️', cross: '✝️', fire: '🔥' };
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

/* ── state ────────────────────────────────────────────────────────── */
const state = {
  user: null,            // { uid, name, email, photo, admin }
  prayers: [],
  filter: 'all',         // all | mine | answered | <category>
  sort: 'new',           // new | amens
  openComments: new Set(),
  commentsCache: new Map(),   // prayerId → [comments]
  commentUnsubs: new Map(),   // prayerId → unsubscribe()
  sanctuary: null,
};

let backend = null;

/* ═══════════════════════════════════════════════════════════════════
   BACKEND · DEMO (localStorage)
   ═══════════════════════════════════════════════════════════════════ */

function makeLocalBackend() {
  const KEY = 'prayerRealm.v1';
  const USER_KEY = 'prayerRealm.user.v1';
  const now = Date.now();

  const seed = {
    prayers: [
      { id: 'seed-1', uid: 'keeper', name: 'The Realm Keeper', photo: null, anonymous: false,
        text: 'Welcome to the Prayer Realm, saint. Lay whatever you are carrying on this altar — and take a moment to lift up someone else while you are here. This is a demo prayer; yours will appear above it.',
        category: 'faith', createdAt: now - 86400000 * 2, prayedBy: ['a', 'b', 'c'], prayedCount: 3,
        reactions: { love: ['a'], dove: ['b'], cross: ['c'], fire: [] }, answered: false, flags: [], commentCount: 1 },
      { id: 'seed-2', uid: 'keeper', name: 'The Realm Keeper', photo: null, anonymous: true,
        text: 'Praying for every single person who finds this place. May you feel Him closer than your own breath.',
        category: 'praise', createdAt: now - 86400000 * 5, prayedBy: ['a'], prayedCount: 1,
        reactions: { love: [], dove: ['a'], cross: [], fire: ['b'] }, answered: true, flags: [], commentCount: 0 },
    ],
    comments: { 'seed-1': [
      { id: 'c1', uid: 'keeper', name: 'The Realm Keeper', photo: null, anonymous: false,
        text: 'Standing with you in prayer. 🙏', createdAt: now - 86400000 },
    ] },
    sanctuary: { url: '', title: 'The Sanctuary', live: false },
  };

  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)) || seed; } catch { db = seed; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* storage full/blocked */ } };

  let user = null;
  try { user = JSON.parse(localStorage.getItem(USER_KEY)); } catch { user = null; }

  const userCbs = [], prayerCbs = [], sanctCbs = [];
  const emitUser = () => userCbs.forEach(cb => cb(user));
  const emitPrayers = () => { save(); prayerCbs.forEach(cb => cb([...db.prayers])); };
  const emitSanct = () => { save(); sanctCbs.forEach(cb => cb({ ...db.sanctuary })); };
  const commentCbs = new Map(); // prayerId → Set<cb>
  const emitComments = id => { save(); (commentCbs.get(id) || []).forEach(cb => cb([...(db.comments[id] || [])])); };
  const uidGen = () => 'p-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

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
    async signOut() { user = null; localStorage.removeItem(USER_KEY); emitUser(); },

    onPrayers(cb) { prayerCbs.push(cb); cb([...db.prayers]); },
    async addPrayer({ text, category, anonymous }) {
      db.prayers.unshift({
        id: uidGen(), uid: user.uid, name: user.name, photo: user.photo, anonymous,
        text, category, createdAt: Date.now(), prayedBy: [], prayedCount: 0,
        reactions: EMPTY_REACTIONS(), answered: false, flags: [], commentCount: 0,
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
        id: uidGen(), uid: user.uid, name: user.name, photo: user.photo, anonymous,
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
    onSanctuary(cb) { sanctCbs.push(cb); cb({ ...db.sanctuary }); },
    async setSanctuary(s) { db.sanctuary = { ...db.sanctuary, ...s }; emitSanct(); },
    async totalPrayers() { return db.prayers.length; },
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

  // Complete a redirect-based sign-in if one is pending (mobile fallback path).
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
    async addPrayer({ text, category, anonymous }) {
      const u = auth.currentUser;
      await F.addDoc(F.collection(db, 'prayers'), {
        uid: u.uid, name: u.displayName || 'A Saint', photo: u.photoURL || null,
        anonymous, text, category, createdAt: F.serverTimestamp(),
        prayedBy: [], prayedCount: 0, reactions: EMPTY_REACTIONS(),
        answered: false, flags: [], commentCount: 0,
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
      // best-effort: clear comments first so no orphans remain
      try {
        const snap = await F.getDocs(F.query(F.collection(db, 'prayers', id, 'comments'), F.limit(200)));
        await Promise.all(snap.docs.map(d => F.deleteDoc(d.ref)));
      } catch { /* ignore */ }
      await F.deleteDoc(F.doc(db, 'prayers', id));
    },
    async flagPrayer(id) {
      await F.updateDoc(F.doc(db, 'prayers', id), { flags: F.arrayUnion(auth.currentUser.uid) });
    },
    onSanctuary(cb) {
      F.onSnapshot(F.doc(db, 'settings', 'sanctuary'),
        snap => cb(snap.exists() ? snap.data() : { url: '', title: 'The Sanctuary', live: false }),
        err => console.error(err));
    },
    async setSanctuary(s) {
      await F.setDoc(F.doc(db, 'settings', 'sanctuary'),
        { ...s, updatedAt: F.serverTimestamp() }, { merge: true });
    },
    async totalPrayers() {
      try {
        const c = await F.getCountFromServer(F.collection(db, 'prayers'));
        return c.data().count;
      } catch { return null; }
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════
   RENDERING
   ═══════════════════════════════════════════════════════════════════ */

function avatarNode(photo, anonymous, big = true) {
  const cls = big ? 'pc-avatar' : 'comment-avatar';
  if (anonymous) return el('div', { class: `${cls} anon-halo`, title: 'Anonymous' }, '🕊');
  if (photo) return el('img', { class: cls, src: photo, alt: '', referrerPolicy: 'no-referrer' });
  return el('div', { class: `${cls} anon-halo` }, '✝');
}

function displayName(p) { return p.anonymous ? 'Anonymous Saint' : p.name; }

function buildFilterChips() {
  const wrap = $('#filterChips');
  wrap.replaceChildren();
  const mk = (key, label, gold = false) => el('button', {
    class: 'chip' + (state.filter === key ? (gold ? ' gold-on' : ' on') : ''),
    onclick: () => { state.filter = key; renderPrayers(); buildFilterChips(); },
  }, label);
  wrap.append(mk('all', '✦ All'));
  if (state.user) wrap.append(mk('mine', '🤍 Mine'));
  wrap.append(mk('answered', '✨ Answered', true));
  for (const [k, c] of Object.entries(CATS)) wrap.append(mk(k, `${c.icon} ${c.label}`));
}

function buildCatPick() {
  const wrap = $('#catPick');
  wrap.replaceChildren();
  for (const [k, c] of Object.entries(CATS)) {
    wrap.append(el('button', {
      class: 'chip' + (wrap.dataset.sel === k ? ' on' : ''), type: 'button',
      onclick: e => {
        wrap.dataset.sel = k;
        $$('.chip', wrap).forEach(x => x.classList.remove('on'));
        e.currentTarget.classList.add('on');
      },
    }, `${c.icon} ${c.label}`));
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

function reactCounts(p) {
  return Object.keys(REACTS).reduce((n, k) => n + (p.reactions[k]?.length || 0), 0);
}

function renderPrayers() {
  const grid = $('#prayerGrid');

  // preserve a comment draft mid-typing across live re-renders
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

  /* head */
  const head = el('div', { class: 'pc-head' },
    avatarNode(p.photo, p.anonymous),
    el('div', { class: 'pc-who' },
      el('div', { class: 'pc-name' }, displayName(p)),
      el('div', { class: 'pc-meta' },
        el('span', { class: 'pc-cat' }, `${cat.icon} ${cat.label}`),
        el('time', {}, timeAgo(p.createdAt)),
        admin && p.flags.length ? el('span', { class: 'flag-count', title: 'Reported by visitors' }, `🚩 ${p.flags.length}`) : null,
      ),
    ),
    p.answered ? el('span', { class: 'answered-badge' }, '✨ ANSWERED') : null,
  );

  /* amen */
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
  }, prayed ? '🙏 Amen' : '🙏 I prayed',
     el('span', { class: 'cnt' }, p.prayedCount ? String(p.prayedCount) : ''));

  /* reactions */
  const reactBtns = Object.entries(REACTS).map(([k, emoji]) => {
    const on = u && (p.reactions[k] || []).includes(u.uid);
    const n = (p.reactions[k] || []).length;
    return el('button', {
      class: 'react-btn' + (on ? ' on' : ''), title: k,
      onclick: () => {
        if (!u) return needSignIn();
        backend.toggleReact(p.id, k, !on).catch(console.error);
      },
    }, emoji, n ? el('span', { class: 'cnt' }, String(n)) : null);
  });

  /* comments toggle */
  const isOpen = state.openComments.has(p.id);
  const commentBtn = el('button', {
    class: 'react-btn' + (isOpen ? ' on' : ''), title: 'Words of encouragement',
    onclick: () => toggleComments(p.id),
  }, '💬', p.commentCount ? el('span', { class: 'cnt' }, String(p.commentCount)) : null);

  /* owner / admin / report tools */
  const tools = el('span', { class: 'pc-tools' });
  if (mine) tools.append(el('button', {
    class: 'tool-btn', title: p.answered ? 'Unmark answered' : 'Mark as answered',
    onclick: () => backend.markAnswered(p.id, !p.answered).then(() => {
      if (!p.answered) toast('✨ Glory! Marked as answered.', 'gold');
    }).catch(console.error),
  }, p.answered ? '↩ unmark' : '✓ answered'));
  if (mine || admin) tools.append(el('button', {
    class: 'tool-btn danger', title: 'Remove from the altar',
    onclick: () => {
      if (confirm('Remove this prayer from the altar?'))
        backend.deletePrayer(p.id).then(() => toast('Removed from the altar.')).catch(console.error);
    },
  }, '🗑'));
  if (u && !mine) tools.append(el('button', {
    class: 'tool-btn danger', title: 'Report to the keeper',
    onclick: () => {
      if (confirm('Report this prayer to the keeper of the realm?'))
        backend.flagPrayer(p.id).then(() => toast('Reported. The keeper will review it.')).catch(console.error);
    },
  }, '🚩'));

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
          onclick: () => backend.deleteComment(p.id, c.id).catch(console.error) }, '✕')
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
      el('button', { class: 'comment-send', title: 'Send encouragement', onclick: send }, '🕊'));
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

/* ── sanctuary ────────────────────────────────────────────────────── */

function parseVideo(url) {
  if (!url) return null;
  const yt = id => `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1&color=white`;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return yt(u.pathname.slice(1).split('/')[0]);
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      if (u.searchParams.get('v')) return yt(u.searchParams.get('v'));
      const m = u.pathname.match(/\/(?:embed|live|shorts|v)\/([\w-]{6,})/);
      if (m) return yt(m[1]);
    }
    if (host.endsWith('twitch.tv')) {
      const chan = u.pathname.split('/').filter(Boolean)[0];
      if (chan) return `https://player.twitch.tv/?channel=${encodeURIComponent(chan)}&parent=${location.hostname}`;
    }
    if (host.endsWith('tiktok.com')) {
      const m = u.pathname.match(/video\/(\d+)/);
      if (m) return `https://www.tiktok.com/embed/v2/${m[1]}`;
    }
    if (/^https?:$/.test(u.protocol)) return url.trim(); // already an embed link
  } catch { /* not a url */ }
  return null;
}

function renderSanctuary() {
  const s = state.sanctuary || { url: '', title: 'The Sanctuary', live: false };
  $('#liveBadge').hidden = !s.live;
  $('#sanctumTitle').textContent = s.title || 'The Sanctuary';

  const frame = $('#videoFrame');
  const embed = parseVideo(s.url);
  const current = frame.querySelector('iframe');
  if (embed) {
    if (!current || current.src !== embed) {
      frame.replaceChildren(el('iframe', {
        src: embed, title: s.title || 'Sanctuary video', allowFullscreen: true,
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
        referrerPolicy: 'strict-origin-when-cross-origin',
      }));
    }
  } else {
    frame.replaceChildren($('#videoEmpty') || el('div', { id: 'videoEmpty' },
      el('div', { class: 'empty-flame big' }),
      el('p', {}, 'The Sanctuary is being prepared.', el('br'), el('span', {}, 'Return soon for the daily word & live worship.'))));
    $('#videoEmpty').hidden = false;
  }

  // keeper panel reflects current values (without clobbering active edits)
  if (state.user?.admin) {
    const url = $('#adminUrl'), title = $('#adminTitle'), live = $('#adminLive');
    if (document.activeElement !== url) url.value = s.url || '';
    if (document.activeElement !== title) title.value = s.title || '';
    live.checked = !!s.live;
  }
}

/* ── auth-dependent chrome ────────────────────────────────────────── */

function renderAuth() {
  const u = state.user;
  $('#authBtn').textContent = u ? 'Leave quietly' : 'Enter with Google';
  $('#userChip').hidden = !u;
  if (u) {
    $('#userName').textContent = u.name;
    const ph = $('#userPhoto');
    if (u.photo) { ph.src = u.photo; ph.style.display = ''; } else ph.style.display = 'none';
  }
  $('#prayerText').disabled = !u;
  $('#submitPrayer').style.display = u ? '' : 'none';
  $('.composer-row.space .anon').style.visibility = u ? 'visible' : 'hidden';
  $('#composerLocked').hidden = !!u;
  $('#adminPanel').hidden = !(u && u.admin);
  buildFilterChips();
  renderPrayers();
  renderSanctuary();
}

function needSignIn() {
  toast('Enter with Google first, saint. 🙏', 'gold');
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

  /* stars — fixed, twinkling */
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

  /* embers — golden, ascending (prayers rising) */
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
  const glyphs = ['✦', '✧', '·', '+', '🕊'];
  for (let i = 0; i < 9; i++) {
    const s = el('span', { class: 'spark' }, glyphs[Math.floor(Math.random() * glyphs.length)]);
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

      // A minor-9-ish drone: A2 E3 A3 C4 E4 + a high shimmer
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

/* ── verse rotator ────────────────────────────────────────────────── */

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

async function boot() {
  /* atmosphere first — the realm must feel alive immediately */
  startSky(); startHalo(); startVerses();

  /* veil */
  $('#enterBtn').addEventListener('click', () => {
    const wantSound = $('#veilSound').checked;
    setSound(wantSound, true);
    $('#veil').classList.add('open');
    setTimeout(() => $('#veil').remove(), 1600);
  });

  /* sound */
  const soundPref = localStorage.getItem('realm.sound');
  if (soundPref === '0') $('#veilSound').checked = false;
  $('#soundBtn').addEventListener('click', () =>
    setSound(!$('#soundBtn').classList.contains('on'), true));

  /* rooms */
  $$('.room-tab').forEach(tab => tab.addEventListener('click', () => {
    $$('.room-tab').forEach(t => t.classList.toggle('active', t === tab));
    const room = tab.dataset.room;
    document.body.dataset.room = room;
    $$('.room').forEach(r => r.classList.toggle('active', r.id === room));
  }));

  /* shop link */
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
      toast('Tip: Google blocks sign-in inside the TikTok app. Tap ⋯ → “Open in browser”.', 'gold');
    backend.signIn();
  };
  $('#authBtn').addEventListener('click', doAuth);
  $('#lockedAuthBtn').addEventListener('click', doAuth);

  backend.onUser(u => { state.user = u; renderAuth(); });

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
      });
      ta.value = '';
      const r = btn.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top);
      toast('🕊 Placed on the altar. The saints are with you.', 'gold');
    } catch (e) {
      console.error(e);
      toast('The altar could not receive it — try again.', 'rose');
    } finally { btn.disabled = false; }
  });

  /* wall tools */
  $('#sortSel').addEventListener('change', e => { state.sort = e.target.value; renderPrayers(); });
  buildFilterChips();

  /* live data */
  backend.onPrayers(list => { state.prayers = list; renderPrayers(); });
  backend.onSanctuary(s => { state.sanctuary = s; renderSanctuary(); });

  /* keeper panel */
  $('#adminSave').addEventListener('click', async () => {
    const url = $('#adminUrl').value.trim();
    if (url && !parseVideo(url)) return toast('That link could not be read — paste a YouTube, Twitch, or TikTok video link.', 'rose');
    try {
      await backend.setSanctuary({ url, title: $('#adminTitle').value.trim() || 'The Sanctuary', live: $('#adminLive').checked });
      toast('✨ The Sanctuary has been updated.', 'gold');
    } catch (e) { console.error(e); toast('Could not update — are you signed in as the keeper?', 'rose'); }
  });

  renderAuth();
}

boot();
