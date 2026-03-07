import { auth, db } from './firebase-config.js';
import { requireAuth }  from './auth-guard.js';
import { signOut }      from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
  collection, query, where,
  getDocs, doc, setDoc, updateDoc, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ── State ─────────────────────────────────────────────────────
let profile    = null;
let subjects   = [];    // enrolled subjects
let activities = [];    // all activities for enrolled subjects
let statuses   = {};    // { [activityId]: { id, completed, completedAt } }
let currentTab = 'active';

// ── Bootstrap ─────────────────────────────────────────────────
requireAuth(async (userProfile) => {
  profile = userProfile;
  setupUI();
  await loadData();
  renderActivities();
});

// ── UI setup ──────────────────────────────────────────────────
function setupUI() {
  document.getElementById('user-name').textContent = profile.name || profile.username;

  if (profile.role === 'ADMIN') {
    document.getElementById('admin-link').classList.remove('hidden');
  }

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'login.html';
  });

  // Tab switching
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      renderActivities();
    });
  });

  // Filters
  ['filter-subject', 'filter-type', 'filter-status'].forEach((id) => {
    document.getElementById(id).addEventListener('change', renderActivities);
  });

  // Event delegation — admin action buttons
  const list = document.getElementById('activity-list');
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const card = btn.closest('[data-activity-id]');
    if (!card) return;
    const aid = card.dataset.activityId;
    switch (btn.dataset.action) {
      case 'archive': archiveActivity(aid); break;
      case 'restore': restoreActivity(aid); break;
      case 'edit':    window.location.href = `admin.html?edit=${aid}`; break;
    }
  });
}

// ── Data loading ──────────────────────────────────────────────
async function loadData() {
  // 1. Enrollments for this student
  const enrollSnap = await getDocs(query(
    collection(db, 'enrollments'),
    where('studentUid', '==', profile.uid)
  ));
  const enrolledIds = enrollSnap.docs.map(d => d.data().subjectId);

  if (enrolledIds.length === 0) {
    subjects = [];
    activities = [];
    statuses = {};
    populateSubjectFilter();
    return;
  }

  // 2. Subjects
  const subjSnap = await getDocs(collection(db, 'subjects'));
  subjects = subjSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(s => enrolledIds.includes(s.id));
  populateSubjectFilter();

  // 3. Activities (batch in groups of 10 for Firestore 'in' limit,
  //    run all batches in parallel for performance)
  const batches = [];
  for (let i = 0; i < enrolledIds.length; i += 10) {
    const batch = enrolledIds.slice(i, i + 10);
    batches.push(
      getDocs(query(collection(db, 'activities'), where('subjectId', 'in', batch)))
    );
  }
  const batchResults = await Promise.all(batches);
  const allActivities = [];
  batchResults.forEach(snap =>
    snap.docs.forEach(d => allActivities.push({ id: d.id, ...d.data() }))
  );
  activities = allActivities;

  // 4. Activity statuses for this student
  const statusSnap = await getDocs(query(
    collection(db, 'activityStatus'),
    where('studentUid', '==', profile.uid)
  ));
  statuses = {};
  statusSnap.docs.forEach(d => {
    const data = d.data();
    statuses[data.activityId] = { id: d.id, ...data };
  });
}

function populateSubjectFilter() {
  const sel = document.getElementById('filter-subject');
  while (sel.options.length > 1) sel.remove(1);
  subjects.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    sel.appendChild(opt);
  });
}

// ── Render ────────────────────────────────────────────────────
function renderActivities() {
  const filterSubject = document.getElementById('filter-subject').value;
  const filterType    = document.getElementById('filter-type').value;
  const filterStatus  = document.getElementById('filter-status').value;
  const now = new Date();

  let filtered = activities.filter(a => {
    if (currentTab === 'active'   && a.archived) return false;
    if (currentTab === 'archived' && !a.archived) return false;
    if (filterSubject && a.subjectId !== filterSubject) return false;
    if (filterType    && a.type     !== filterType)     return false;

    // Mostrar apenas atividades com data hoje ou maior, exceto se filtro de status for 'completed' ou 'overdue'
    const dueDate = toDate(a.dueDate);
    if (!filterStatus && dueDate < now.setHours(0,0,0,0)) return false;

    return true;
  });

  // Sort by dueDate ascending
  filtered.sort((a, b) => toDate(a.dueDate) - toDate(b.dueDate));

  const container = document.getElementById('activity-list');

  if (filtered.length === 0) {
    const msg = enrolledSubjectsEmpty()
      ? 'Você não está matriculado em nenhuma disciplina.<br>Contate o administrador.'
      : 'Nenhuma tarefa encontrada.';
    container.innerHTML = `<div class="empty-state">${msg}</div>`;
    return;
  }

  container.innerHTML = '';
  filtered.forEach(a => {
    const subject   = subjects.find(s => s.id === a.subjectId);
    container.appendChild(buildActivityCard(a, subject));
  });
}

