const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbycuN0qzDXNN9Q7rH3193CcsyUOblEqAtwyh9fHh-tcX0kB6eZXco-u1hP0Yf7sR3dL/exec';

const state = {
  isAdminLoggedIn: false,
  adminUsername: '',
  adminPassword: '',
  selectedAdmissionNumber: null,
  activeTab: 'students-tab',
  students: [],
  deletedRecords: [],
};

const registerForm = document.getElementById('student-form');
const registrationMessage = document.getElementById('registration-message');
const adminSection = document.getElementById('admin-section');
const adminContent = document.getElementById('admin-content');
const adminLoginBtn = document.getElementById('admin-login-btn');
const adminSearch = document.getElementById('admin-search');
const adminClassFilter = document.getElementById('admin-class-filter');
const studentsTableBody = document.getElementById('students-table-body');
const deletedTableBody = document.getElementById('deleted-table-body');
const dashboardStats = document.getElementById('dashboard-stats');
const deleteModal = document.getElementById('delete-modal');
const deleteConfirmationBody = document.getElementById('delete-confirmation-body');
const toast = document.getElementById('toast');

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  toast.classList.toggle('error', isError);
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

function setMessage(element, text, type = 'success') {
  element.textContent = text;
  element.className = `message ${type}`;
}

function setActiveTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll('.tab-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tabName);
  });
  document.getElementById('students-tab').classList.toggle('hidden', tabName !== 'students-tab');
  document.getElementById('deleted-tab').classList.toggle('hidden', tabName !== 'deleted-tab');
}

function getField(record, ...keys) {
  for (const key of keys) {
    if (record && record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }
  return '';
}

async function callAppsScript(action, payload = {}) {
  const formData = new URLSearchParams();
  formData.append('action', action);

  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  });

  const response = await fetch(APP_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: formData.toString(),
  });

  if (!response.ok) {
    throw new Error('Network error');
  }

  const rawText = await response.text();
  let data = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch (error) {
      data = { success: false, message: rawText };
    }
  }

  if (!data || (data.success === false && data.ok !== true)) {
    throw new Error(data && (data.message || data.error || 'API failure'));
  }

  return data;
}

async function loginAdmin() {
  const username = document.getElementById('admin-username').value.trim();
  const password = document.getElementById('admin-password').value.trim();

  try {
    const result = await callAppsScript('adminLogin', { username, password });
    state.isAdminLoggedIn = true;
    state.adminUsername = result.username || username;
    state.adminPassword = password;
    adminContent.classList.remove('hidden');
    showToast('Admin login successful.');
    loadDashboard();
  } catch (error) {
    state.isAdminLoggedIn = false;
    state.adminUsername = '';
    state.adminPassword = '';
    showToast(error.message || 'Unable to login.', true);
  }
}

async function loadDashboard() {
  if (!state.isAdminLoggedIn) return;

  try {
    const result = await callAppsScript('getAdminDashboard', {
      username: state.adminUsername,
      password: state.adminPassword,
      search: adminSearch.value.trim(),
      classFilter: adminClassFilter.value,
    });
    state.students = result.students || [];
    state.deletedRecords = result.deletedRecords || [];
    renderDashboardStats(result.stats || {});
    renderStudentsTable();
    renderDeletedRecordsTable();
  } catch (error) {
    showToast(error.message || 'Unable to load dashboard.', true);
  }
}

function renderDashboardStats(stats) {
  const totalRegistered = stats.totalRegistered || 0;
  const classStats = [
    ['JSS1Q', stats.jss1q || 0],
    ['JSS1S', stats.jss1s || 0],
    ['JSS1I', stats.jss1i || 0],
    ['JSS1Y', stats.jss1y || 0],
    ['JSS1N', stats.jss1n || 0],
  ];

  dashboardStats.innerHTML = `
    <div class="stat-box"><strong>TOTAL REGISTERED STUDENTS</strong><div>${totalRegistered}</div></div>
    ${classStats.map(([label, count]) => `
      <div class="stat-box"><strong>${label}</strong><div>${count}</div></div>
    `).join('')}
  `;
}

