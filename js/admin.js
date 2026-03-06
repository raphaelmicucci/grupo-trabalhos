import { auth, db, storage } from './firebase-config.js';
import { requireAdmin } from './auth-guard.js';
import { signOut }      from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
  collection, query, getDocs,
  doc, addDoc, setDoc, updateDoc, deleteDoc, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import {
  ref, uploadBytes, getDownloadURL, deleteObject
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

// ── Constants ─────────────────────────────────────────────────
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ── State ─────────────────────────────────────────────────────
let profile     = null;
let subjects    = [];
let activities  = [];
let users       = [];     // all users (for enrollments tab)
let enrollments = [];
let currentTab  = 'subjects';

// Pending state for the modal
let modalSaveCallback = null;
let pendingFiles      = [];   // new files to upload
let removedAttachUrls = [];   // attachment URLs to delete from Storage

// ── Bootstrap ─────────────────────────────────────────────────
requireAdmin(async (adminProfile) => {
  profile = adminProfile;

  document.getElementById('user-name').textContent =
    adminProfile.name || adminProfile.username;

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
      renderCurrentTab();
    });
  });

  // Modal close buttons
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });
  document.getElementById('modal-save').addEventListener('click', async () => {
    if (modalSaveCallback) await modalSaveCallback();
  });

  await loadAllData();
  renderCurrentTab();

  // Auto-open edit modal if URL has ?edit=<activityId>
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get('edit');
  if (editId) {
    const activity = activities.find(a => a.id === editId);
    if (activity) openActivityModal(activity);
    // Clean up URL
    window.history.replaceState({}, '', 'admin.html');
  }
});

// ── Load all data ─────────────────────────────────────────────
async function loadAllData() {
  const [subSnap, actSnap, usrSnap, enrSnap] = await Promise.all([
    getDocs(collection(db, 'subjects')),
    getDocs(collection(db, 'activities')),
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'enrollments'))
  ]);
  subjects    = subSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  activities  = actSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  users       = usrSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  enrollments = enrSnap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Tab rendering ─────────────────────────────────────────────
function renderCurrentTab() {
  switch (currentTab) {
    case 'subjects':    renderSubjectsTab();    break;
    case 'activities':  renderActivitiesTab();  break;
    case 'enrollments': renderEnrollmentsTab(); break;
  }
}

// ── Time helpers ─────────────────────────────────────────────
const DURACAO_MINUTOS = { '1h40': 100, '3h30': 210 };

