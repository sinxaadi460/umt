/* ===================================================================
   umt-pages.js — page logic for panel/ (institute), student/ and teacher/
   Every page that has <div id="app"> is rendered from Firestore here.
   =================================================================== */
import { UMT } from './umt-core.js';

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const E = UMT.esc, MS = UMT.MS;
const page = UMT.page(), area = page.split('/')[0];
const ROLE = { panel: 'institute', student: 'student', teacher: 'teacher' }[area];
const localDate = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const today = () => localDate();
const inst = () => UMT.ctx.inst || {};
const code = () => inst().code;
const me = () => UMT.profile || {};

/* ---------- static <form method="post"> can never work without a server: never let them post */
document.addEventListener('submit', e => {
  const f = e.target;
  if (f.matches && f.matches('form[method="post"]') && !f.hasAttribute('data-live')) {
    e.preventDefault();
    UMT.toast(UMT.configured ? 'Ye feature abhi Firebase se connect nahi hua.' : 'Preview mode — Firebase config set nahi hai.', 'warn');
  }
}, true);

/* ---------- tiny UI helpers */
const app = () => $('#app');
const mount = h => { app().innerHTML = h; };
const card = (t, inner, cls = '') => `<div class="card ${cls}">${t ? `<h3>${t}</h3>` : ''}${inner}</div>`;
const table = (heads, rows, empty) => rows.length
  ? `<div class="table-wrap"><table class="tbl"><thead><tr>${heads.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`
  : `<div class="empty">${empty || 'Abhi koi record nahi.'}</div>`;
const BADGE = { approved: 'ok', pending: 'warn', left: 'bad', rejected: 'bad', open: 'warn', resolved: 'ok', new: 'warn', admitted: 'ok', active: 'ok', contacted: '' };
const bdg = s => `<span class="badge ${BADGE[s] || ''}">${E(s)}</span>`;
const fv = f => Object.fromEntries(new FormData(f).entries());
const copy = t => (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => UMT.toast('Copied ✔')).catch(() => prompt('Copy karein:', t));
const msg = (t, type = 'success') => `<div class="alert alert-${type}">${t}</div>`;
async function guarded(btn, fn) {
  if (btn) btn.disabled = true;
  try { return await fn(); } catch (e) { UMT.toast(UMT.err(e).message, 'err'); } finally { if (btn) btn.disabled = false; }
}
const field = (label, input, cls = '') => `<div class="field ${cls}"><label>${label}</label>${input}</div>`;
const inp = (name, v = '', extra = '') => `<input class="input" name="${name}" value="${E(v)}" ${extra}>`;
const money = n => '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const DOC_TYPES = [['certificate', 'Course Certificate / Diploma'], ['marksheet', 'Marksheet'], ['id_card', 'Student ID Card'], ['admit_card', 'Admit Card'],
['tc', 'Transfer Certificate (TC)'], ['character', 'Character Certificate'], ['bonafide', 'Bonafide Certificate'], ['completion', 'Course Completion Letter'],
['study', 'Study Certificate'], ['provisional', 'Provisional Certificate'], ['attendance_cert', 'Attendance Certificate'], ['conduct', 'Conduct Certificate'],
['no_dues', 'No Dues Certificate'], ['noc', 'No Objection Certificate (NOC)']];
const typeLabel = t => (DOC_TYPES.find(x => x[0] === t) || [0, t])[1];
const gradeOf = p => p >= 90 ? 'A+' : p >= 80 ? 'A' : p >= 70 ? 'B+' : p >= 60 ? 'B' : p >= 50 ? 'C' : p >= 40 ? 'D' : 'F';
const kindMatch = (k, t) => !k ? true : k === 'certificate' ? !['id_card', 'admit_card', 'marksheet'].includes(t) : t === k;

const H = {};   // page handlers: 'panel/students' -> async fn

/* ===================================================================
   STUDENT LIST (institute + teacher)
   =================================================================== */
async function studentsUI(statuses, canEdit, title) {
  const c = code();
  const [all, courses] = await Promise.all([UMT.list('memberships', ['instituteCode', '==', c]), UMT.list('courses', ['instituteCode', '==', c])]);
  const rows = UMT.newest(all).filter(m => statuses.includes(m.status));
  mount(card('', `<div class="row" style="gap:10px;flex-wrap:wrap;align-items:end">
      <div class="field" style="flex:1;min-width:200px"><label>Search</label><input class="input" id="sq" placeholder="Naam, enrollment, mobile, roll no..."></div>
      <div class="field"><label>Course</label><select class="input" id="sc"><option value="">All</option>${[...new Set([...courses.map(x => x.name), ...rows.map(x => x.course).filter(Boolean)])].map(x => `<option>${E(x)}</option>`).join('')}</select></div>
      ${canEdit ? '<a class="btn btn-primary" href="student-add.html"><i class="fa-solid fa-user-plus"></i> Add Student</a>' : ''}
    </div>`) + `<div class="card"><h3>${title} (<span id="scount">${rows.length}</span>)</h3><div id="slist"></div></div>`);
  const act = m => {
    if (!canEdit) return '';
    const b = (a, l, cls = 'btn-light') => `<button class="btn ${cls} btn-sm" data-act="${a}" data-id="${E(m.id)}">${l}</button>`;
    if (m.status === 'pending') return b('approve', 'Approve', 'btn-primary') + ' ' + b('reject', 'Reject');
    if (m.status === 'approved') return b('edit', 'Edit') + ' ' + `<a class="btn btn-light btn-sm" href="generate.html?type=certificate&student=${E(m.studentUid)}">Issue doc</a> ` + b('leave', 'Mark left');
    if (m.status === 'left') return b('restore', 'Restore');
    return b('approve', 'Approve');
  };
  function draw() {
    const q = $('#sq').value.trim().toLowerCase(), cf = $('#sc').value;
    const l = rows.filter(m => (!cf || m.course === cf) && (!q || [m.name, m.enrollmentNo, m.mobile, m.rollNo, m.course].join(' ').toLowerCase().includes(q)));
    $('#scount').textContent = l.length;
    $('#slist').innerHTML = table(['Roll', 'Student', 'Enrollment', 'Mobile', 'Course', 'Status', ''],
      l.map(m => `<tr><td>${E(m.rollNo || '-')}</td><td><b>${E(m.name)}</b>${m.fatherName ? `<br><small class="muted">S/o ${E(m.fatherName)}</small>` : ''}</td><td class="mono">${E(m.enrollmentNo)}</td><td>${E(m.mobile)}</td><td>${E(m.course || '-')}<br><small class="muted">${E(m.session || '')}</small></td><td>${bdg(m.status)}</td><td style="white-space:nowrap">${act(m)}</td></tr>`),
      'Koi student nahi mila.');
  }
  $('#sq').addEventListener('input', draw); $('#sc').addEventListener('change', draw); draw();
  app().addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return; const m = rows.find(x => x.id === b.dataset.id); if (!m) return;
    await guarded(b, async () => {
      const a = b.dataset.act, ref = ['memberships', m.id];
      if (a === 'approve') { const course = prompt('Course name (optional):', m.course || ''); if (course === null) return; await UMT.update(ref, { status: 'approved', course, approvedAt: UMT.ts() }); m.status = 'approved'; m.course = course; }
      else if (a === 'reject') { if (!confirm(m.name + ' ki request reject karein?')) return; await UMT.update(ref, { status: 'rejected' }); m.status = 'rejected'; }
      else if (a === 'leave') { if (!confirm(m.name + ' ko "left" mark karein?')) return; await UMT.update(ref, { status: 'left' }); m.status = 'left'; }
      else if (a === 'restore') { await UMT.update(ref, { status: 'approved' }); m.status = 'approved'; }
      else if (a === 'edit') {
        const course = prompt('Course:', m.course || ''); if (course === null) return; const session = prompt('Session (e.g. 2026-27):', m.session || ''); if (session === null) return;
        const rollNo = prompt('Roll no:', m.rollNo || ''); if (rollNo === null) return; const tf = prompt('Total course fee (₹):', m.totalFee || ''); if (tf === null) return;
        Object.assign(m, { course, session, rollNo, totalFee: Number(tf) || 0 }); await UMT.update(ref, { course, session, rollNo, totalFee: m.totalFee });
      }
      const i = rows.indexOf(m); if (!statuses.includes(m.status) && i > -1) rows.splice(i, 1); draw(); UMT.toast('Updated ✔');
    });
  });
}
H['panel/students'] = () => studentsUI(['approved'], true, 'Students');
H['panel/students-pending'] = () => studentsUI(['pending'], true, 'Pending Approval');
H['panel/students-left'] = () => studentsUI(['left', 'rejected'], true, 'Students who left');
H['teacher/students'] = () => studentsUI(['approved'], false, 'Students');

