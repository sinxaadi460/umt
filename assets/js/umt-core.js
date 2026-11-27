/* ===================================================================
   umt-core.js  —  Firebase Auth + Firestore layer for AADI
   Loaded as:  <script type="module" src=".../assets/js/umt-core.js">
   Exposes:    window.UMT
   =================================================================== */
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const ROOT = new URL('../../', import.meta.url).href;      // site root, e.g. https://site.vercel.app/
const pick = o => (o && o.apiKey && o.projectId) ? o : null;
const isPlaceholder = o => /PASTE|YOUR_|XXXX/i.test(String(o.apiKey) + String(o.projectId));

/* -------- find the Firebase config. Accepts: window.UMT_FIREBASE (default file), a pasted `const firebaseConfig = {...}`,
            or even the raw snippet Firebase shows (we read the file as text and pull the values out of it). */
let cfg = pick(window.UMT_FIREBASE) || pick(window.firebaseConfig) || (typeof firebaseConfig !== 'undefined' ? pick(firebaseConfig) : null);
let cfgSource = cfg ? 'firebase-config.js' : '';
if (!cfg) {
  try {
    const txt = await (await fetch(ROOT + 'assets/js/firebase-config.js?t=' + Date.now(), { cache: 'no-store' })).text();
    const g = k => (txt.match(new RegExp('\\b' + k + '\\s*:\\s*["\'`]([^"\'`]+)["\'`]')) || [])[1];
    const o = { apiKey: g('apiKey'), authDomain: g('authDomain'), projectId: g('projectId'), storageBucket: g('storageBucket'), messagingSenderId: g('messagingSenderId'), appId: g('appId') };
    if (pick(o)) { cfg = o; cfgSource = 'parsed from file text'; }
  } catch (e) { /* ignore */ }
}
cfg = cfg || {};
export const configured = !!(cfg.apiKey && cfg.projectId && !isPlaceholder(cfg));

export const UMT = { configured, root: ROOT, cfg, cfgSource, user: null, profile: null, ctx: {}, fs: null, db: null, auth: null, initError: null, profileError: null };
window.UMT = UMT;