function addMinutes(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const total  = h * 60 + m + minutes;
  const hh     = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const mm     = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatHorario(inicio, duracao) {
  if (!inicio || !duracao) return '—';
  const mins = DURACAO_MINUTOS[duracao];
  if (!mins) return inicio;
  return `${inicio} às ${addMinutes(inicio, mins)}`;
}

// ════════════════════════════════════════════════════════════════
// SUBJECTS TAB
// ════════════════════════════════════════════════════════════════
function renderSubjectsTab() {
  const content = document.getElementById('tab-content');
  content.innerHTML = `
    <div class="section-header">
      <h2>Disciplinas</h2>
      <button class="btn btn-primary btn-small" id="btn-new-subject">
        + Nova disciplina
      </button>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nome</th><th>Código</th><th>Professor</th>
            <th>Dia</th><th>Horário</th><th>Semestre</th><th>Ações</th>
          </tr>
        </thead>
        <tbody id="subjects-tbody"></tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-new-subject').addEventListener('click', () =>
    openSubjectModal()
  );

  const tbody = document.getElementById('subjects-tbody');
  if (subjects.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">Nenhuma disciplina cadastrada.</td></tr>';
    return;
  }

  const WEEKDAYS = {
    SEG:'Segunda', TER:'Terça', QUA:'Quarta',
    QUI:'Quinta',  SEX:'Sexta', SAB:'Sábado'
  };

  tbody.innerHTML = subjects.map(s => `
    <tr data-id="${s.id}">
      <td>${esc(s.name)}</td>
      <td>${esc(s.code)}</td>
      <td>${esc(s.professor)}</td>
      <td>${WEEKDAYS[s.weekday] || s.weekday}</td>
      <td>${formatHorario(s.horario_inicio, s.duracao)}</td>
      <td>${esc(s.semester)}</td>
      <td class="td-actions">
        <button class="btn btn-small" data-action="edit-subject">Editar</button>
        <button class="btn btn-small btn-danger" data-action="delete-subject">Excluir</button>
      </td>
    </tr>
  `).join('');

  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.closest('tr').dataset.id;
    const subject = subjects.find(s => s.id === id);
    if (!subject) return;
    if (btn.dataset.action === 'edit-subject')   openSubjectModal(subject);
    if (btn.dataset.action === 'delete-subject') deleteSubject(id);
  });
}

function openSubjectModal(subject = null) {
  const WEEKDAY_OPTIONS = [
    ['SEG','Segunda-feira'],['TER','Terça-feira'],['QUA','Quarta-feira'],
    ['QUI','Quinta-feira'], ['SEX','Sexta-feira'],['SAB','Sábado']
  ];

  showModal(
    subject ? 'Editar Disciplina' : 'Nova Disciplina',
    `<form id="subject-form">
      <div class="form-group">
        <label for="s-name">Nome *</label>
        <input type="text" id="s-name" required value="${esc(subject?.name ?? '')}">
      </div>
      <div class="form-group">
        <label for="s-code">Código *</label>
        <input type="text" id="s-code" required value="${esc(subject?.code ?? '')}">
      </div>
      <div class="form-group">
        <label for="s-prof">Professor</label>
        <input type="text" id="s-prof" value="${esc(subject?.professor ?? '')}">
      </div>
      <div class="form-group">
        <label for="s-weekday">Dia da semana *</label>
        <select id="s-weekday" required>
          ${WEEKDAY_OPTIONS.map(([val, lbl]) =>
            `<option value="${val}" ${subject?.weekday === val ? 'selected' : ''}>${lbl}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label for="s-semester">Semestre do Curso *</label>
        <input type="text" id="s-semester" required placeholder="6"
               value="${esc(subject?.semester ?? '')}">
      </div>
      <div class="form-group">
        <label for="s-horario">Horário de início *</label>
        <input type="time" id="s-horario" required
               value="${esc(subject?.horario_inicio ?? '14:50')}">
      </div>
      <div class="form-group">
        <label for="s-duracao">Duração *</label>
        <select id="s-duracao" required>
          <option value="" disabled ${!subject?.duracao ? 'selected' : ''}>Selecione</option>
          <option value="1h40" ${subject?.duracao === '1h40' ? 'selected' : ''}>1h40</option>
          <option value="3h30" ${subject?.duracao === '3h30' ? 'selected' : ''}>3h30</option>
        </select>
      </div>
    </form>`,
    async () => {
      const name          = document.getElementById('s-name').value.trim();
      const code          = document.getElementById('s-code').value.trim();
      const prof          = document.getElementById('s-prof').value.trim();
      const weekday       = document.getElementById('s-weekday').value;
      const semester      = document.getElementById('s-semester').value.trim();
      const horario_inicio = document.getElementById('s-horario').value;
      const duracao       = document.getElementById('s-duracao').value;

      if (!name || !code || !weekday || !semester || !horario_inicio || !duracao) {
        alertModal('Preencha todos os campos obrigatórios.');
        return;
      }

      const data = { name, code, professor: prof, weekday, semester, horario_inicio, duracao };
      setModalLoading(true);

      try {
        if (subject) {
          await updateDoc(doc(db, 'subjects', subject.id), data);
          Object.assign(subjects.find(s => s.id === subject.id), data);
        } else {
          const newRef = await addDoc(collection(db, 'subjects'), data);
          subjects.push({ id: newRef.id, ...data });
        }
        closeModal();
        renderSubjectsTab();
      } catch {
        alertModal('Erro ao salvar disciplina.');
        setModalLoading(false);
      }
    }
  );
}

async function deleteSubject(id) {
  // Block deletion if any activities or enrollments reference this subject
  const hasActivities = activities.some(a => a.subjectId === id);
  const hasEnrollments = enrollments.some(e => e.subjectId === id);

  if (hasActivities || hasEnrollments) {
    alert(
      'Não é possível excluir esta disciplina porque ela possui ' +
      (hasActivities ? 'atividades' : '') +
      (hasActivities && hasEnrollments ? ' e ' : '') +
      (hasEnrollments ? 'matrículas' : '') +
      ' vinculadas. Remova-as primeiro.'
    );
    return;
  }

  if (!confirm('Excluir esta disciplina? Esta ação não pode ser desfeita.')) return;
  try {
    await deleteDoc(doc(db, 'subjects', id));
    subjects = subjects.filter(s => s.id !== id);
    renderSubjectsTab();
  } catch {
    alert('Erro ao excluir. Tente novamente.');
  }
}

// ════════════════════════════════════════════════════════════════
// ACTIVITIES TAB
// ════════════════════════════════════════════════════════════════
function renderActivitiesTab() {
  const content = document.getElementById('tab-content');
  content.innerHTML = `
    <div class="section-header">
      <h2>Atividades</h2>
      <button class="btn btn-primary btn-small" id="btn-new-activity">
        + Nova atividade
      </button>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Título</th><th>Disciplina</th><th>Tipo</th>
            <th>Vencimento</th><th>Arquivada</th><th>Ações</th>
          </tr>
        </thead>
        <tbody id="activities-tbody"></tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-new-activity').addEventListener('click', () =>
    openActivityModal()
  );

  const tbody = document.getElementById('activities-tbody');
  if (activities.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">Nenhuma atividade cadastrada.</td></tr>';
    return;
  }

  // Sort by dueDate desc
  const sorted = [...activities].sort((a, b) => toDate(b.dueDate) - toDate(a.dueDate));

  tbody.innerHTML = sorted.map(a => {
    const subject = subjects.find(s => s.id === a.subjectId);
    const dueStr  = toDate(a.dueDate).toLocaleDateString('pt-BR');
    const archived = a.archived ? '✓' : '—';
    return `
      <tr data-id="${a.id}">
        <td>${esc(a.title)}</td>
        <td>${subject ? esc(subject.name) : '<em>—</em>'}</td>
        <td>${a.type}</td>
        <td>${dueStr}</td>
        <td>${archived}</td>
        <td class="td-actions">
          <button class="btn btn-small" data-action="edit-activity">Editar</button>
          ${a.archived
            ? `<button class="btn btn-small" data-action="restore-activity">Restaurar</button>`
            : `<button class="btn btn-small btn-danger" data-action="archive-activity">Arquivar</button>`
          }
        </td>
      </tr>`;
  }).join('');

  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.closest('tr').dataset.id;
    const activity = activities.find(a => a.id === id);
    if (!activity) return;
    switch (btn.dataset.action) {
      case 'edit-activity':    openActivityModal(activity); break;
      case 'archive-activity': adminArchive(id);            break;
      case 'restore-activity': adminRestore(id);            break;
    }
  });
}

function openActivityModal(activity = null) {
  pendingFiles      = [];
  removedAttachUrls = [];

  const subjectOptions = subjects.map(s =>
    `<option value="${s.id}" ${activity?.subjectId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`
  ).join('');

  const existingAttachments = (activity?.attachments ?? []).map(att => `
    <li data-url="${esc(att.url)}">
      <span>📎 ${esc(att.name)} (${formatSize(att.size)})</span>
      <button type="button" class="btn btn-small btn-danger"
              data-remove-attach="${esc(att.url)}">Remover</button>
    </li>`
  ).join('');

  const dueDateValue = activity
    ? toDate(activity.dueDate).toISOString().split('T')[0]
    : '';

  showModal(
    activity ? 'Editar Atividade' : 'Nova Atividade',
    `<form id="activity-form">
      <div class="form-group">
        <label for="a-title">Título *</label>
        <input type="text" id="a-title" required value="${esc(activity?.title ?? '')}">
      </div>
      <div class="form-group">
        <label for="a-subject">Disciplina *</label>
        <select id="a-subject" required>
          <option value="">Selecione...</option>
          ${subjectOptions}
        </select>
      </div>
      <div class="form-group">
        <label for="a-type">Tipo *</label>
        <select id="a-type" required>
          <option value="">Selecione...</option>
          <option value="PROVA"    ${activity?.type === 'PROVA'    ? 'selected' : ''}>Prova</option>
          <option value="TRABALHO" ${activity?.type === 'TRABALHO' ? 'selected' : ''}>Trabalho</option>
          <option value="LISTA"    ${activity?.type === 'LISTA'    ? 'selected' : ''}>Lista</option>
        </select>
      </div>
      <div class="form-group">
        <label for="a-due">Data de vencimento *</label>
        <input type="date" id="a-due" required value="${dueDateValue}">
      </div>
      <div class="form-group">
        <label for="a-desc">Descrição</label>
        <textarea id="a-desc">${esc(activity?.description ?? '')}</textarea>
      </div>
      <div class="form-group">
        <label>Anexos (máx. 10 MB por arquivo)</label>
        ${existingAttachments
          ? `<ul class="file-list" id="existing-attachments">${existingAttachments}</ul>`
          : ''}
        <div class="file-upload-zone" id="upload-zone">
          Clique ou arraste arquivos aqui
        </div>
        <input type="file" id="a-files" multiple style="display:none">
        <ul class="file-list" id="pending-files-list"></ul>
      </div>
    </form>`,
    async () => {
      const title     = document.getElementById('a-title').value.trim();
      const subjectId = document.getElementById('a-subject').value;
      const type      = document.getElementById('a-type').value;
      const dueStr    = document.getElementById('a-due').value;
      const desc      = document.getElementById('a-desc').value.trim();

      if (!title || !subjectId || !type || !dueStr) {
        alertModal('Preencha todos os campos obrigatórios.');
        return;
      }

      // Validate file sizes (filter out nulls from removed items)
      const filesToUpload = pendingFiles.filter(Boolean);
      for (const f of filesToUpload) {
        if (f.size > MAX_FILE_SIZE_BYTES) {
          alertModal(`Arquivo "${f.name}" excede 10 MB.`);
          return;
        }
      }

      setModalLoading(true);

      try {
        const activityId = activity
          ? activity.id
          : doc(collection(db, 'activities')).id;

        // Upload new files
        const newAttachments = await Promise.all(
          filesToUpload.map(f => uploadFile(activityId, f))
        );

        // Build final attachments list
        let finalAttachments = [...(activity?.attachments ?? [])];

        // Remove deleted attachments
        for (const url of removedAttachUrls) {
          const path = urlToPath(url);
          if (path) {
            try { await deleteObject(ref(storage, path)); } catch { /* ignore */ }
          }
          finalAttachments = finalAttachments.filter(a => a.url !== url);
        }

        finalAttachments = [...finalAttachments, ...newAttachments];

        const data = {
          id:          activityId,
          subjectId,
          title,
          description: desc,
          type,
          dueDate:     Timestamp.fromDate(new Date(dueStr + 'T00:00:00')),
          archived:    activity?.archived ?? false,
          attachments: finalAttachments
        };

        if (activity) {
          await updateDoc(doc(db, 'activities', activityId), data);
          const idx = activities.findIndex(a => a.id === activityId);
          if (idx !== -1) activities[idx] = data;
        } else {
          await setDoc(doc(db, 'activities', activityId), data);
          activities.push(data);
        }

        closeModal();
        renderActivitiesTab();
      } catch (err) {
        console.error('saveActivity error:', err);
        alertModal('Erro ao salvar atividade. Tente novamente.');
        setModalLoading(false);
      }
    }
  );

  // File upload zone click
  document.getElementById('upload-zone').addEventListener('click', () =>
    document.getElementById('a-files').click()
  );
  document.getElementById('upload-zone').addEventListener('dragover', e => {
    e.preventDefault();
    e.currentTarget.style.background = '#ebebdf';
  });
  document.getElementById('upload-zone').addEventListener('dragleave', e => {
    e.currentTarget.style.background = '';
  });
  document.getElementById('upload-zone').addEventListener('drop', e => {
    e.preventDefault();
    e.currentTarget.style.background = '';
    addPendingFiles(Array.from(e.dataTransfer.files));
  });
  document.getElementById('a-files').addEventListener('change', (e) => {
    addPendingFiles(Array.from(e.target.files));
    e.target.value = '';
  });

  // Register the delegated remove listener on pending-files-list once here
  document.getElementById('pending-files-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-pending]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.removePending, 10);
    pendingFiles[idx] = null; // null = skip on upload
    btn.closest('li').remove();
  });

  // Remove existing attachments
  const existEl = document.getElementById('existing-attachments');
  if (existEl) {
    existEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove-attach]');
      if (!btn) return;
      const url = btn.dataset.removeAttach;
      removedAttachUrls.push(url);
      btn.closest('li').remove();
    });
  }
}

function addPendingFiles(files) {
  pendingFiles.push(...files);
  const list = document.getElementById('pending-files-list');
  files.forEach((f, idx) => {
    const li = document.createElement('li');
    li.dataset.pendingIdx = pendingFiles.length - files.length + idx;
    li.innerHTML = `<span>${esc(f.name)} (${formatSize(f.size)})</span>
      <button type="button" class="btn btn-small btn-danger"
              data-remove-pending="${pendingFiles.length - files.length + idx}">Remover</button>`;
    list.appendChild(li);
  });
}

async function uploadFile(activityId, file) {
  // Use a unique prefix to avoid overwriting objects with the same filename
  const uniquePrefix =
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const objectName = `${uniquePrefix}-${file.name}`;
  const storageRef = ref(storage, `activities/${activityId}/${objectName}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return { name: file.name, url, size: file.size };
}

function urlToPath(url) {
  // Firebase Storage download URL format:
  // https://firebasestorage.googleapis.com/v0/b/BUCKET/o/PATH%2FENCODED?alt=media&...
  const match = url.match(/\/o\/(.+?)(?:\?|$)/);
  if (!match) {
    console.warn('urlToPath: unexpected URL format, skipping Storage delete:', url);
    return null;
  }
  return decodeURIComponent(match[1]);
}

async function adminArchive(id) {
  if (!confirm('Arquivar esta atividade?')) return;
  try {
    await updateDoc(doc(db, 'activities', id), { archived: true });
    const a = activities.find(x => x.id === id);
    if (a) a.archived = true;
    renderActivitiesTab();
  } catch { alert('Erro ao arquivar.'); }
}

async function adminRestore(id) {
  try {
    await updateDoc(doc(db, 'activities', id), { archived: false });
    const a = activities.find(x => x.id === id);
    if (a) a.archived = false;
    renderActivitiesTab();
  } catch { alert('Erro ao restaurar.'); }
}

// ════════════════════════════════════════════════════════════════
// ENROLLMENTS TAB
// ════════════════════════════════════════════════════════════════
let selectedStudentUid = null;

function renderEnrollmentsTab() {
  const content = document.getElementById('tab-content');
  content.innerHTML = `
    <h2>Gerenciar Matrículas</h2>
    <p style="margin-bottom:1rem;font-size:0.82rem;color:var(--text-muted)">
      Selecione um estudante para editar suas matrículas.
    </p>
    <div class="enrollment-grid">
      <div>
        <h3>Estudantes</h3>
        <div class="enrollment-student-list" id="student-list"></div>
      </div>
      <div>
        <h3>Disciplinas matriculadas</h3>
        <div id="subject-checklist" class="enrollment-subject-list">
          <p style="color:var(--text-muted);font-size:0.82rem">
            Selecione um estudante.
          </p>
        </div>
      </div>
    </div>
  `;

  const studentList = document.getElementById('student-list');
  if (users.length === 0) {
    studentList.innerHTML =
      '<p style="padding:0.75rem;font-size:0.82rem;color:var(--text-muted)">Nenhum estudante cadastrado.</p>';
    return;
  }

  users.forEach(u => {
    const div = document.createElement('div');
    div.className = 'enrollment-student-item';
    div.dataset.uid = u.uid || u.id;
    div.textContent = u.username || u.name;
    if (div.dataset.uid === selectedStudentUid) div.classList.add('active');
    div.addEventListener('click', () => {
      document.querySelectorAll('.enrollment-student-item')
        .forEach(el => el.classList.remove('active'));
      div.classList.add('active');
      selectedStudentUid = div.dataset.uid;
      renderSubjectChecklist(selectedStudentUid);
    });
    studentList.appendChild(div);
  });

  if (selectedStudentUid) renderSubjectChecklist(selectedStudentUid);
}

function renderSubjectChecklist(studentUid) {
  const container = document.getElementById('subject-checklist');
  if (!container) return;

  if (subjects.length === 0) {
    container.innerHTML =
      '<p style="color:var(--text-muted);font-size:0.82rem">Nenhuma disciplina cadastrada.</p>';
    return;
  }

  const enrolledSubjectIds = new Set(
    enrollments
      .filter(e => e.studentUid === studentUid)
      .map(e => e.subjectId)
  );

  const WEEKDAY_ORDER = { SEG:0, TER:1, QUA:2, QUI:3, SEX:4, SAB:5 };
  const sorted = [...subjects].sort((a, b) => {
    const semA = parseInt(a.semester) || 0;
    const semB = parseInt(b.semester) || 0;
    if (semA !== semB) return semA - semB;
    const dayA = WEEKDAY_ORDER[a.weekday] ?? 99;
    const dayB = WEEKDAY_ORDER[b.weekday] ?? 99;
    if (dayA !== dayB) return dayA - dayB;
    return (a.horario_inicio || '').localeCompare(b.horario_inicio || '');
  });

  const WEEKDAY_ABBR = { SEG:'SEG', TER:'TER', QUA:'QUA', QUI:'QUI', SEX:'SEX', SAB:'SÁB' };
  container.innerHTML = '';
  let lastSemester = null;
  sorted.forEach(s => {
    const sem = s.semester || '—';
    if (sem !== lastSemester) {
      lastSemester = sem;
      const header = document.createElement('div');
      header.className = 'checklist-semester-header';
      const num = parseInt(sem);
      header.textContent = num ? `${num}º Semestre` : `Semestre ${sem}`;
      container.appendChild(header);
    }

    const item = document.createElement('div');
    item.className = 'enrollment-subject-item';

    const checkbox = document.createElement('input');
    checkbox.type    = 'checkbox';
    checkbox.id      = `enr-${s.id}`;
    checkbox.checked = enrolledSubjectIds.has(s.id);
    checkbox.addEventListener('change', () =>
      toggleEnrollment(studentUid, s.id, checkbox.checked, checkbox)
    );

    const label = document.createElement('label');
    label.htmlFor    = `enr-${s.id}`;
    label.textContent = `${WEEKDAY_ABBR[s.weekday] || s.weekday} | ${s.name} (${s.code})`;
    label.style.cursor = 'pointer';
    label.style.flex   = '1';

    item.appendChild(checkbox);
    item.appendChild(label);
    container.appendChild(item);
  });
}

async function toggleEnrollment(studentUid, subjectId, enroll, checkboxEl) {
  try {
    if (enroll) {
      const enrollmentId = `${studentUid}_${subjectId}`;
      await setDoc(doc(db, 'enrollments', enrollmentId), {
        id: enrollmentId,
        studentUid,
        subjectId
      });
      enrollments.push({ id: enrollmentId, studentUid, subjectId });
    } else {
      const existing = enrollments.find(
        e => e.studentUid === studentUid && e.subjectId === subjectId
      );
      if (existing) {
        await deleteDoc(doc(db, 'enrollments', existing.id));
        enrollments = enrollments.filter(e => e.id !== existing.id);
      }
    }
  } catch (err) {
    console.error('toggleEnrollment error:', err);
    alert('Erro ao atualizar matrícula.');
    if (checkboxEl) checkboxEl.checked = !enroll; // revert
  }
}

// ════════════════════════════════════════════════════════════════
// MODAL HELPERS
// ════════════════════════════════════════════════════════════════
function showModal(title, bodyHTML, onSave) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML    = bodyHTML;
  modalSaveCallback = onSave;
  setModalLoading(false);
  clearModalAlert();
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-body').innerHTML = '';
  modalSaveCallback  = null;
  pendingFiles       = [];
  removedAttachUrls  = [];
}

function setModalLoading(on) {
  const btn = document.getElementById('modal-save');
  btn.disabled    = on;
  btn.textContent = on ? 'Salvando...' : 'Salvar';
}

function alertModal(msg) {
  let alertEl = document.getElementById('modal-alert');
  if (!alertEl) {
    alertEl = document.createElement('div');
    alertEl.id = 'modal-alert';
    alertEl.className = 'alert alert-error';
    document.getElementById('modal-body').prepend(alertEl);
  }
  alertEl.textContent = msg;
  alertEl.classList.remove('hidden');
}

function clearModalAlert() {
  const el = document.getElementById('modal-alert');
  if (el) el.remove();
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

function formatSize(bytes) {
  if (!bytes) return '?';
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