/* ===================================================================
   ADD STUDENT (uses the original big form)
   =================================================================== */
H['panel/student-add'] = async () => {
  const f = $('form.card'); if (!f) return; f.setAttribute('data-live', '1');
  const courses = UMT.newest(await UMT.list('courses', ['instituteCode', '==', code()]));
  const old = f.elements.course_id, box = old && (old.closest('.ss-wrap') || old);
  if (box) box.outerHTML = `<select class="input" name="course_id"><option value="">${courses.length ? '— Select course —' : '— Pehle "Mere Courses" mein course banayein —'}</option>${courses.map(c => `<option>${E(c.name)}</option>`).join('')}</select>`;
  const link = UMT.root + 'register.html?as=student&inst=' + code();
  f.insertAdjacentHTML('beforebegin', `<div class="alert alert-success small">Students khud bhi register kar sakte hain: <code>${E(link)}</code> <button type="button" class="btn btn-light btn-sm" id="cpLink">Copy</button></div><div id="addOut"></div>`);
  $('#cpLink').onclick = () => copy(link);
  if (f.elements.password) f.elements.password.placeholder = 'Khali = mobile ke last 6 digit';
  f.addEventListener('submit', async ev => {
    ev.preventDefault(); const btn = f.querySelector('button[type=submit],button:not([type])');
    await guarded(btn, async () => {
      const d = fv(f); d.course = d.course_id; const r = await UMT.addStudentByInstitute(d);
      $('#addOut').innerHTML = msg(`<b>Student add ho gaya.</b><br>Enrollment No.: <b class="mono">${E(r.enrollmentNo)}</b> · Password: <b class="mono">${E(r.password)}</b><br><small>Ye details student ko de dein (login: Student tab).</small>`);
      f.reset(); window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
};

/* ===================================================================
   DASHBOARDS
   =================================================================== */
H['panel/index'] = async () => {
  const c = code(), now = new Date(), ms0 = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const [mem, docs, fees, att, notices] = await Promise.all([
    UMT.list('memberships', ['instituteCode', '==', c]), UMT.list('documents', ['instituteCode', '==', c]), UMT.list('fees', ['instituteCode', '==', c]),
    UMT.list('attendance', ['instituteCode', '==', c], ['date', '==', today()]), UMT.list('notices', ['instituteCode', '==', c])]);
  const sts = $$('.stats .stat');
  const set = (i, v, label) => { if (!sts[i]) return; $('b', sts[i]).textContent = v; if (label) $('span', sts[i]).textContent = label; };
  const dm = docs.filter(d => MS(d.createdAt) >= ms0).length;
  set(0, mem.filter(m => m.status === 'approved').length); set(1, mem.filter(m => m.status === 'pending').length);
  set(2, docs.length, `Documents (${dm} this month)`); set(3, money(0), "Today's spend (wallet)");
  set(4, money(fees.filter(x => MS(x.createdAt) >= ms0).reduce((s, x) => s + (Number(x.amount) || 0), 0)).replace('.00', ''), 'Fee collection this month');
  set(5, att.filter(a => a.status === 'P').length, 'Aaj present');
  const tb = $('.tbl tbody');
  if (tb) { const l = UMT.newest(docs).slice(0, 5); tb.innerHTML = l.length ? l.map(d => `<tr><td><a href="documents.html">${E(d.typeLabel || d.type)}</a><br><small class="muted mono">${E(d.id)}</small></td><td>${E(d.studentName)}</td><td class="small">${UMT.fmtDT(d.createdAt)}</td></tr>`).join('') : '<tr><td colspan="3" class="empty">Abhi koi document issue nahi hua.</td></tr>'; }
  const nt = $$('.card').find(x => /Admin Notices/.test(x.textContent));
  if (nt) { const p = $('p.muted', nt); if (p) p.textContent = notices.length ? 'Last notice: ' + UMT.newest(notices)[0].title : 'No notices.'; }
};

H['student/index'] = async () => {
  const uid = me().uid, [att, fees, docs] = await Promise.all([UMT.list('attendance', ['studentUid', '==', uid]), UMT.list('fees', ['studentUid', '==', uid]), UMT.list('documents', ['studentUid', '==', uid])]);
  const mems = (UMT.ctx.memberships || []).filter(m => m.status === 'approved');
  const paid = fees.reduce((s, x) => s + (Number(x.amount) || 0), 0), total = mems.reduce((s, m) => s + (Number(m.totalFee) || 0), 0);
  const pres = att.filter(a => a.status === 'P').length, ms = docs.filter(d => d.type === 'marksheet'), last = UMT.newest(ms)[0];
  const st = $('.stats');
  if (st) {
    const S = (cls, ic, v, l, href) => `<div class="stat ${cls}"><div class="ic"><i class="fa-solid ${ic}"></i></div><div><b>${v}</b><span>${l}</span></div><a class="stretch" href="${href}"></a></div>`;
    st.innerHTML = S('', 'fa-calendar-check', att.length ? Math.round(pres / att.length * 100) + '%' : '-', `Attendance (${pres}/${att.length})`, 'attendance.html') +
      S('teal', 'fa-indian-rupee-sign', money(Math.max(0, total - paid)).replace('.00', ''), `Fee Due (paid ${money(paid).replace('.00', '')})`, 'fees.html') +
      S('blue', 'fa-certificate', docs.length, 'My Documents', 'documents.html') +
      S('gold', 'fa-square-poll-vertical', last ? (last.grade || (last.percentage + '%')) : '-', 'Result', 'result.html') +
      S('violet', 'fa-building-columns', mems.length, 'My Institutes', 'my-institutes.html');
  }
  const stu = UMT.ctx.stu || {}, miss = [['fatherName', "Father's name"], ['motherName', "Mother's name"], ['dob', 'Date of birth'], ['gender', 'Gender'], ['address', 'Address']].filter(x => !stu[x[0]]).map(x => x[1]);
  const first = $('#setupBar .sb-s');
  if (first) {
    if (miss.length) $('.sb-t small', first).textContent = 'Pending: ' + miss.join(', ');
    else { first.style.setProperty('--c1', '#0b5e31'); first.style.setProperty('--c2', '#16a34a'); $('.sb-t b', first).innerHTML = '<em>Done</em>Profile complete'; $('.sb-t small', first).textContent = 'Bahut badhiya! Ab online course join karein.'; }
  }
  const tk = $('.ticker .tk span'), tkBox = $('.ticker');
  if (tkBox) {
    let n = []; for (const m of mems) n = n.concat(await UMT.list('notices', ['instituteCode', '==', m.instituteCode]));
    n = UMT.newest(n); if (n.length) tk.textContent = '📝 ' + n[0].title; else tkBox.remove();
  }
};

H['teacher/index'] = async () => {
  const c = code(), [mem, att, nt] = await Promise.all([UMT.list('memberships', ['instituteCode', '==', c], ['status', '==', 'approved']), UMT.list('attendance', ['instituteCode', '==', c], ['date', '==', today()]), UMT.list('notices', ['instituteCode', '==', c])]);
  const S = (ic, v, l, href) => `<a class="tile" href="${href}"><i class="fa-solid ${ic}"></i><b style="font-size:26px">${v}</b><small>${l}</small></a>`;
  mount(card('', `<h2 style="margin:0">Namaste, ${E(me().name)} 🙏</h2><p class="muted" style="margin:4px 0 0">${E(inst().name || '')} · Staff ID <b>${E(me().staffId)}</b></p>`) +
    `<div class="cards">${S('fa-users', mem.length, 'Students', 'students.html')}${S('fa-calendar-check', att.filter(a => a.status === 'P').length, 'Aaj present', 'attendance.html')}${S('fa-bullhorn', nt.length, 'Notices', 'notices.html')}</div>`);
};

/* ===================================================================
   COURSES, NOTICES, STAFF
   =================================================================== */
H['panel/courses'] = async () => {
  const c = code(); let list = UMT.newest(await UMT.list('courses', ['instituteCode', '==', c]));
  mount(card('Naya course', `<form id="cf" class="form-grid">${field('Course ka naam *', inp('name', '', 'required maxlength="90"'))}${field('Duration', inp('duration', '', 'placeholder="6 Months"'))}${field('Total fee (₹)', inp('fee', '', 'type="number" min="0"'))}<div class="field" style="align-self:end"><button class="btn btn-primary">Add course</button></div></form>`) + `<div id="cl"></div>`);
  const draw = () => { $('#cl').innerHTML = card(`Mere Courses (${list.length})`, table(['Course', 'Duration', 'Fee', ''], list.map(x => `<tr><td><b>${E(x.name)}</b></td><td>${E(x.duration || '-')}</td><td>${x.fee ? money(x.fee) : '-'}</td><td><button class="btn btn-light btn-sm" data-del="${E(x.id)}">Delete</button></td></tr>`), 'Abhi koi course nahi.')); };
  draw();
  $('#cf').addEventListener('submit', async e => { e.preventDefault(); await guarded(e.submitter, async () => { const d = fv(e.target); if (!d.name.trim()) throw new Error('Course ka naam daalein.'); const data = { instituteCode: c, instituteName: inst().name, name: d.name.trim(), duration: d.duration, fee: Number(d.fee) || 0, createdAt: UMT.ts() }; const id = await UMT.add('courses', data); list.unshift({ id, ...data, createdAt: Date.now() }); e.target.reset(); draw(); }); });
  app().addEventListener('click', async e => { const b = e.target.closest('[data-del]'); if (!b || !confirm('Course delete karein?')) return; await guarded(b, async () => { await UMT.del(['courses', b.dataset.del]); list = list.filter(x => x.id !== b.dataset.del); draw(); }); });
};

async function noticesUI(canDelete) {
  const c = code(); let list = UMT.newest(await UMT.list('notices', ['instituteCode', '==', c]));
  mount(card('Send a Notice to Students', `<form id="nf">${field('Title *', inp('title', '', 'required maxlength="120"'))}${field('Message', '<textarea class="input" name="body" rows="4" maxlength="1000"></textarea>')}<button class="btn btn-primary"><i class="fa-solid fa-paper-plane"></i> Send notice</button></form>`) + '<div id="nl"></div>');
  const draw = () => { $('#nl').innerHTML = card('Sent Notices', list.length ? list.map(n => `<div style="padding:10px 0;border-bottom:1px solid var(--line)"><b>${E(n.title)}</b> <small class="muted">· ${UMT.fmtDT(n.createdAt)} · ${E(n.byName || '')}</small><br>${E(n.body || '')}${canDelete ? ` <button class="btn btn-light btn-sm" data-del="${E(n.id)}" style="float:right">Delete</button>` : ''}</div>`).join('') : '<div class="empty">Abhi koi notice nahi bheja.</div>'); };
  draw();
  $('#nf').addEventListener('submit', async e => { e.preventDefault(); await guarded(e.submitter, async () => { const d = fv(e.target); if (!d.title.trim()) throw new Error('Title daalein.'); const data = { instituteCode: c, title: d.title.trim(), body: d.body, byName: me().name, byRole: me().role, createdAt: UMT.ts() }; const id = await UMT.add('notices', data); list.unshift({ id, ...data, createdAt: Date.now() }); e.target.reset(); draw(); UMT.toast('Notice bhej diya ✔'); }); });
  app().addEventListener('click', async e => { const b = e.target.closest('[data-del]'); if (!b || !confirm('Notice delete karein?')) return; await guarded(b, async () => { await UMT.del(['notices', b.dataset.del]); list = list.filter(x => x.id !== b.dataset.del); draw(); }); });
}
H['panel/notices'] = () => noticesUI(true);
H['teacher/notices'] = () => noticesUI(false);

H['panel/staff'] = async () => {
  const c = code(); let list = UMT.newest(await UMT.list('staff', ['instituteCode', '==', c]));
  mount(card('New Teacher / Staff Login', `<div id="so"></div><form id="tf" class="form-grid">${field('Naam *', inp('name', '', 'maxlength="70"'))}${field('Mobile *', inp('mobile', '', 'type="tel" maxlength="14"'))}${field('Subject / Role', inp('subject', '', 'placeholder="e.g. Computer Teacher"'))}${field('Email (optional)', inp('email', '', 'type="email"'))}${field('Password * (min 6)', inp('password', '', 'type="text" autocomplete="off"'))}<div class="field" style="align-self:end"><button class="btn btn-primary">Create login</button></div></form><p class="small muted">Teacher ko Staff ID milega — wo <b>Login &rarr; Teacher</b> tab se Staff ID / mobile aur is password se login karega.</p>`) + '<div id="sl"></div>');
  const draw = () => { $('#sl').innerHTML = card(`Staff (${list.length})`, table(['Staff ID', 'Naam', 'Mobile', 'Subject', 'Status'], list.map(s => `<tr><td class="mono">${E(s.staffId)}</td><td><b>${E(s.name)}</b></td><td>${E(s.mobile)}</td><td>${E(s.subject || '-')}</td><td>${bdg(s.status || 'active')}</td></tr>`), 'Abhi koi teacher nahi.')); };
  draw();
  $('#tf').addEventListener('submit', async e => { e.preventDefault(); await guarded(e.submitter, async () => { const r = await UMT.addTeacher(fv(e.target)); $('#so').innerHTML = msg(`Teacher login ban gaya. Staff ID: <b class="mono">${E(r.staffId)}</b> · Password: wahi jo aapne daala.`); list = UMT.newest(await UMT.list('staff', ['instituteCode', '==', c])); e.target.reset(); draw(); }); });
};

/* ===================================================================
   ADMISSIONS (online forms that came from admission.html)
   =================================================================== */
H['panel/admission'] = async () => {
  const c = code(); let list = UMT.newest(await UMT.list('admissions', ['instituteCode', '==', c]));
  const link = UMT.root + 'admission.html?inst=' + c;
  mount(card('Admission Link', `<p>Is link ko apni website / WhatsApp par share karein:</p><p><code>${E(link)}</code> <button class="btn btn-light btn-sm" id="cpl">Copy</button> <a class="btn btn-light btn-sm" target="_blank" href="https://wa.me/?text=${encodeURIComponent('Online admission: ' + link)}">WhatsApp</a></p>`) + '<div id="al"></div>');
  $('#cpl').onclick = () => copy(link);
  const draw = () => { $('#al').innerHTML = card(`Online aaye forms (${list.length})`, table(['Student', 'Course', 'Mobile', 'Date', 'Status', ''], list.map(a => `<tr><td><b>${E(a.name)}</b><br><small class="muted">${E(a.email || '')}</small></td><td>${E(a.course || '-')}</td><td>${E(a.mobile)}</td><td class="small">${UMT.fmtDT(a.createdAt)}</td><td>${bdg(a.status)}</td><td style="white-space:nowrap">${a.status === 'admitted' ? '' : `<button class="btn btn-primary btn-sm" data-a="admit" data-id="${E(a.id)}">Admit</button> <button class="btn btn-light btn-sm" data-a="contacted" data-id="${E(a.id)}">Contacted</button>`}</td></tr>`), 'Abhi koi online form nahi aaya.')); };
  draw();
  app().addEventListener('click', async e => {
    const b = e.target.closest('[data-a]'); if (!b) return; const a = list.find(x => x.id === b.dataset.id); if (!a) return;
    await guarded(b, async () => {
      if (b.dataset.a === 'admit') {
        if (!confirm(a.name + ' ko student bana kar admit karein?')) return;
        const r = await UMT.addStudentByInstitute({ name: a.name, mobile: a.mobile, email: a.email, course: a.course });
        await UMT.update(['admissions', a.id], { status: 'admitted', studentEnrollment: r.enrollmentNo }); a.status = 'admitted';
        UMT.toast('Admit ho gaya — Enrollment ' + r.enrollmentNo + ', Password ' + r.password);
      } else { await UMT.update(['admissions', a.id], { status: 'contacted' }); a.status = 'contacted'; }
      draw();
    });
  });
};

/* ===================================================================
   DOCUMENTS : generate + lists
   =================================================================== */
H['panel/generate'] = async () => {
  const c = code(), qs = new URLSearchParams(location.search), type = qs.get('type');
  const students = UMT.newest(await UMT.list('memberships', ['instituteCode', '==', c], ['status', '==', 'approved']));
  const btns = DOC_TYPES.map(([k, l]) => `<a class="btn ${k === type ? 'btn-primary' : 'btn-light'} btn-sm" href="?type=${k}">${l}</a>`).join(' ');
  let html = card('1. Choose document', `<div class="row" style="flex-wrap:wrap;gap:8px">${btns}</div>`);
  if (!type) { mount(html + '<div id="gout"></div>'); return; }
  if (!students.length) { mount(html + msg('Pehle <a href="student-add.html">student add</a> karein (approved student chahiye).', 'danger')); return; }
  const preset = qs.get('student');
  html += card(`2. ${E(typeLabel(type))} — details`, `<form id="gf"><div class="form-grid">
    ${field('Student *', `<select class="input" name="student">${students.map(s => `<option value="${E(s.studentUid)}" ${s.studentUid === preset ? 'selected' : ''}>${E(s.name)} — ${E(s.enrollmentNo)}</option>`).join('')}</select>`)}
    ${field('Course', inp('course'))}
    ${field('Issue date', inp('issueDate', today(), 'type="date"'))}
    ${type === 'certificate' || type === 'completion' || type === 'provisional' ? field('Grade', inp('grade', '', 'placeholder="A+ / First Division"')) : ''}
    ${type === 'marksheet' ? '<div class="full"><label><b>Subjects</b></label><div id="subs"></div><button type="button" class="btn btn-light btn-sm" id="addSub">+ Add subject</button></div>' : ''}
    ${field('Remarks (optional)', inp('remarks'), 'full')}</div><button class="btn btn-primary btn-lg" style="margin-top:12px"><i class="fa-solid fa-certificate"></i> Generate ${E(typeLabel(type))}</button></form>`) + '<div id="gout"></div>';
  mount(html);
  const f = $('#gf'), sel = f.elements.student, fillCourse = () => { const s = students.find(x => x.studentUid === sel.value); if (s) f.elements.course.value = s.course || ''; };
  sel.addEventListener('change', fillCourse); fillCourse();
  if (type === 'marksheet') {
    const addRow = (n = '', mx = 100) => $('#subs').insertAdjacentHTML('beforeend', `<div class="row" style="gap:8px;margin-bottom:6px"><input class="input" placeholder="Subject" data-n value="${E(n)}" style="flex:2"><input class="input" placeholder="Max" type="number" data-mx value="${mx}" style="flex:1"><input class="input" placeholder="Marks" type="number" data-mk style="flex:1"></div>`);
    addRow(); addRow(); $('#addSub').onclick = () => addRow();
  }
  f.addEventListener('submit', async e => {
    e.preventDefault(); await guarded(e.submitter, async () => {
      const d = fv(f), s = students.find(x => x.studentUid === d.student); if (!s) throw new Error('Student chuniye.');
      let no = ''; for (let i = 0; i < 8 && !no; i++) { const n = 'UV' + UMT.rnd(10); if (!(await UMT.get('documents', n))) no = n; }
      const doc = { type, typeLabel: typeLabel(type), instituteCode: c, instituteName: inst().name, instituteAddress: [inst().address, inst().city].filter(Boolean).join(', '), signatory: inst().signatory_name || '', studentUid: s.studentUid, studentName: s.name, enrollmentNo: s.enrollmentNo, fatherName: s.fatherName || '', mobile: s.mobile || '', course: d.course || '', grade: d.grade || '', remarks: d.remarks || '', issueDate: d.issueDate, createdAt: UMT.ts() };
      if (type === 'marksheet') {
        doc.subjects = $$('#subs .row').map(r => ({ name: $('[data-n]', r).value.trim(), max: Number($('[data-mx]', r).value) || 0, marks: Number($('[data-mk]', r).value) || 0 })).filter(x => x.name);
        const mx = doc.subjects.reduce((a, x) => a + x.max, 0), mk = doc.subjects.reduce((a, x) => a + x.marks, 0);
        if (!doc.subjects.length || !mx) throw new Error('Kam se kam ek subject (max marks ke saath) daalein.');
        doc.percentage = Math.round(mk / mx * 10000) / 100; doc.grade = gradeOf(doc.percentage);
      }
      await UMT.set(['documents', no], doc);
      $('#gout').innerHTML = msg(`<b>${E(typeLabel(type))} ban gaya.</b> Number: <b class="mono">${no}</b><br><a class="btn btn-primary btn-sm" target="_blank" href="../doc.html?no=${no}">View / Print</a> <a class="btn btn-light btn-sm" href="documents.html">All documents</a>`);
    });
  });
};

async function docsList(kind, who) {
  const c = code(); const uid = me().uid;
  let list = UMT.newest(who === 'institute' ? await UMT.list('documents', ['instituteCode', '==', c]) : await UMT.list('documents', ['studentUid', '==', uid])).filter(d => kindMatch(kind, d.type));
  const draw = () => mount(card(who === 'institute' ? 'Issued Documents (' + list.length + ')' : 'My Documents (' + list.length + ')', (who === 'institute' ? `<p><a class="btn btn-primary btn-sm" href="generate.html${kind ? '?type=' + kind : ''}"><i class="fa-solid fa-plus"></i> Generate new</a></p>` : '') +
    table(['Number', 'Document', 'Student', 'Course', 'Date', ''], list.map(d => `<tr><td class="mono">${E(d.id)}</td><td>${E(d.typeLabel || d.type)}</td><td>${E(d.studentName)}</td><td>${E(d.course || '-')}</td><td class="small">${E(d.issueDate || UMT.fmtDate(d.createdAt))}</td><td style="white-space:nowrap"><a class="btn btn-light btn-sm" target="_blank" href="../doc.html?no=${E(d.id)}">View</a>${who === 'institute' ? ` <button class="btn btn-light btn-sm" data-del="${E(d.id)}">Delete</button>` : ''}</td></tr>`), 'Abhi koi document nahi.')));
  draw();
  app().addEventListener('click', async e => { const b = e.target.closest('[data-del]'); if (!b || !confirm('Document delete karein? Verify karne par "not found" aayega.')) return; await guarded(b, async () => { await UMT.del(['documents', b.dataset.del]); list = list.filter(x => x.id !== b.dataset.del); draw(); }); });
}
for (const k of ['', 'id_card', 'certificate', 'marksheet', 'admit_card']) {
  H['panel/documents' + (k ? '-' + k : '')] = () => docsList(k, 'institute');
  if (k !== 'marksheet') H['student/documents' + (k ? '-' + k : '')] = () => docsList(k, 'student');
}
H['student/result'] = () => docsList('marksheet', 'student');
H['panel/results'] = () => docsList('marksheet', 'institute');

/* ===================================================================
   ATTENDANCE (institute + teacher) / student view
   =================================================================== */
async function attendanceUI() {
  const c = code();
  const [students, courses] = await Promise.all([UMT.list('memberships', ['instituteCode', '==', c], ['status', '==', 'approved']), UMT.list('courses', ['instituteCode', '==', c])]);
  const cl = [...new Set([...courses.map(x => x.name), ...students.map(x => x.course).filter(Boolean)])];
  mount(card('Attendance', `<div class="row" style="gap:10px;align-items:end;flex-wrap:wrap">${field('Date', `<input class="input" type="date" id="atD" value="${today()}" max="${today()}">`)}${field('Course', `<select class="input" id="atC"><option value="">All</option>${cl.map(x => `<option>${E(x)}</option>`).join('')}</select>`)}</div>`) + '<div id="atL"></div>');
  async function load() {
    const d = $('#atD').value, cf = $('#atC').value;
    const ex = {}; (await UMT.list('attendance', ['instituteCode', '==', c], ['date', '==', d])).forEach(a => ex[a.studentUid] = a.status);
    const l = students.filter(s => !cf || s.course === cf).sort((a, b) => String(a.rollNo || a.name).localeCompare(String(b.rollNo || b.name), undefined, { numeric: true }));
    $('#atL').innerHTML = card(`${new Date(d).toDateString()} — ${l.length} students`, l.length ? `<form id="atF">${table(['Roll', 'Student', 'Course', 'Attendance'], l.map(s => { const v = ex[s.studentUid] || 'P'; return `<tr><td>${E(s.rollNo || '-')}</td><td><b>${E(s.name)}</b></td><td>${E(s.course || '-')}</td><td>${['P', 'A', 'L'].map(x => `<label style="margin-right:12px"><input type="radio" name="a_${E(s.studentUid)}" value="${x}" ${v === x ? 'checked' : ''}> ${x === 'P' ? 'Present' : x === 'A' ? 'Absent' : 'Leave'}</label>`).join('')}</td></tr>`; }))}<button class="btn btn-primary" style="margin-top:10px">Save attendance</button></form>` : '<div class="empty">Is course mein koi student nahi.</div>');
    const form = $('#atF'); if (!form) return;
    form.addEventListener('submit', async e => { e.preventDefault(); await guarded(e.submitter, async () => { for (const s of l) { const st = form.elements['a_' + s.studentUid].value; await UMT.set(['attendance', `${c}_${s.studentUid}_${d}`], { instituteCode: c, studentUid: s.studentUid, studentName: s.name, course: s.course || '', date: d, status: st, markedBy: me().uid, createdAt: UMT.ts() }); } UMT.toast('Attendance save ho gayi ✔'); }); });
  }
  $('#atD').addEventListener('change', load); $('#atC').addEventListener('change', load); load();
}
H['panel/attendance'] = attendanceUI; H['teacher/attendance'] = attendanceUI;

H['student/attendance'] = async () => {
  const l = (await UMT.list('attendance', ['studentUid', '==', me().uid])).sort((a, b) => String(b.date).localeCompare(a.date));
  const p = l.filter(x => x.status === 'P').length;
  mount(card('', `<div class="cards"><div class="tile"><i class="fa-solid fa-percent"></i><b style="font-size:26px">${l.length ? Math.round(p / l.length * 100) + '%' : '-'}</b><small>Attendance</small></div><div class="tile"><i class="fa-solid fa-circle-check"></i><b style="font-size:26px">${p}</b><small>Present</small></div><div class="tile"><i class="fa-solid fa-circle-xmark"></i><b style="font-size:26px">${l.length - p}</b><small>Absent / Leave</small></div></div>`) +
    card('Attendance history', table(['Date', 'Institute', 'Status'], l.map(x => `<tr><td>${E(x.date)}</td><td>${E(x.instituteCode)}</td><td>${x.status === 'P' ? '<span class="badge ok">Present</span>' : x.status === 'L' ? '<span class="badge warn">Leave</span>' : '<span class="badge bad">Absent</span>'}</td></tr>`), 'Abhi attendance mark nahi hui.')));
};

/* ===================================================================
   FEES
   =================================================================== */
const feeRow = (x, who) => `<tr><td class="mono">${E(x.receipt)}</td>${who === 'institute' ? `<td><b>${E(x.studentName)}</b><br><small class="muted">${E(x.enrollmentNo)}</small></td>` : ''}<td>${money(x.amount)}</td><td>${E(x.head || '-')}<br><small class="muted">${E(x.mode || '')}${x.month ? ' · ' + E(x.month) : ''}</small></td><td class="small">${E(x.paidOn || UMT.fmtDate(x.createdAt))}</td></tr>`;
H['panel/fees'] = async () => {
  const c = code(); const [students, fees0] = await Promise.all([UMT.list('memberships', ['instituteCode', '==', c], ['status', '==', 'approved']), UMT.list('fees', ['instituteCode', '==', c])]);
  let fees = UMT.newest(fees0);
  mount(card('Receive Fee', students.length ? `<form id="ff" class="form-grid">${field('Student *', `<select class="input" name="student">${students.map(s => `<option value="${E(s.studentUid)}">${E(s.name)} — ${E(s.enrollmentNo)}</option>`).join('')}</select>`)}${field('Amount (₹) *', inp('amount', '', 'type="number" min="1" step="any"'))}${field('Mode', '<select class="input" name="mode"><option>Cash</option><option>UPI</option><option>Bank</option><option>Cheque</option></select>')}${field('Head', '<select class="input" name="head"><option>Tuition fee</option><option>Admission fee</option><option>Exam fee</option><option>Other</option></select>')}${field('Fee month', inp('month', today().slice(0, 7), 'type="month"'))}${field('Paid on', inp('paidOn', today(), 'type="date"'))}${field('Note', inp('note'), 'full')}<div class="field full"><button class="btn btn-primary">Save receipt</button></div></form>` : msg('Pehle <a href="student-add.html">student add</a> karein.', 'danger')) + '<div id="fl"></div>');
  const draw = () => { const f = $('#fl'); if (f) f.innerHTML = card(`Recent Collections`, table(['Receipt', 'Student', 'Amount', 'Details', 'Date'], fees.slice(0, 15).map(x => feeRow(x, 'institute')), 'Abhi koi fee collect nahi hui.')); };
  draw();
  const form = $('#ff'); if (form) form.addEventListener('submit', async e => {
    e.preventDefault(); await guarded(e.submitter, async () => {
      const d = fv(form), s = students.find(x => x.studentUid === d.student), amt = Number(d.amount); if (!s || !(amt > 0)) throw new Error('Student aur sahi amount daalein.');
      const data = { instituteCode: c, studentUid: s.studentUid, studentName: s.name, enrollmentNo: s.enrollmentNo, amount: amt, mode: d.mode, head: d.head, month: d.month, paidOn: d.paidOn, note: d.note, receipt: 'RC' + UMT.rnd(8), createdAt: UMT.ts() };
      const id = await UMT.add('fees', data); fees.unshift({ id, ...data, createdAt: Date.now() }); draw(); form.elements.amount.value = ''; UMT.toast('Receipt ' + data.receipt + ' save ho gayi ✔');
    });
  });
};
H['panel/fees-history'] = async () => { const l = UMT.newest(await UMT.list('fees', ['instituteCode', '==', code()])); mount(card(`Fee Transactions (${l.length})`, table(['Receipt', 'Student', 'Amount', 'Details', 'Date'], l.map(x => feeRow(x, 'institute')), 'Abhi koi transaction nahi.'))); };
H['panel/fees-dues'] = async () => {
  const c = code(); const [mem, fees] = await Promise.all([UMT.list('memberships', ['instituteCode', '==', c], ['status', '==', 'approved']), UMT.list('fees', ['instituteCode', '==', c])]);
  const paid = {}; fees.forEach(f => paid[f.studentUid] = (paid[f.studentUid] || 0) + (Number(f.amount) || 0));
  const l = mem.map(m => ({ m, total: Number(m.totalFee) || 0, paid: paid[m.studentUid] || 0 })).filter(x => x.total > 0).map(x => ({ ...x, due: x.total - x.paid })).sort((a, b) => b.due - a.due);
  mount(card(`Fee Dues`, table(['Student', 'Course', 'Total fee', 'Paid', 'Due'], l.map(x => `<tr><td><b>${E(x.m.name)}</b><br><small class="muted">${E(x.m.enrollmentNo)}</small></td><td>${E(x.m.course || '-')}</td><td>${money(x.total)}</td><td>${money(x.paid)}</td><td><b style="color:${x.due > 0 ? '#b42318' : 'var(--brand)'}">${money(x.due)}</b></td></tr>`), 'Kisi student ki total fee set nahi hai. Student List &rarr; Edit se "Total course fee" daalein.')));
};
H['panel/fees-requests'] = async () => mount(card('Online Fee Requests', '<div class="empty">Abhi koi online fee request nahi hai.<br><small>Online payment gateway abhi connect nahi hai; fee "Fee Collection" se receipt ke saath darj karein.</small></div>'));
H['panel/fees-qr'] = async () => {
  const i = inst(); mount(card('My Fee QR / UPI', `<form id="qf" class="form-grid">${field('UPI ID *', inp('upi', i.upi || '', 'placeholder="name@bank"'))}${field('Payee naam', inp('upiName', i.upiName || i.name || ''))}<div class="field full"><button class="btn btn-primary">Save &amp; show QR</button></div></form><div id="qo" style="margin-top:14px"></div>`));
  const show = () => { const v = inst(); if (!v.upi) return; const url = `upi://pay?pa=${encodeURIComponent(v.upi)}&pn=${encodeURIComponent(v.upiName || v.name)}&cu=INR`; let img = ''; try { const q = window.qrcode(0, 'M'); q.addData(url); q.make(); img = q.createImgTag(6); } catch (e) { } $('#qo').innerHTML = `<div class="ok-box">${img}<p><b>${E(v.upi)}</b></p><small class="muted">Is QR ko print karke centre par lagayein.</small></div>`; };
  show();
  $('#qf').addEventListener('submit', async e => { e.preventDefault(); await guarded(e.submitter, async () => { const d = fv(e.target); if (!/^[\w.\-]+@[\w]+$/.test(d.upi.trim())) throw new Error('Sahi UPI ID daalein (name@bank).'); await UMT.merge(['institutes', code()], { upi: d.upi.trim(), upiName: d.upiName }); Object.assign(UMT.ctx.inst, { upi: d.upi.trim(), upiName: d.upiName }); show(); UMT.toast('Save ho gaya ✔'); }); });
};

async function myFees(historyOnly) {
  const uid = me().uid, l = UMT.newest(await UMT.list('fees', ['studentUid', '==', uid]));
  const mems = (UMT.ctx.memberships || []).filter(m => m.status === 'approved'), total = mems.reduce((s, m) => s + (Number(m.totalFee) || 0), 0), paid = l.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  mount((historyOnly ? '' : card('', `<div class="cards"><div class="tile"><i class="fa-solid fa-indian-rupee-sign"></i><b style="font-size:24px">${money(total)}</b><small>Total fee</small></div><div class="tile"><i class="fa-solid fa-circle-check"></i><b style="font-size:24px">${money(paid)}</b><small>Paid</small></div><div class="tile"><i class="fa-solid fa-hourglass-half"></i><b style="font-size:24px">${money(Math.max(0, total - paid))}</b><small>Due</small></div></div><p class="small muted" style="margin-top:12px">Fees institute ke paas jama karein; receipt yahin dikhegi.</p>`)) +
    card('Fee Transactions', table(['Receipt', 'Amount', 'Details', 'Date'], l.map(x => feeRow(x, 'student')), 'Abhi koi fee jama nahi hui.')));
}
H['student/fees'] = () => myFees(false); H['student/fees-history'] = () => myFees(true);

/* ===================================================================
   PROFILE / KYC / WALLET / SUBSCRIPTION (institute)
   =================================================================== */
const pwCard = () => card('Change Password', `<form id="pf2" class="form-grid">${field('New password (min 6)', inp('np', '', 'type="password" autocomplete="new-password"'))}${field('Confirm', inp('np2', '', 'type="password" autocomplete="new-password"'))}<div class="field full"><button class="btn btn-primary">Change password</button></div></form>`);
function pwBind() { $('#pf2').addEventListener('submit', async e => { e.preventDefault(); await guarded(e.submitter, async () => { const d = fv(e.target); if (d.np !== d.np2) throw new Error('Dono password match nahi karte.'); await UMT.changePassword(d.np); e.target.reset(); UMT.toast('Password badal gaya ✔'); }); }); }
H['panel/profile'] = async () => {
  const i = inst();
  mount(card('Institute Details', `<form id="pf" class="form-grid">${field('Institute naam *', inp('name', i.name, 'required'))}${field('Type', inp('type', i.type))}${field('Owner', inp('ownerName', i.ownerName))}${field('Mobile', inp('mobile', i.mobile, 'readonly'))}${field('Email (login)', inp('email', i.email, 'readonly'))}${field('Registration no.', inp('reg_no', i.reg_no))}${field('State', inp('state', i.state))}${field('City', inp('city', i.city))}${field('District', inp('district', i.district))}${field('Pincode', inp('pincode', i.pincode))}${field('Address', inp('address', i.address), 'full')}${field('Signatory naam (certificate par)', inp('signatory_name', i.signatory_name))}${field('Signatory designation', inp('signatory_title', i.signatory_title))}<div class="field full"><button class="btn btn-primary">Save profile</button></div></form><p class="small muted">Logo / seal / signature upload ke liye Firebase Storage chahiye — abhi connect nahi hai.</p>`) + pwCard());
  $('#pf').addEventListener('submit', async e => { e.preventDefault(); await guarded(e.submitter, async () => { const d = fv(e.target); delete d.mobile; delete d.email; if (!d.name.trim()) throw new Error('Institute ka naam daalein.'); await UMT.update(['institutes', code()], d); Object.assign(UMT.ctx.inst, d); UMT.bind(); UMT.toast('Profile save ho gaya ✔'); }); });
  pwBind();
};
H['panel/kyc'] = async () => {
  const k = inst().kyc || {};
  mount(card('Profile Complete / KYC', `${inst().kycDone ? msg('KYC details save hain ✔') : ''}<form id="kf" class="form-grid">${field('Address *', inp('address', k.address || inst().address), 'full')}${field('District', inp('district', k.district || inst().district))}${field('Pincode', inp('pincode', k.pincode || inst().pincode))}<div class="field full"><button class="btn btn-primary">Save</button></div></form><p class="small muted">Aadhaar / photo documents ke liye Firebase Storage chahiye — abhi connect nahi hai.</p>`));
  $('#kf').addEventListener('submit', async e => { e.preventDefault(); await guarded(e.submitter, async () => { const d = fv(e.target); if (!d.address.trim()) throw new Error('Address daalein.'); await UMT.update(['institutes', code()], { kyc: d, kycDone: true, address: d.address, district: d.district, pincode: d.pincode }); UMT.toast('KYC save ho gaya ✔'); }); });
};
const walletCard = () => card('', `<div class="cards"><div class="tile"><i class="fa-solid fa-crown"></i><b style="font-size:22px">${E(inst().plan || 'FREE')}</b><small>Current plan</small></div><div class="tile"><i class="fa-solid fa-wallet"></i><b style="font-size:22px">${money(inst().wallet)}</b><small>Wallet balance</small></div></div><p class="muted" style="margin-top:12px">Abhi <b>everything is FREE</b> — certificates, documents aur tools par koi charge nahi.</p>`);
H['panel/subscription'] = async () => mount(walletCard() + card('Plans', '<div class="empty">Paid plans abhi shuru nahi hue. Shuru hone par yahin dikhenge.</div>'));
H['panel/wallet'] = async () => mount(walletCard() + card('Add Money', '<div class="empty">Online payment (UPI / gateway) abhi connect nahi hai. Free period mein recharge ki zaroorat nahi.</div>') + card('Wallet Ledger', '<div class="empty">Abhi koi entry nahi.</div>'));

/* ===================================================================
   AFFILIATION, REFERRALS, SUB-FRANCHISE, TICKETS, AUTHORISATION (institute)
   =================================================================== */
H['panel/affiliation'] = async () => {
  const c = code(); let a = await UMT.get('affiliations', c);
  const draw = () => mount(card('Get Affiliation', `<p>Affiliation ke baad aapko AADI ka <b>Authorisation Certificate</b> milta hai.</p><p>Status: ${a ? bdg(a.status) : '<span class="badge">not applied</span>'}</p>` + (a ? `<p class="muted small">Applied on ${UMT.fmtDate(a.createdAt)}${a.note ? ' · ' + E(a.note) : ''}. Approval admin ke paas se hoti hai.</p>` : `<form id="af">${field('Kuch batana chahte hain? (optional)', '<textarea class="input" name="note" rows="3" maxlength="300"></textarea>')}<button class="btn btn-primary">Apply for affiliation</button></form>`)));
  draw(); const f = $('#af'); if (f) f.addEventListener('submit', async e => { e.preventDefault(); await guarded(e.submitter, async () => { const d = fv(f); const data = { instituteCode: c, instituteName: inst().name, status: 'pending', note: d.note || '', createdAt: UMT.ts() }; await UMT.set(['affiliations', c], data); await UMT.merge(['institutes', c], { affiliation: 'pending' }); a = { ...data, createdAt: Date.now() }; draw(); UMT.toast('Application bhej di gayi ✔'); }); });
};
H['panel/referrals'] = async () => {
  const c = code(), l = UMT.newest(await UMT.list('institutes', ['referredBy', '==', c])), link = UMT.root + 'register.html?as=institute&ref=' + c;
  mount(card('Refer & Earn', `<p>Aapka referral code: <b class="mono" style="font-size:20px">${E(c)}</b></p><p><code>${E(link)}</code> <button class="btn btn-light btn-sm" id="cpr">Copy</button> <a class="btn btn-light btn-sm" target="_blank" href="https://wa.me/?text=${encodeURIComponent('AADI par apna institute register karein: ' + link)}">WhatsApp</a></p><p class="small muted">Commission admin verify karke deta hai; yahan sirf aapke referred institutes dikhte hain.</p>`) + card(`Referred institutes (${l.length})`, table(['Institute', 'Code', 'City', 'Date'], l.map(x => `<tr><td><b>${E(x.name)}</b></td><td class="mono">${E(x.code)}</td><td>${E(x.city || '-')}</td><td>${UMT.fmtDate(x.createdAt)}</td></tr>`), 'Abhi kisi ne aapke code se register nahi kiya.')));
  $('#cpr').onclick = () => copy(link);
};
H['panel/sub-franchise'] = async () => {
  const c = code(); let l = UMT.newest(await UMT.list('subFranchises', ['parentCode', '==', c]));
  mount(card('Sub Franchise request', `<form id="sf" class="form-grid">${field('Centre ka naam *', inp('name'))}${field('Owner', inp('owner'))}${field('Mobile *', inp('mobile', '', 'type="tel"'))}${field('City', inp('city'))}<div class="field full"><button class="btn btn-primary">Send request</button></div></form>`) + '<div id="sl"></div>');
  const draw = () => $('#sl').innerHTML = card(`Sub Franchises (${l.length})`, table(['Centre', 'Owner', 'Mobile', 'City', 'Status'], l.map(x => `<tr><td><b>${E(x.name)}</b></td><td>${E(x.owner || '-')}</td><td>${E(x.mobile)}</td><td>${E(x.city || '-')}</td><td>${bdg(x.status)}</td></tr>`), 'Abhi koi sub franchise nahi.'));
  draw();
  $('#sf').addEventListener('submit', async e => { e.preventDefault(); await guarded(e.submitter, async () => { const d = fv(e.target); if (!d.name.trim() || UMT.digits(d.mobile).length !== 10) throw new Error('Naam aur 10 digit mobile daalein.'); const data = { parentCode: c, name: d.name.trim(), owner: d.owner, mobile: UMT.digits(d.mobile), city: d.city, status: 'pending', createdAt: UMT.ts() }; const id = await UMT.add('subFranchises', data); l.unshift({ id, ...data, createdAt: Date.now() }); e.target.reset(); draw(); }); });
};
H['panel/branch-certificate'] = async () => {
  const i = inst(), aff = i.affiliation === 'approved';
  mount(`<div class="docbar"><span>${aff ? msg('Affiliation approved ✔') : msg('Affiliation abhi approved nahi — yeh draft copy hai. <a href="affiliation.html">Apply karein</a>.', 'danger')}</span><button class="btn btn-primary" onclick="window.print()"><i class="fa-solid fa-print"></i> Print</button></div>
  <div class="sheet"><div class="inst">AADI</div><div class="sub">Education Management Portal</div><h1>AUTHORISATION CERTIFICATE</h1>
  <div class="body">This is to certify that <b>${E(i.name)}</b> (Code: <b>${E(i.code)}</b>)${i.city ? ', ' + E(i.city) : ''}${i.state ? ', ' + E(i.state) : ''}, owned by <b>${E(i.ownerName)}</b>, is ${aff ? 'an authorised' : 'a registered'} centre on the AADI portal.</div>
  <div class="foot"><div>Date: ${UMT.fmtDate(Date.now())}</div><div class="sign">Authorised Signatory</div></div></div>`);
};

/* ---------- tickets: student raises, institute answers */
H['panel/tickets'] = async () => {
  const c = code(); let l = UMT.newest(await UMT.list('tickets', ['instituteCode', '==', c]));
  mount(card('Support ticket', `<form id="tkf" class="form-grid">${field('Subject *', inp('subject'), 'full')}${field('Message', '<textarea class="input" name="body" rows="3"></textarea>', 'full')}<div class="field full"><button class="btn btn-primary">Send to support</button></div></form><p class="small muted">Is ticket ka jawab support WhatsApp / phone par dega.</p>`) + '<div id="tl"></div>');
  const draw = () => $('#tl').innerHTML = card(`Tickets & Applications (${l.length})`, table(['From', 'Subject', 'Message', 'Date', 'Status', ''], l.map(t => `<tr><td>${t.role === 'student' ? E(t.name || 'Student') : 'You'}</td><td><b>${E(t.subject)}</b><br><small class="muted">${E(t.category || '')}</small></td><td>${E(t.body || '')}</td><td class="small">${UMT.fmtDT(t.createdAt)}</td><td>${bdg(t.status)}</td><td>${t.status === 'open' && t.role === 'student' ? `<button class="btn btn-light btn-sm" data-res="${E(t.id)}">Mark resolved</button>` : ''}</td></tr>`), 'Abhi koi ticket nahi.'));
  draw();
  $('#tkf').addEventListener('submit', async e => { e.preventDefault(); await guarded(e.submitter, async () => { const d = fv(e.target); if (!d.subject.trim()) throw new Error('Subject daalein.'); const data = { uid: me().uid, role: 'institute', name: me().name, instituteCode: c, subject: d.subject.trim(), body: d.body, category: 'Support', status: 'open', createdAt: UMT.ts() }; const id = await UMT.add('tickets', data); l.unshift({ id, ...data, createdAt: Date.now() }); e.target.reset(); draw(); UMT.toast('Ticket bhej diya ✔'); }); });
  app().addEventListener('click', async e => { const b = e.target.closest('[data-res]'); if (!b) return; await guarded(b, async () => { await UMT.update(['tickets', b.dataset.res], { status: 'resolved' }); l.find(x => x.id === b.dataset.res).status = 'resolved'; draw(); }); });
};
H['student/tickets'] = async () => {
  const mems = (UMT.ctx.memberships || []).filter(m => m.status === 'approved'); let l = UMT.newest(await UMT.list('tickets', ['uid', '==', me().uid]));
  mount(card('New Application / Ticket', mems.length ? `<form id="tkf" class="form-grid">${field('Institute', `<select class="input" name="inst">${mems.map(m => `<option value="${E(m.instituteCode)}">${E(m.instituteName)} (${E(m.instituteCode)})</option>`).join('')}</select>`)}${field('Category', '<select class="input" name="category"><option>Application</option><option>Complaint</option><option>Fee issue</option><option>Document correction</option><option>Other</option></select>')}${field('Subject *', inp('subject'), 'full')}${field('Details', '<textarea class="input" name="body" rows="4"></textarea>', 'full')}<div class="field full"><button class="btn btn-primary">Submit</button></div></form>` : msg('Ticket bhejne ke liye pehle kisi institute se juden — <a href="join.html">Join Institute</a>.', 'danger')) + '<div id="tl"></div>');
  const draw = () => $('#tl').innerHTML = card(`Tickets (${l.length})`, table(['Subject', 'Category', 'Date', 'Status'], l.map(t => `<tr><td><b>${E(t.subject)}</b><br><small class="muted">${E(t.body || '')}</small></td><td>${E(t.category || '')}</td><td class="small">${UMT.fmtDT(t.createdAt)}</td><td>${bdg(t.status)}</td></tr>`), 'Abhi koi ticket nahi.'));
  draw(); const f = $('#tkf'); if (f) f.addEventListener('submit', async e => { e.preventDefault(); await guarded(e.submitter, async () => { const d = fv(f); if (!d.subject.trim()) throw new Error('Subject daalein.'); const data = { uid: me().uid, role: 'student', name: me().name, instituteCode: d.inst, subject: d.subject.trim(), body: d.body, category: d.category, status: 'open', createdAt: UMT.ts() }; const id = await UMT.add('tickets', data); l.unshift({ id, ...data, createdAt: Date.now() }); f.reset(); draw(); UMT.toast('Submit ho gaya ✔'); }); });
};

/* ===================================================================
   STUDENT: profile, notices, institutes, join, courses, refer, exams
   =================================================================== */
H['student/profile'] = async () => {
  const s = UMT.ctx.stu || {}, mems = UMT.ctx.memberships || [];
  mount(card(E(me().name), `<p class="muted">Enrollment: <b class="mono">${E(me().enrollmentNo)}</b> · Mobile: ${E(me().mobile)}</p><form id="spf" class="form-grid">${field('Date of birth', inp('dob', s.dob, 'type="date"'))}${field('Gender', `<select class="input" name="gender">${['', 'Male', 'Female', 'Other'].map(x => `<option ${s.gender === x ? 'selected' : ''}>${x}</option>`).join('')}</select>`)}${field("Father's name", inp('fatherName', s.fatherName))}${field("Mother's name", inp('motherName', s.motherName))}${field('Email', inp('email', s.email, 'type="email"'))}${field('Address', inp('address', s.address), 'full')}<div class="field full"><button class="btn btn-primary">Save profile</button></div></form>`) +
    card('My institutes', table(['Institute', 'Course', 'Status'], mems.map(m => `<tr><td><b>${E(m.instituteName)}</b> <small class="muted">${E(m.instituteCode)}</small></td><td>${E(m.course || '-')}</td><td>${bdg(m.status)}</td></tr>`), 'Abhi kisi institute se nahi jude — <a href="join.html">Join Institute</a>.')) + pwCard());
  $('#spf').addEventListener('submit', async e => { e.preventDefault(); await guarded(e.submitter, async () => { const d = fv(e.target); await UMT.merge(['students', me().uid], d); UMT.ctx.stu = Object.assign(UMT.ctx.stu || {}, d); UMT.toast('Profile save ho gaya ✔'); }); });
  pwBind();
};
H['student/notices'] = async () => {
  const mems = (UMT.ctx.memberships || []).filter(m => m.status === 'approved'); let n = [];
  for (const m of mems) n = n.concat((await UMT.list('notices', ['instituteCode', '==', m.instituteCode])).map(x => ({ ...x, inst: m.instituteName })));
  n = UMT.newest(n);
  mount(card('Notices', n.length ? n.map(x => `<div style="padding:12px 0;border-bottom:1px solid var(--line)"><b>${E(x.title)}</b> <small class="muted">· ${E(x.inst)} · ${UMT.fmtDT(x.createdAt)}</small><br>${E(x.body || '')}</div>`).join('') : '<div class="empty">Abhi koi notice nahi.</div>'));
};
H['student/my-institutes'] = async () => {
  const m = UMT.newest(UMT.ctx.memberships || []);
  mount(card(`My Institutes (${m.length})`, `<p><a class="btn btn-primary btn-sm" href="join.html"><i class="fa-solid fa-plus"></i> Join Institute</a></p>` + table(['Institute', 'Course', 'Roll', 'Status', 'Since'], m.map(x => `<tr><td><b>${E(x.instituteName)}</b><br><small class="muted mono">${E(x.instituteCode)}</small></td><td>${E(x.course || '-')}<br><small class="muted">${E(x.session || '')}</small></td><td>${E(x.rollNo || '-')}</td><td>${bdg(x.status)}</td><td class="small">${UMT.fmtDate(x.createdAt)}</td></tr>`), 'Abhi kisi institute se nahi jude.')));
};
H['student/join'] = async () => {
  const all = (await UMT.list('institutes')).filter(i => i.status !== 'blocked'), mine = new Set((UMT.ctx.memberships || []).map(m => m.instituteCode));
  mount(card('Join Institute', `<input class="input" id="jq" placeholder="Institute ka naam, city ya code…" value="${E(new URLSearchParams(location.search).get('q') || '')}">`) + '<div id="jl" class="cards"></div>');
  const draw = () => { const q = $('#jq').value.trim().toLowerCase(); const l = all.filter(i => !q || [i.name, i.city, i.state, i.code].join(' ').toLowerCase().includes(q)).slice(0, 60);
    $('#jl').innerHTML = l.length ? l.map(i => `<div class="tile"><i class="fa-solid fa-building-columns"></i><b>${E(i.name)}</b><small>${E([i.city, i.state].filter(Boolean).join(', ') || '—')} · ${E(i.code)}</small>${mine.has(i.code) ? '<span class="badge ok">Requested / joined</span>' : `<button class="btn btn-primary btn-sm" data-join="${E(i.code)}">Send join request</button>`}</div>`).join('') : '<div class="empty" style="grid-column:1/-1">Koi institute nahi mila.</div>'; };
  draw(); $('#jq').addEventListener('input', draw);
  app().addEventListener('click', async e => {
    const b = e.target.closest('[data-join]'); if (!b) return; const i = all.find(x => x.code === b.dataset.join);
    await guarded(b, async () => { const s = UMT.ctx.stu || {}; await UMT.set(['memberships', i.code + '_' + me().uid], { instituteCode: i.code, instituteName: i.name, studentUid: me().uid, name: me().name, mobile: me().mobile, enrollmentNo: me().enrollmentNo, fatherName: s.fatherName || '', course: '', status: 'pending', requestedBy: 'student', createdAt: UMT.ts() }); mine.add(i.code); (UMT.ctx.memberships = UMT.ctx.memberships || []).push({ instituteCode: i.code, status: 'pending' }); draw(); UMT.toast('Request ' + i.name + ' ko bhej di ✔'); });
  });
};
H['student/courses'] = async () => {
  const l = UMT.newest(await UMT.list('enrollments', ['uid', '==', me().uid])), mems = (UMT.ctx.memberships || []).filter(m => m.status === 'approved' && m.course);
  mount(card('My Online Courses', `<p><a class="btn btn-primary btn-sm" href="../online-courses.html"><i class="fa-solid fa-cart-shopping"></i> Get a New Online Course</a></p>` + table(['Course', 'Enrolled on'], l.map(x => `<tr><td><b>${E(x.title)}</b></td><td>${UMT.fmtDate(x.createdAt)}</td></tr>`), 'Abhi kisi online course mein enroll nahi hue.')) + card('Institute courses', table(['Institute', 'Course'], mems.map(m => `<tr><td>${E(m.instituteName)}</td><td>${E(m.course)}</td></tr>`), 'Koi institute course nahi.')));
};
H['student/exams'] = async () => mount(card('Online Exams', '<div class="empty">Abhi koi online exam available nahi hai.</div>'));
H['student/refer'] = async () => {
  const link = UMT.root + 'register.html?as=student&ref=' + me().enrollmentNo;
  mount(card('Refer & Earn', `<p>Aapka referral code: <b class="mono" style="font-size:20px">${E(me().enrollmentNo)}</b></p><p><code>${E(link)}</code> <button class="btn btn-light btn-sm" id="cpr">Copy</button> <a class="btn btn-light btn-sm" target="_blank" href="https://wa.me/?text=${encodeURIComponent('AADI par free student account banayein: ' + link)}">WhatsApp</a></p><p class="small muted">Reward admin verify karke deta hai.</p>`));
  $('#cpr').onclick = () => copy(link);
};

/* ===================================================================
   TEACHER profile
   =================================================================== */
H['teacher/profile'] = async () => {
  const s = UMT.ctx.staff || {};
  mount(card('My Profile', `<p><b>${E(me().name)}</b><br>Staff ID: <b class="mono">${E(me().staffId)}</b><br>Mobile: ${E(me().mobile)}<br>Subject: ${E(s.subject || '-')}<br>Institute: ${E(inst().name || '')} (${E(code())})</p>`) + pwCard());
  pwBind();
};

/* ===================================================================
   boot
   =================================================================== */
const STATIC_NOTE = ['panel/bulk', 'panel/bulk-students', 'panel/cert-rules', 'panel/designs', 'panel/exams', 'panel/trash'];
function scrub() {
  $$('table.tbl tbody').forEach(tb => tb.innerHTML = '<tr><td colspan="20" class="empty">Abhi koi record nahi.</td></tr>');
  $$('form input[value]:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button])').forEach(i => i.value = '');
  const body = $('.pbody'); if (body && STATIC_NOTE.includes(page)) body.insertAdjacentHTML('afterbegin', msg('Ye page abhi sirf design (UI) hai — Firebase se connect nahi hua.', 'danger'));
}
function fixWhatsApp() {
  const wa = $('a.wa-fab'); if (!wa) return; let h = wa.getAttribute('href') || '';
  h = h.replace('Lakshya%20Classes%20%28BR836811%29', encodeURIComponent((inst().name || '') + ' (' + (code() || '') + ')'))
    .replace('Aditya%20Kumar%20%28VS2649514939%29', encodeURIComponent((me().name || '') + ' (' + (me().enrollmentNo || me().staffId || '') + ')'))
    .replace(/https%3A%2F%2Fumtvidya\.in/, encodeURIComponent(location.origin));
  wa.setAttribute('href', h);
}
async function chrome() {
  fixWhatsApp();
  if (area === 'panel' && UMT.ctx.inst) {
    $$('.wallet-chip[href$="wallet.html"]').forEach(a => a.innerHTML = '<i class="fa-solid fa-wallet"></i> ' + money(inst().wallet));
    try {
      const [mem, adm] = await Promise.all([UMT.list('memberships', ['instituteCode', '==', code()], ['status', '==', 'pending']), UMT.list('admissions', ['instituteCode', '==', code()], ['status', '==', 'new'])]);
      $$('.side-nav .nb').forEach(n => n.remove());
      const add = (href, n) => { const a = $(`.side-nav a[href="${href}"]`); if (a && n) a.insertAdjacentHTML('beforeend', `<b class="nb">${n}</b>`); };
      add('index.html', mem.length + adm.length); add('students-pending.html', mem.length); add('admission.html', adm.length);
      const bell = $('.bell b'); if (bell) { bell.textContent = mem.length; bell.style.display = mem.length ? '' : 'none'; }
    } catch (e) { console.warn(e); }
  }
  if (area === 'student' && !UMT.ctx.inst) {
    const ni = $('[data-u="inst.name"]'); if (ni && ni.parentElement) ni.parentElement.innerHTML = '<a href="join.html" style="color:#fff;text-decoration:underline">Abhi koi institute nahi — Join Institute karein</a>';
    const nc = $('[data-u="mem.course"]'); if (nc && nc.parentElement) nc.parentElement.textContent = 'Abhi kisi course mein enrolled nahi';
  }
}
(async () => {
  if (!ROLE) return;
  await UMT.guard(ROLE);
  if (!UMT.configured) { $$('img[data-sample]').forEach(i => i.src = i.dataset.sample); if (app()) mount(card('', '<div class="empty"><b>Preview mode</b><br>Is page ka data dekhne ke liye <code>assets/js/firebase-config.js</code> mein Firebase config daalein.</div>')); return; }
  document.body.classList.add('umt-ready'); UMT.bind(); chrome();
  const h = H[page];
  try { if (h) await h(); else scrub(); }
  catch (e) { console.error(e); UMT.toast(UMT.err(e).message, 'err'); if (app()) mount(msg(E(UMT.err(e).message), 'danger')); }
  UMT.bind();
})();