function renderStudentsTable() {
  studentsTableBody.innerHTML = '';
  if (!state.students.length) {
    studentsTableBody.innerHTML = '<tr><td colspan="6">No students found.</td></tr>';
    return;
  }

  state.students.forEach((student) => {
    const admissionNumber = getField(student, 'Admission Number', 'admissionNumber');
    const studentName = getField(student, 'Student Full Name', 'studentFullName');
    const assignedClass = getField(student, 'Assigned Class', 'assignedClass');
    const parentName = getField(student, 'Parent/Guardian Name', 'parentGuardianName', 'Parent Guardian Name');
    const parentPhone = getField(student, 'Parent/Guardian Phone', 'parentGuardianPhone', 'Parent Guardian Phone');

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${admissionNumber}</td>
      <td>${studentName}</td>
      <td>${assignedClass}</td>
      <td>${parentName}</td>
      <td>${parentPhone}</td>
      <td>
        <button class="action-btn view" data-action="view" data-admission="${admissionNumber}">VIEW</button>
        <button class="action-btn print" data-action="print" data-admission="${admissionNumber}">PRINT</button>
        <button class="action-btn delete" data-action="delete" data-admission="${admissionNumber}">DELETE</button>
      </td>
    `;
    studentsTableBody.appendChild(row);
  });
}

function renderDeletedRecordsTable() {
  deletedTableBody.innerHTML = '';
  if (!state.deletedRecords.length) {
    deletedTableBody.innerHTML = '<tr><td colspan="7">No deleted records found.</td></tr>';
    return;
  }

  state.deletedRecords.forEach((record) => {
    const admissionNumber = getField(record, 'Admission Number', 'admissionNumber');
    const studentName = getField(record, 'Student Full Name', 'studentFullName');
    const assignedClass = getField(record, 'Assigned Class', 'assignedClass');
    const originalRegistrationDate = getField(record, 'Original Registration Date', 'originalRegistrationDate');
    const deletedDate = getField(record, 'Deleted Date', 'deletedDate');
    const deletedBy = getField(record, 'Deleted By', 'deletedBy');

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${admissionNumber}</td>
      <td>${studentName}</td>
      <td>${assignedClass}</td>
      <td>${originalRegistrationDate}</td>
      <td>${deletedDate}</td>
      <td>${deletedBy}</td>
      <td>
        <button class="action-btn view" data-action="view-deleted" data-admission="${admissionNumber}">VIEW</button>
      </td>
    `;
    deletedTableBody.appendChild(row);
  });
}

function openDeleteModal(student) {
  const admissionNumber = getField(student, 'Admission Number', 'admissionNumber');
  const studentName = getField(student, 'Student Full Name', 'studentFullName');
  const assignedClass = getField(student, 'Assigned Class', 'assignedClass');

  state.selectedAdmissionNumber = admissionNumber;
  deleteConfirmationBody.innerHTML = `
    <p><strong>Admission Number:</strong> ${admissionNumber}</p>
    <p><strong>Student:</strong> ${studentName}</p>
    <p><strong>Assigned Class:</strong> ${assignedClass}</p>
    <p>Are you sure you want to delete this registration?</p>
  `;
  deleteModal.classList.remove('hidden');
}

