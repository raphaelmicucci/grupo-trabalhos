import { db } from './firebase-config.js';
import {
  collection,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let currentMode = 'schedule';
let selectedStudentUid = null;

let students = [];
let subjects = [];
let enrollments = [];
let activities = [];

const loadingOverlay = document.getElementById('loading-overlay');
const scheduleButton = document.getElementById('schedule-button');
const tasksButton = document.getElementById('tasks-button');
const studentListEl = document.getElementById('student-list-home');
const resultListEl = document.getElementById('result-list');
const taskFiltersEl = document.getElementById('tasks-filters');

const filterSubjectEl = document.getElementById('filter-subject');
const filterTypeEl = document.getElementById('filter-type');
const filterPastEl = document.getElementById('filter-past');

bootstrap().catch((err) => {
  console.error('Erro ao carregar página inicial:', err);
  loadingOverlay.classList.add('hidden');
  resultListEl.className = 'empty-state';
  resultListEl.textContent = 'Erro ao carregar dados. Tente novamente.';
});

async function bootstrap() {
  bindEvents();

  const [usersSnap, subjectsSnap, enrollmentsSnap, activitiesSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'subjects')),
    getDocs(collection(db, 'enrollments')),
    getDocs(collection(db, 'activities'))
  ]);

  students = usersSnap.docs
    .map((d) => ({ uid: d.id, ...d.data() }))
    .sort((a, b) => displayStudentName(a).localeCompare(displayStudentName(b), 'pt-BR'));

  subjects = subjectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  enrollments = enrollmentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  activities = activitiesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  renderStudents();
  loadingOverlay.classList.add('hidden');
}

function bindEvents() {
  scheduleButton.addEventListener('click', () => setMode('schedule'));
  tasksButton.addEventListener('click', () => setMode('tasks'));

  [filterSubjectEl, filterTypeEl, filterPastEl].forEach((el) => {
    el.addEventListener('change', renderSelectedStudentData);
  });
}

function setMode(mode) {
  currentMode = mode;

  scheduleButton.classList.toggle('btn-primary', mode === 'schedule');
  tasksButton.classList.toggle('btn-primary', mode === 'tasks');

  if (mode === 'schedule') {
    taskFiltersEl.classList.add('hidden');
  } else {
    taskFiltersEl.classList.remove('hidden');
    populateTaskSubjectFilter();
  }

  renderSelectedStudentData();
}

function renderStudents() {
  if (students.length === 0) {
    studentListEl.innerHTML = '<div class="empty-state">Nenhum aluno encontrado.</div>';
    return;
  }

  studentListEl.innerHTML = '';
  students.forEach((student) => {
    const uid = student.uid || student.id;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `student-card ${uid === selectedStudentUid ? 'active' : ''}`;
    card.dataset.uid = uid;

    const avatarUrl = student.photoURL || student.photoUrl || '';
    const avatarHTML = avatarUrl
      ? `<img class="student-avatar" src="${esc(avatarUrl)}" alt="${esc(displayStudentName(student))}">`
      : `<div class="student-avatar placeholder">${initials(displayStudentName(student))}</div>`;

    card.innerHTML = `
      ${avatarHTML}
      <div class="student-name">${esc(displayStudentName(student))}</div>
    `;

    card.addEventListener('click', () => {
      selectedStudentUid = uid;
      document.querySelectorAll('.student-card').forEach((el) => {
        el.classList.toggle('active', el.dataset.uid === uid);
      });
      populateTaskSubjectFilter();
      renderSelectedStudentData();
    });

    studentListEl.appendChild(card);
  });
}

function renderSelectedStudentData() {
  if (!selectedStudentUid) {
    resultListEl.className = 'empty-state';
    resultListEl.textContent = 'Selecione um aluno.';
    return;
  }

  if (currentMode === 'schedule') {
    renderScheduleForStudent(selectedStudentUid);
  } else {
    renderTasksForStudent(selectedStudentUid);
  }
}