let A = {}, F = {}, APPFN = null;
if (configured) {
  try {
    const [app, auth, fs] = await Promise.all([
      import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')]);
    A = auth; F = fs; UMT.A = auth; UMT.fs = fs; APPFN = app.initializeApp;
    UMT.app = app.initializeApp(cfg);
    UMT.auth = auth.getAuth(UMT.app);
    UMT.db = fs.getFirestore(UMT.app);
  } catch (e) { UMT.initError = e; console.error('Firebase SDK load failed', e); }
}

/* ---------------------------------------------------------------- small utils */
export const MS = v => (v && v.toMillis ? v.toMillis() : (typeof v === 'number' ? v : (v && v.seconds ? v.seconds * 1000 : 0)));
UMT.MS = MS;
UMT.fmtDate = v => { const m = MS(v); return m ? new Date(m).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'; };
UMT.fmtDT = v => { const m = MS(v); return m ? new Date(m).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'; };
UMT.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, '');
const digits = s => String(s || '').replace(/\D/g, '').slice(-10);
const rnd = n => { let s = ''; const a = new Uint32Array(n); crypto.getRandomValues(a); a.forEach(v => s += v % 10); return s; };
UMT.rnd = rnd; UMT.digits = digits;
const isEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
const idKey = (role, v) => role + ':' + (String(v).includes('@') ? norm(v) : (/^[\d\s+-]+$/.test(String(v)) ? digits(v) : norm(v)));

const MSG = {
  'auth/invalid-credential': 'ID ya password galat hai.', 'auth/wrong-password': 'ID ya password galat hai.',
  'auth/user-not-found': 'Ye account nahi mila.', 'auth/invalid-email': 'Email sahi nahi hai.',
  'auth/email-already-in-use': 'Is email se account pehle se hai. Login karein ya dusra email use karein.',
  'auth/weak-password': 'Password kam se kam 6 akshar ka rakhein.',
  'auth/too-many-requests': 'Bahut zyada koshish. Thodi der baad try karein.',
  'auth/network-request-failed': 'Internet check karein.',
  'auth/operation-not-allowed': 'Firebase Console mein Authentication > Email/Password enable karein.',
  'auth/unauthorized-domain': 'Ye domain Firebase mein authorized nahi hai. Firebase Console > Authentication > Settings > Authorized domains mein apna Vercel domain add karein.',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'Firebase apiKey galat hai. firebase-config.js check karein.',
  'auth/invalid-api-key': 'Firebase apiKey galat hai. firebase-config.js check karein.',
  'auth/configuration-not-found': 'Firebase Authentication abhi start nahi hua. Console > Authentication > Get started karein.',
  'failed-precondition': 'Firestore Database abhi create nahi hua. Console > Firestore Database > Create database karein.',
  'unavailable': 'Firebase se connect nahi ho paya. Internet check karein.',
  'permission-denied': 'Permission nahi mili. Firestore rules publish karein (firestore.rules file ka content Rules tab mein paste karke Publish).'
};
const fail = m => { const e = new Error(m); e.__umt = true; throw e; };
const ensure = () => { if (!configured) fail('Firebase config abhi set nahi hai (assets/js/firebase-config.js).'); if (UMT.initError) fail('Firebase load nahi hua: ' + ((UMT.initError && UMT.initError.message) || UMT.initError) + ' — internet / ad-blocker check karein.'); };
const err = e => { if (e && e.__umt) return e; const code = e && e.code ? String(e.code).replace(/^firestore\//, '') : ''; const x = new Error(MSG[e && e.code] || MSG[code] || (e && e.message) || 'Kuch galat hua.'); x.__umt = true; return x; };
const need = (v, label) => { if (!String(v || '').trim()) fail(label + ' zaroori hai.'); };
UMT.err = err;

/* ---------------------------------------------------------------- toast */
UMT.toast = (msg, type = 'ok') => {
  let box = document.getElementById('umtToasts');
  if (!box) { box = document.createElement('div'); box.id = 'umtToasts'; document.body.appendChild(box); }
  const t = document.createElement('div'); t.className = 'umt-toast ' + type; t.textContent = msg; box.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 4200);
};

/* ---------------------------------------------------------------- firestore helpers */
const R = (...p) => F.doc(UMT.db, ...p.flat());
UMT.get = async (...p) => { const s = await F.getDoc(R(...p)); return s.exists() ? { id: s.id, ...s.data() } : null; };
UMT.set = (path, data) => F.setDoc(R(path), data);
UMT.merge = (path, data) => F.setDoc(R(path), data, { merge: true });
UMT.update = (path, data) => F.updateDoc(R(path), data);
UMT.del = path => F.deleteDoc(R(path));
UMT.add = async (name, data) => { const r = await F.addDoc(F.collection(UMT.db, name), data); return r.id; };
UMT.ts = () => F.serverTimestamp();
UMT.list = async (name, ...wheres) => {
  const q = F.query(F.collection(UMT.db, name), ...wheres.map(w => F.where(...w)));
  const s = await F.getDocs(q), out = []; s.forEach(d => out.push({ id: d.id, ...d.data() })); return out;
};
UMT.newest = arr => arr.sort((a, b) => MS(b.createdAt) - MS(a.createdAt));

/* ---------------------------------------------------------------- profile / context */
async function loadCtx(u) {
  const prof = await UMT.get('users', u.uid);
  UMT.profile = prof; const ctx = { user: prof || {} };
  if (prof) {
    if (prof.role === 'institute') ctx.inst = await UMT.get('institutes', prof.instituteCode);
    else if (prof.role === 'teacher') { ctx.staff = await UMT.get('staff', u.uid); ctx.inst = await UMT.get('institutes', prof.instituteCode); }
    else if (prof.role === 'student') {
      ctx.stu = await UMT.get('students', u.uid);
      ctx.memberships = await UMT.list('memberships', ['studentUid', '==', u.uid]);
      ctx.mem = ctx.memberships.find(m => m.status === 'approved') || null;
      if (ctx.mem) ctx.inst = await UMT.get('institutes', ctx.mem.instituteCode);
    }
  }
  UMT.ctx = ctx;
}

UMT.ready = new Promise(res => {
  if (!configured || UMT.initError) { res(); return; }
  let first = true;
  A.onAuthStateChanged(UMT.auth, async u => {
    UMT.user = u;
    if (!UMT._busy) { try { UMT.profileError = null; if (u) await loadCtx(u); else { UMT.profile = null; UMT.ctx = {}; } } catch (e) { console.error(e); UMT.profileError = e; } }
    if (first) { first = false; res(); }
  });
});

const HOME = { institute: 'panel/index.html', student: 'student/index.html', teacher: 'teacher/index.html' };
UMT.home = role => ROOT + (HOME[role] || 'login.html');

/* ---------------------------------------------------------------- login / logout */
UMT.resolveEmail = async (role, id) => {
  id = String(id || '').trim(); if (!id) fail('ID daalein.');
  if (isEmail(id)) return id.toLowerCase();
  const ix = await UMT.get('loginIndex', idKey(role, id));
  if (!ix || !ix.email) fail('Is ID se ' + ({ institute: 'Institute', student: 'Student', teacher: 'Teacher' }[role]) + ' account nahi mila. Sahi tab chuna hai?');
  return ix.email;
};
UMT.login = async (role, id, password) => {
  ensure();
  try {
    need(password, 'Password');
    const email = await UMT.resolveEmail(role, id);
    UMT._busy = true;
    const cred = await A.signInWithEmailAndPassword(UMT.auth, email, password);
    const prof = await UMT.get('users', cred.user.uid);
    if (!prof) { await A.signOut(UMT.auth); fail('Account ka profile nahi mila. Dobara register karein.'); }
    if (prof.role !== role) {
      await A.signOut(UMT.auth);
      fail('Ye ' + ({ institute: 'Institute', student: 'Student', teacher: 'Teacher' }[prof.role] || prof.role) + ' account hai. Upar ' + ({ institute: 'Institute', student: 'Student', teacher: 'Teacher' }[prof.role]) + ' tab se login karein.');
    }
    if (prof.status === 'blocked') { await A.signOut(UMT.auth); fail('Aapka account block hai. Support se baat karein.'); }
    await loadCtx(cred.user);
    return prof;
  } catch (e) { throw err(e); } finally { UMT._busy = false; }
};
UMT.logout = async () => { if (configured) await A.signOut(UMT.auth); location.href = ROOT + 'login.html'; };
UMT.resetPassword = async (role, id) => {
  ensure();
  try { const email = await UMT.resolveEmail(role, id); await A.sendPasswordResetEmail(UMT.auth, email); return email; } catch (e) { throw err(e); }
};
UMT.changePassword = async np => {
  try { if (String(np).length < 6) fail('Password kam se kam 6 akshar ka rakhein.'); await A.updatePassword(UMT.user, np); }
  catch (e) { if (e && e.code === 'auth/requires-recent-login') fail('Security ke liye pehle logout karke dobara login karein, phir password badlein.'); throw err(e); }
};

/* ---------------------------------------------------------------- registration */
// If an earlier attempt created the Auth user but failed before the profile was saved (e.g. rules not published yet),
// let the same email + password finish the registration instead of getting stuck on "email already in use".
async function createOrResume(email, password) {
  try { return await A.createUserWithEmailAndPassword(UMT.auth, email, password); }
  catch (e) {
    if (e && e.code === 'auth/email-already-in-use') {
      try { const c = await A.signInWithEmailAndPassword(UMT.auth, email, password); let p = null; try { p = await UMT.get('users', c.user.uid); } catch (_) { } if (!p) return c; await A.signOut(UMT.auth); } catch (_) { }
    }
    throw e;
  }
}
async function secondaryCreate(email, password) {          // create an account without logging the current user out
  const app2 = APPFN(cfg, 'sec' + Date.now()); const a2 = A.getAuth(app2);
  const c = await A.createUserWithEmailAndPassword(a2, email, password); await A.signOut(a2); return c.user.uid;
}
const writeIndex = (role, keys, email, uid) => Promise.all(keys.filter(Boolean).map(k => UMT.set(['loginIndex', idKey(role, k)], { email, role, uid })));
async function assertFree(role, vals) {
  for (const v of vals.filter(Boolean)) if (await UMT.get('loginIndex', idKey(role, v))) fail((isEmail(v) ? 'Ye email' : 'Ye mobile number') + ' pehle se registered hai. Login karein.');
}

UMT.registerInstitute = async d => {
  ensure();
  try {
    need(d.instName, 'Institute ka naam'); need(d.ownerName, 'Owner ka naam');
    const mobile = digits(d.mobile); if (mobile.length !== 10) fail('10 digit ka mobile number daalein.');
    if (!isEmail(d.email)) fail('Sahi email daalein.');
    if (String(d.password || '').length < 6) fail('Password kam se kam 6 akshar ka rakhein.');
    if (d.password !== d.password2) fail('Dono password match nahi karte.');
    const email = d.email.trim().toLowerCase();
    await assertFree('institute', [mobile, email]);
    let code = ''; for (let i = 0; i < 8 && !code; i++) { const c = 'BR' + rnd(6); if (!(await UMT.get('institutes', c))) code = c; }
    if (!code) fail('Institute code nahi ban paya, dobara try karein.');
    UMT._busy = true;
    const cred = await createOrResume(email, d.password), uid = cred.user.uid, now = UMT.ts();
    await UMT.set(['users', uid], { role: 'institute', uid, name: d.ownerName.trim(), mobile, email, instituteCode: code, status: 'active', createdAt: now });
    await UMT.set(['institutes', code], {
      code, name: d.instName.trim(), type: d.type || 'Computer Centre', ownerUid: uid, ownerName: d.ownerName.trim(), mobile, email,
      address: (d.address || '').trim(), city: (d.city || '').trim(), state: (d.state || '').trim(), pincode: (d.pincode || '').trim(),
      referredBy: (d.referral || '').trim().toUpperCase(), plan: 'FREE', wallet: 0, status: 'active', affiliation: 'none', createdAt: now
    });
    await writeIndex('institute', [email, mobile, code], email, uid);
    await loadCtx(cred.user);
    return { code, uid };
  } catch (e) { throw err(e); } finally { UMT._busy = false; }
};

UMT.registerStudent = async d => {
  ensure();
  try {
    need(d.name, 'Naam');
    const mobile = digits(d.mobile); if (mobile.length !== 10) fail('10 digit ka mobile number daalein.');
    const realEmail = String(d.email || '').trim().toLowerCase(); if (realEmail && !isEmail(realEmail)) fail('Email sahi nahi hai.');
    if (String(d.password || '').length < 6) fail('Password kam se kam 6 akshar ka rakhein.');
    if (d.password !== d.password2) fail('Dono password match nahi karte.');
    const email = realEmail || (mobile + '@student.umtvidya.in');
    await assertFree('student', [mobile, realEmail]);
    const icode = String(d.instituteCode || '').trim().toUpperCase(); let inst = null;
    if (icode) { inst = await UMT.get('institutes', icode); if (!inst) fail('Institute code ' + icode + ' nahi mila. Sahi code daalein ya khali chhod dein.'); }
    let enr = ''; for (let i = 0; i < 8 && !enr; i++) { const c = 'VS' + rnd(10); if (!(await UMT.get('loginIndex', idKey('student', c)))) enr = c; }
    UMT._busy = true;
    const cred = await createOrResume(email, d.password), uid = cred.user.uid, now = UMT.ts();
    await UMT.set(['users', uid], { role: 'student', uid, name: d.name.trim(), mobile, email, enrollmentNo: enr, status: 'active', createdAt: now });
    await UMT.set(['students', uid], { uid, name: d.name.trim(), mobile, email: realEmail, dob: d.dob || '', gender: d.gender || '', fatherName: '', motherName: '', enrollmentNo: enr, referredBy: (d.referral || '').trim().toUpperCase(), createdAt: now });
    await writeIndex('student', [realEmail, mobile, enr], email, uid);
    if (inst) await UMT.set(['memberships', inst.code + '_' + uid], { instituteCode: inst.code, instituteName: inst.name, studentUid: uid, name: d.name.trim(), mobile, enrollmentNo: enr, course: '', status: 'pending', requestedBy: 'student', createdAt: now });
    await loadCtx(cred.user);
    return { enrollmentNo: enr, uid, pending: !!inst };
  } catch (e) { throw err(e); } finally { UMT._busy = false; }
};

/* institute adds a student directly (no logout of the institute) */
UMT.addStudentByInstitute = async d => {
  try {
    const inst = UMT.ctx.inst; if (!inst) fail('Institute profile nahi mila.');
    need(d.name, 'Student ka naam'); const mobile = digits(d.mobile); if (mobile.length !== 10) fail('10 digit ka mobile number daalein.');
    const realEmail = String(d.email || '').trim().toLowerCase(); if (realEmail && !isEmail(realEmail)) fail('Email sahi nahi hai.');
    const password = String(d.password || '').trim() || (mobile.slice(-6)); if (password.length < 6) fail('Password kam se kam 6 akshar ka rakhein.');
    const email = realEmail || (mobile + '@student.umtvidya.in');
    await assertFree('student', [mobile, realEmail]);
    let enr = ''; for (let i = 0; i < 8 && !enr; i++) { const c = 'VS' + rnd(10); if (!(await UMT.get('loginIndex', idKey('student', c)))) enr = c; }
    UMT._busy = true;
    const uid = await secondaryCreate(email, password), now = UMT.ts(), me = UMT.user.uid;
    const full = (d.name + ' ' + (d.last_name || '')).trim();
    await UMT.set(['users', uid], { role: 'student', uid, name: full, mobile, email, enrollmentNo: enr, status: 'active', createdBy: me, createdAt: now });
    await UMT.set(['students', uid], { uid, name: full, mobile, email: realEmail, dob: d.dob || '', gender: d.gender || '', fatherName: d.father_name || '', motherName: d.mother_name || '', category: d.category || '', address: d.address || '', enrollmentNo: enr, createdBy: me, createdAt: now });
    await writeIndex('student', [realEmail, mobile, enr], email, uid);
    await UMT.set(['memberships', inst.code + '_' + uid], { instituteCode: inst.code, instituteName: inst.name, studentUid: uid, name: full, mobile, enrollmentNo: enr, fatherName: d.father_name || '', course: d.course || '', session: d.session || '', rollNo: d.roll_no || '', totalFee: Number(d.total_fee) || 0, monthlyFee: Number(d.monthly_fee) || 0, status: 'approved', requestedBy: 'institute', createdBy: me, createdAt: now });
    return { uid, enrollmentNo: enr, password };
  } catch (e) { throw err(e); } finally { UMT._busy = false; }
};

UMT.addTeacher = async d => {
  try {
    const inst = UMT.ctx.inst; if (!inst) fail('Institute profile nahi mila.');
    need(d.name, 'Teacher ka naam'); const mobile = digits(d.mobile); if (mobile.length !== 10) fail('10 digit ka mobile number daalein.');
    const password = String(d.password || ''); if (password.length < 6) fail('Password kam se kam 6 akshar ka rakhein.');
    const realEmail = String(d.email || '').trim().toLowerCase(); if (realEmail && !isEmail(realEmail)) fail('Email sahi nahi hai.');
    let sid = ''; for (let i = 0; i < 8 && !sid; i++) { const c = 'TC' + rnd(6); if (!(await UMT.get('loginIndex', idKey('teacher', c)))) sid = c; }
    const email = realEmail || (sid.toLowerCase() + '@staff.umtvidya.in');
    await assertFree('teacher', [mobile, realEmail]);
    UMT._busy = true;
    const uid = await secondaryCreate(email, password), now = UMT.ts(), me = UMT.user.uid;
    await UMT.set(['users', uid], { role: 'teacher', uid, name: d.name.trim(), mobile, email, instituteCode: inst.code, staffId: sid, status: 'active', createdBy: me, createdAt: now });
    await UMT.set(['staff', uid], { uid, instituteCode: inst.code, name: d.name.trim(), mobile, email: realEmail, staffId: sid, subject: d.subject || '', status: 'active', createdBy: me, createdAt: now });
    await writeIndex('teacher', [realEmail, mobile, sid], email, uid);
    return { uid, staffId: sid };
  } catch (e) { throw err(e); } finally { UMT._busy = false; }
};

/* ---------------------------------------------------------------- guard + binding */
function banner(text) {
  if (document.getElementById('umtPreview')) return;
  const b = document.createElement('div'); b.id = 'umtPreview'; b.innerHTML = text; document.body.prepend(b);
}
UMT.guard = async role => {
  await UMT.ready;
  if (!configured) { banner('<b>Preview mode</b> — Firebase config set nahi hai. <code>assets/js/firebase-config.js</code> mein apna config daalein. Check: <a href="' + ROOT + 'check.html">check.html</a>'); return null; }
  if (UMT.initError) { banner('<b>Firebase load nahi hua</b> — ' + UMT.esc(String((UMT.initError && UMT.initError.message) || UMT.initError)) + ' · <a href="' + ROOT + 'check.html">check.html</a>'); return new Promise(() => { }); }
  const back = (why) => { try { sessionStorage.setItem('umt_err', why || ''); } catch (e) { } location.replace(ROOT + 'login.html?as=' + role + '&next=' + encodeURIComponent(location.pathname + location.search)); return new Promise(() => { }); };
  if (!UMT.user) return back('');
  if (!UMT.profile) return back('Login ho gaya lekin aapka profile load nahi hua' + (UMT.profileError ? ': ' + err(UMT.profileError).message : ' (profile record nahi mila — dobara register karein).') + ' Details ke liye check.html kholein.');
  if (UMT.profile.role !== role) { location.replace(UMT.home(UMT.profile.role)); return new Promise(() => { }); }
  return UMT.profile;
};
UMT.bind = () => {
  const c = UMT.ctx || {};
  document.querySelectorAll('[data-u]').forEach(el => {
    const [a, b] = el.dataset.u.split('.'); const v = c[a] && c[a][b];
    el.textContent = (v == null || v === '') ? (el.dataset.empty || '') : v;
  });
};
UMT.page = () => { let p = location.pathname.replace(/^\/+/, '').replace(/\.html$/, ''); if (!p) p = 'index'; if (p.endsWith('/')) p += 'index'; return p; };

document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a[href$="logout.html"],a[href*="logout.html?"]');
  if (a && configured) { e.preventDefault(); UMT.logout(); }
});

export default UMT;