async function confirmDeleteStudent() {
  if (!state.selectedAdmissionNumber) return;

  try {
    const result = await callAppsScript('deleteStudentRegistration', {
      username: state.adminUsername,
      password: state.adminPassword,
      admissionNumber: state.selectedAdmissionNumber,
      deletedBy: state.adminUsername,
    });
    deleteModal.classList.add('hidden');
    state.selectedAdmissionNumber = null;
    showToast(result.message || 'Student registration deleted successfully.');
    loadDashboard();
  } catch (error) {
    showToast(error.message || 'Unable to delete registration. Please try again.', true);
  }
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function exportStudentData(type = 'students') {
  if (!state.isAdminLoggedIn) {
    showToast('Please log into the admin panel first.', true);
    return;
  }

  const rows = type === 'deleted' ? state.deletedRecords : state.students;
  if (!rows.length) {
    showToast('No records available to export.', true);
    return;
  }

  const headers = type === 'deleted'
    ? ['Admission Number', 'Student Full Name', 'Assigned Class', 'Original Registration Date', 'Deleted Date', 'Deleted By']
    : ['Admission Number', 'Student Full Name', 'Assigned Class', 'Parent/Guardian Name', 'Parent/Guardian Phone'];

  const csvRows = [headers, ...rows.map((row) => [
    row['Admission Number'] || row.admissionNumber || '',
    row['Student Full Name'] || row.studentFullName || '',
    row['Assigned Class'] || row.assignedClass || '',
    row['Original Registration Date'] || row.originalRegistrationDate || '',
    row['Deleted Date'] || row.deletedDate || '',
    row['Deleted By'] || row.deletedBy || '',
  ])];

  downloadCsv(type === 'deleted' ? 'deleted-records.csv' : 'active-students.csv', csvRows);
}

async function handleActionClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const action = button.dataset.action;
  const admissionNumber = button.dataset.admission;

  if (action === 'view') {
    const student = state.students.find((item) => {
      const value = getField(item, 'Admission Number', 'admissionNumber');
      return value === admissionNumber;
    });
    if (student) {
      alert(JSON.stringify(student, null, 2));
    }
  }

  if (action === 'view-deleted') {
    const record = state.deletedRecords.find((item) => {
      const value = getField(item, 'Admission Number', 'admissionNumber');
      return value === admissionNumber;
    });
    if (record) {
      alert(JSON.stringify(record, null, 2));
    }
  }

  if (action === 'print') {
    window.print();
  }

  if (action === 'delete') {
    const student = state.students.find((item) => {
      const value = getField(item, 'Admission Number', 'admissionNumber');
      return value === admissionNumber;
    });
    if (student) {
      openDeleteModal(student);
    }
  }
}

document.getElementById('show-registration-btn').addEventListener('click', () => {
  document.getElementById('registration-section').classList.remove('hidden');
  document.getElementById('admin-section').classList.add('hidden');
});

document.getElementById('show-admin-btn').addEventListener('click', () => {
  document.getElementById('registration-section').classList.add('hidden');
  document.getElementById('admin-section').classList.remove('hidden');
  if (state.isAdminLoggedIn) loadDashboard();
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(registerForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const result = await callAppsScript('registerStudent', payload);
    setMessage(registrationMessage, result.message || 'Registration successful.', 'success');
    registerForm.reset();
  } catch (error) {
    setMessage(registrationMessage, error.message || 'Registration failed.', 'error');
  }
});

adminLoginBtn.addEventListener('click', loginAdmin);
adminSearch.addEventListener('input', () => loadDashboard());
adminClassFilter.addEventListener('change', () => loadDashboard());
document.getElementById('export-students-btn').addEventListener('click', () => exportStudentData('students'));
document.getElementById('export-deleted-btn').addEventListener('click', () => exportStudentData('deleted'));

document.addEventListener('click', (event) => {
  const actionButton = event.target.closest('[data-action]');
  if (actionButton) handleActionClick(event);
  if (event.target.id === 'cancel-delete-btn') {
    deleteModal.classList.add('hidden');
    state.selectedAdmissionNumber = null;
  }
  if (event.target.id === 'confirm-delete-btn') {
    confirmDeleteStudent();
  }
});

setActiveTab('students-tab');
renderDashboardStats({ totalRegistered: 0, jss1q: 0, jss1s: 0, jss1i: 0, jss1y: 0, jss1n: 0 });