function renderScheduleForStudent(studentUid) {
  const enrolledSubjectIds = new Set(
    enrollments
      .filter((e) => e.studentUid === studentUid)
      .map((e) => e.subjectId)
  );

  const studentSubjects = subjects
    .filter((s) => enrolledSubjectIds.has(s.id))
    .sort((a, b) => compareSubjects(a, b));

  if (studentSubjects.length === 0) {
    resultListEl.className = 'empty-state';
    resultListEl.textContent = 'Este aluno não está matriculado em disciplinas.';
    return;
  }

  const highlightedSubjectId = getScheduleHighlightSubjectId(studentSubjects, new Date());

  resultListEl.className = '';
  resultListEl.innerHTML = studentSubjects.map((subject) => `
    <div class="activity-card schedule-card${subject.id === highlightedSubjectId ? ' schedule-card-highlight' : ''}">
      <div class="activity-info">
        <div class="activity-title">${esc(subject.name || 'Sem nome')}</div>
        <div class="activity-subject-row">
          <div class="activity-subject">${esc(subject.code || '')}</div>
          ${getTeamsUrl(subject)
            ? `<a class="teams-link-btn" href="${esc(getTeamsUrl(subject))}" target="_blank" rel="noopener noreferrer" title="Abrir no Microsoft Teams" aria-label="Abrir ${esc(subject.name || 'disciplina')} no Microsoft Teams">
                <img src="assets/icons/Teams-Icon-FY26.svg" alt="Teams">
              </a>`
            : ''}
        </div>
        <div class="activity-meta">${esc(formatWeekday(subject.weekday))} | ${esc(formatHorario(subject.horario_inicio, subject.duracao))}</div>
        ${subject.professor ? `<div class="activity-desc">Professor: ${esc(subject.professor)}</div>` : ''}
      </div>
    </div>
  `).join('');
}

function renderTasksForStudent(studentUid) {
  const enrolledSubjectIds = new Set(
    enrollments
      .filter((e) => e.studentUid === studentUid)
      .map((e) => e.subjectId)
  );

  const today = startOfDay(new Date());
  const period = filterPastEl.value;
  const subjectFilter = filterSubjectEl.value;
  const typeFilter = filterTypeEl.value;

  let filtered = activities.filter((a) => {
    if (!enrolledSubjectIds.has(a.subjectId)) return false;
    if (a.archived) return false;
    if (subjectFilter && a.subjectId !== subjectFilter) return false;
    if (typeFilter && a.type !== typeFilter) return false;

    const due = startOfDay(toDate(a.dueDate));
    if (period === 'future' && due < today) return false;
    if (period === 'past' && due >= today) return false;

    return true;
  });

  filtered = filtered.sort((a, b) => toDate(a.dueDate) - toDate(b.dueDate));

  if (filtered.length === 0) {
    resultListEl.className = 'empty-state';
    resultListEl.textContent = 'Nenhuma tarefa encontrada com os filtros atuais.';
    return;
  }

  resultListEl.className = '';
  resultListEl.innerHTML = filtered.map((a) => {
    const subject = subjects.find((s) => s.id === a.subjectId);
    const dueDate = toDate(a.dueDate).toLocaleDateString('pt-BR');
    const typeLabel = mapTypeLabel(a.type);
    const typeBadge = mapTypeBadge(a.type);

    const attachments = Array.isArray(a.attachments) && a.attachments.length > 0
      ? `<div class="attachments">${a.attachments.map((att) =>
          `<a href="${esc(att.url)}" target="_blank" rel="noopener noreferrer" class="attachment-link">Anexo: ${esc(att.name || 'arquivo')}</a>`
        ).join('')}</div>`
      : '';

    return `
      <div class="activity-card" data-activity-id="${esc(a.id)}">
        <div class="activity-info">
          <div class="activity-title">${esc(a.title || 'Sem título')}</div>
          ${subject ? `<div class="activity-subject">${esc(subject.name)}${subject.code ? ` [${esc(subject.code)}]` : ''}</div>` : ''}
          <div class="activity-meta"><span class="badge ${typeBadge}">${typeLabel}</span></div>
          <span class="activity-due">Vence: ${dueDate}</span>
          ${a.description ? `<p class="activity-desc">${esc(a.description)}</p>` : ''}
          ${attachments}
        </div>
      </div>
    `;
  }).join('');
}