function enrolledSubjectsEmpty() { return subjects.length === 0; }

function buildActivityCard(activity, subject) {
  const card     = document.createElement('div');
  card.className = 'activity-card';
  card.dataset.activityId = activity.id;

  const dueDate    = toDate(activity.dueDate);
  const dueDateStr = dueDate.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  const TYPE_LABEL = { PROVA: 'Prova', CURSO: 'Curso', ATIVIDADE: 'Atividade' };
  const TYPE_BADGE = { PROVA: 'badge-prova', CURSO: 'badge-curso', ATIVIDADE: 'badge-tarefa' };

  const typeLabel = TYPE_LABEL[activity.type] || activity.type;
  const typeBadge = TYPE_BADGE[activity.type] || '';

  // Admin action buttons
  let adminHTML = '';
  if (profile.role === 'ADMIN') {
    adminHTML = currentTab === 'active'
      ? `<button class="btn btn-small" data-action="edit">Editar</button>
         <button class="btn btn-small btn-danger" data-action="archive">Arquivar</button>`
      : `<button class="btn btn-small" data-action="restore">Restaurar</button>`;
  }

  // Attachments
  let attachHTML = '';
  if (activity.attachments?.length > 0) {
    attachHTML = '<div class="attachments">'
      + activity.attachments.map(att =>
          `<a href="${esc(att.url)}" target="_blank" rel="noopener noreferrer"
              class="attachment-link">📎 ${esc(att.name)}</a>`
        ).join('')
      + '</div>';
  }

  const dueLabel = `<span class="activity-due">Vence: ${dueDateStr}</span>`;

  const descHTML = activity.description
    ? `<p class="activity-desc">${esc(activity.description)}</p>` : '';

  card.innerHTML = `
    <div class="activity-info">
      <div class="activity-title">${esc(activity.title)}</div>
      ${subject ? `<div class="activity-subject">${esc(subject.name)}${subject.code ? ` [${esc(subject.code)}]` : ''}</div>` : ''}
      <div class="activity-meta"><span class="badge ${typeBadge}">${typeLabel}</span></div>
      ${dueLabel}
      ${descHTML}
      ${attachHTML}
    </div>
    <div class="activity-actions">${adminHTML}</div>
  `;

  return card;
}

// ── Admin: archive / restore ──────────────────────────────────
async function archiveActivity(activityId) {
  if (!confirm('Arquivar esta atividade?')) return;
  try {
    await updateDoc(doc(db, 'activities', activityId), { archived: true });
    const a = activities.find(x => x.id === activityId);
    if (a) a.archived = true;
    renderActivities();
  } catch {
    alert('Erro ao arquivar. Tente novamente.');
  }
}

async function restoreActivity(activityId) {
  try {
    await updateDoc(doc(db, 'activities', activityId), { archived: false });
    const a = activities.find(x => x.id === activityId);
    if (a) a.archived = false;
    renderActivities();
  } catch {
    alert('Erro ao restaurar. Tente novamente.');
  }
}

// ── Add filters for tasks ─────────────────────────────
function applyTaskFilters(filters) {
  const { past, discipline } = filters;

  let filteredTasks = activities;

  if (past) {
    filteredTasks = filteredTasks.filter(task => new Date(task.dueDate) < new Date());
  }

  if (discipline) {
    filteredTasks = filteredTasks.filter(task => task.subjectId === discipline);
  }

  renderTasks(filteredTasks);
}

// ── Utilities ─────────────────────────────────────────────────
function toDate(val) {
  if (!val) return new Date(0);
  if (typeof val.toDate === 'function') return val.toDate();
  return new Date(val);
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}