function populateTaskSubjectFilter() {
  const current = filterSubjectEl.value;
  while (filterSubjectEl.options.length > 1) {
    filterSubjectEl.remove(1);
  }

  if (!selectedStudentUid) {
    return;
  }

  const enrolledSubjectIds = new Set(
    enrollments
      .filter((e) => e.studentUid === selectedStudentUid)
      .map((e) => e.subjectId)
  );

  const studentSubjects = subjects
    .filter((s) => enrolledSubjectIds.has(s.id))
    .sort((a, b) => compareSubjects(a, b));

  studentSubjects.forEach((s) => {
    const option = document.createElement('option');
    option.value = s.id;
    option.textContent = s.name || s.code || s.id;
    filterSubjectEl.appendChild(option);
  });

  if (current && studentSubjects.some((s) => s.id === current)) {
    filterSubjectEl.value = current;
  } else {
    filterSubjectEl.value = '';
  }
}

function compareSubjects(a, b) {
  const weekdayOrder = { SEG: 0, TER: 1, QUA: 2, QUI: 3, SEX: 4, SAB: 5 };
  const dayA = weekdayOrder[a.weekday] ?? 99;
  const dayB = weekdayOrder[b.weekday] ?? 99;
  if (dayA !== dayB) return dayA - dayB;
  return (a.horario_inicio || '').localeCompare(b.horario_inicio || '');
}

function formatWeekday(code) {
  const map = {
    SEG: 'Segunda-feira',
    TER: 'Terça-feira',
    QUA: 'Quarta-feira',
    QUI: 'Quinta-feira',
    SEX: 'Sexta-feira',
    SAB: 'Sábado'
  };
  return map[code] || code || 'Sem dia';
}

function formatHorario(inicio, duracao) {
  if (!inicio) return 'Horário não informado';
  const minutesByDuration = { '1h40': 100, '3h30': 210 };
  const mins = minutesByDuration[duracao];
  if (!mins) return inicio;

  const [h, m] = inicio.split(':').map(Number);
  const total = h * 60 + m + mins;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${inicio} às ${hh}:${mm}`;
}

function getScheduleHighlightSubjectId(subjectList, now) {
  const todayCode = weekdayCodeFromDate(now);
  if (!todayCode) return null;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todaySubjects = subjectList
    .filter((s) => s.weekday === todayCode)
    .map((s) => {
      const start = timeToMinutes(s.horario_inicio);
      const duration = durationToMinutes(s.duracao);
      const end = start !== null && duration !== null ? start + duration : null;
      return { subject: s, start, end };
    })
    .filter((item) => item.start !== null)
    .sort((a, b) => a.start - b.start);

  if (todaySubjects.length === 0) return null;

  const ongoing = todaySubjects.find((item) => item.end !== null && currentMinutes >= item.start && currentMinutes < item.end);
  if (ongoing) return ongoing.subject.id;

  const next = todaySubjects.find((item) => currentMinutes <= item.start);
  return next ? next.subject.id : null;
}

function weekdayCodeFromDate(date) {
  const day = date.getDay();
  return ({ 1: 'SEG', 2: 'TER', 3: 'QUA', 4: 'QUI', 5: 'SEX', 6: 'SAB' }[day] || null);
}

function timeToMinutes(hhmm) {
  if (typeof hhmm !== 'string' || !hhmm.includes(':')) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function durationToMinutes(duracao) {
  return ({ '1h40': 100, '3h30': 210 }[duracao] ?? null);
}

function mapTypeLabel(type) {
  return ({ PROVA: 'Prova', CURSO: 'Curso', ATIVIDADE: 'Atividade' }[type] || type || 'Tipo');
}

function mapTypeBadge(type) {
  return ({ PROVA: 'badge-prova', CURSO: 'badge-curso', ATIVIDADE: 'badge-tarefa' }[type] || '');
}

function getTeamsUrl(subject) {
  const url = subject?.teams_url;
  if (typeof url !== 'string') return '';
  return url.trim();
}
function displayStudentName(student) {
  return student.name || student.username || student.email || 'Aluno';
}

function initials(name) {
  return (name || 'A')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDate(val) {
  if (!val) return new Date(0);
  if (typeof val.toDate === 'function') return val.toDate();
  return new Date(val);
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

