const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwhQkfkpX0V1Ch3i8kzupxUculNJ9SiF4DG3rpCe0TaBMaiEnIDVKv4gbv8DEhyTn5qDA/exec';

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

function formatDateOnly(value) {
  if (!value) return '';

  const asString = String(value).trim();
  if (!asString) return '';

  const isoDateMatch = asString.match(/^\d{4}-\d{2}-\d{2}T/);
  if (isoDateMatch) {
    const parsedDate = new Date(asString);
    if (!Number.isNaN(parsedDate.getTime())) {
      const year = parsedDate.getFullYear();
      const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const day = String(parsedDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  const dateMatch = asString.match(/\d{4}-\d{2}-\d{2}/);
  if (dateMatch) {
    return dateMatch[0];
  }

  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return asString.split('T')[0] || asString.split(' ')[0] || asString;
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
    document.querySelector('.admin-login-box').classList.add('hidden');
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

function logoutAdmin() {
  state.isAdminLoggedIn = false;
  state.adminUsername = '';
  state.adminPassword = '';
  document.querySelector('.admin-login-box').classList.remove('hidden');
  adminContent.classList.add('hidden');
  document.getElementById('admin-username').value = '';
  document.getElementById('admin-password').value = '';
  showToast('Logged out successfully.');
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
        <button class="action-btn print" data-action="print-deleted" data-admission="${admissionNumber}">PRINT</button>
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

function openPrintModal(student, isDeleted = false, options = {}) {
  const printContent = document.getElementById('print-content');
  const printModal = document.getElementById('print-modal');
  const showPrintActions = options.showPrintActions !== false;
  
  const studentName = getField(student, 'Student Full Name', 'studentFullName');
  const admissionNumber = getField(student, 'Admission Number', 'admissionNumber');
  
  const fields = isDeleted
    ? [
        { label: 'Admission Number', keys: ['Admission Number', 'admissionNumber'] },
        { label: 'Student Full Name', keys: ['Student Full Name', 'studentFullName'] },
        { label: 'Date of Birth', keys: ['Date of Birth', 'dateOfBirth'] },
        { label: 'Home Address', keys: ['Home Address', 'homeAddress'] },
        { label: 'Local Government of Origin', keys: ['Local Government of Origin', 'localGovernment'] },
        { label: 'State of Origin', keys: ['State of Origin', 'stateOfOrigin'] },
        { label: 'Parent/Guardian Name', keys: ['Parent/Guardian Name', 'parentName', 'parentGuardianName'] },
        { label: 'Parent/Guardian Phone', keys: ['Parent/Guardian Phone', 'parentPhone', 'parentGuardianPhone'] },
        { label: 'Last School Attended', keys: ['Last School Attended', 'lastSchool'] },
        { label: 'Last Class Attended', keys: ['Last Class Attended', 'lastClass'] },
        { label: 'Religion', keys: ['Religion', 'religion'] },
        { label: 'Assigned Class', keys: ['Assigned Class', 'assignedClass'] },
        { label: 'Deleted Date', keys: ['Deleted Date', 'deletedDate'] },
        { label: 'Deleted By', keys: ['Deleted By', 'deletedBy'] },
      ]
    : [
        { label: 'Admission Number', keys: ['Admission Number', 'admissionNumber'] },
        { label: 'Student Full Name', keys: ['Student Full Name', 'studentFullName'] },
        { label: 'Date of Birth', keys: ['Date of Birth', 'dateOfBirth'] },
        { label: 'Home Address', keys: ['Home Address', 'homeAddress'] },
        { label: 'Local Government of Origin', keys: ['Local Government of Origin', 'localGovernment'] },
        { label: 'State of Origin', keys: ['State of Origin', 'stateOfOrigin'] },
        { label: 'Parent/Guardian Name', keys: ['Parent/Guardian Name', 'parentName', 'parentGuardianName'] },
        { label: 'Parent/Guardian Phone', keys: ['Parent/Guardian Phone', 'parentPhone', 'parentGuardianPhone'] },
        { label: 'Last School Attended', keys: ['Last School Attended', 'lastSchool'] },
        { label: 'Last Class Attended', keys: ['Last Class Attended', 'lastClass'] },
        { label: 'Religion', keys: ['Religion', 'religion'] },
        { label: 'Assigned Class', keys: ['Assigned Class', 'assignedClass'] },
      ];

  let html = `
    <div class="print-header">
      <div class="print-header-top">
        <img src="oyo-state-logo.png.jpg" alt="Oyo State Logo" class="header-logo">
        <div class="print-header-text">
          <h2>STUDENT REGISTRATION SLIP</h2>
          <p>Queen's School (Junior) Ibadan</p>
        </div>
        <img src="queens-school-logo.png" alt="Queen's School Logo" class="header-logo">
      </div>
    </div>
    <div class="print-details">
  `;

  fields.forEach((field) => {
    let value = getField(student, ...field.keys);

    if (field.label === 'Date of Birth' && value) {
      value = formatDateOnly(value);
    }

    html += `
      <div class="print-row">
        <div class="print-label">${field.label}</div>
        <div class="print-value">${value || 'N/A'}</div>
      </div>
    `;
  });

  html += `
    </div>
  `;

  printContent.innerHTML = html;
  const printActions = document.querySelector('.print-actions');
  if (printActions) {
    printActions.style.display = showPrintActions ? 'flex' : 'none';
  }
  printModal.classList.remove('hidden');
}

function openViewModal(student, isDeleted = false) {
  openPrintModal(student, isDeleted, { showPrintActions: false });
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
      openViewModal(student);
    }
  }

  if (action === 'view-deleted') {
    const record = state.deletedRecords.find((item) => {
      const value = getField(item, 'Admission Number', 'admissionNumber');
      return value === admissionNumber;
    });
    if (record) {
      openViewModal(record, true);
    }
  }

  if (action === 'print') {
    const student = state.students.find((item) => {
      const value = getField(item, 'Admission Number', 'admissionNumber');
      return value === admissionNumber;
    });
    if (student) {
      openPrintModal(student);
    }
  }

  if (action === 'print-deleted') {
    const record = state.deletedRecords.find((item) => {
      const value = getField(item, 'Admission Number', 'admissionNumber');
      return value === admissionNumber;
    });
    if (record) {
      openPrintModal(record, true);
    }
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

if (document.getElementById('show-registration-btn')) {
  document.getElementById('show-registration-btn').addEventListener('click', () => {
    document.getElementById('registration-section').classList.remove('hidden');
    document.getElementById('admin-section').classList.add('hidden');
  });
}

if (document.getElementById('show-admin-btn')) {
  document.getElementById('show-admin-btn').addEventListener('click', () => {
    document.getElementById('registration-section').classList.add('hidden');
    document.getElementById('admin-section').classList.remove('hidden');
    if (state.isAdminLoggedIn) loadDashboard();
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(registerForm);
    const payload = Object.fromEntries(formData.entries());
    const studentName = payload.studentFullName;

    try {
      const result = await callAppsScript('registerStudent', payload);
      
      const feedbackName = document.getElementById('feedback-name');
      const feedbackAdmission = document.getElementById('feedback-admission');
      const feedbackClass = document.getElementById('feedback-class');
      if (feedbackName) feedbackName.textContent = studentName;
      if (feedbackAdmission) feedbackAdmission.textContent = result.admissionNumber || 'N/A';
      if (feedbackClass) feedbackClass.textContent = result.assignedClass || 'N/A';
      
      const registrationMessageEl = document.getElementById('registration-message');
      const registrationFeedbackEl = document.getElementById('registration-feedback');
      if (registrationMessageEl) registrationMessageEl.classList.add('hidden');
      if (registrationFeedbackEl) registrationFeedbackEl.classList.remove('hidden');
      
      registerForm.reset();
    } catch (error) {
      setMessage(registrationMessage, error.message || 'Registration failed.', 'error');
      const registrationFeedbackEl = document.getElementById('registration-feedback');
      if (registrationFeedbackEl) registrationFeedbackEl.classList.add('hidden');
    }
  });
}

if (adminLoginBtn) adminLoginBtn.addEventListener('click', loginAdmin);
if (adminSearch) adminSearch.addEventListener('input', () => loadDashboard());
if (adminClassFilter) adminClassFilter.addEventListener('change', () => loadDashboard());
if (document.getElementById('logout-admin-btn')) {
  document.getElementById('logout-admin-btn').addEventListener('click', logoutAdmin);
}

if (document.getElementById('register-another-btn')) {
  document.getElementById('register-another-btn').addEventListener('click', () => {
    const registrationFeedbackEl = document.getElementById('registration-feedback');
    const registrationMessageEl = document.getElementById('registration-message');
    if (registrationFeedbackEl) registrationFeedbackEl.classList.add('hidden');
    if (registrationMessageEl) registrationMessageEl.classList.remove('hidden');
    if (registerForm) registerForm.reset();
    if (registerForm) registerForm.scrollIntoView({ behavior: 'smooth' });
  });
}

if (document.getElementById('export-students-btn')) {
  document.getElementById('export-students-btn').addEventListener('click', () => exportStudentData('students'));
}
if (document.getElementById('export-deleted-btn')) {
  document.getElementById('export-deleted-btn').addEventListener('click', () => exportStudentData('deleted'));
}
if (document.getElementById('cancel-delete-btn')) {
  document.getElementById('cancel-delete-btn').addEventListener('click', () => {
    deleteModal.classList.add('hidden');
    state.selectedAdmissionNumber = null;
  });
}
if (document.getElementById('confirm-delete-btn')) {
  document.getElementById('confirm-delete-btn').addEventListener('click', confirmDeleteStudent);
}

document.querySelectorAll('.tab-btn').forEach((button) => {
  button.addEventListener('click', () => {
    setActiveTab(button.dataset.tab);
  });
});

document.addEventListener('click', (event) => {
  const actionButton = event.target.closest('[data-action]');
  if (actionButton) handleActionClick(event);
  
  // Delete modal handlers
  // Print modal handlers
  if (event.target.id === 'close-print-btn' || event.target.id === 'close-print-modal-btn') {
    document.getElementById('print-modal').classList.add('hidden');
  }
  if (event.target.id === 'print-now-btn') {
    const printContent = document.getElementById('print-content').innerHTML;
    const printWindow = window.open('', '', 'width=900,height=700');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Student Registration Slip</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background: white;
          }
          .print-header {
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #1a3d7a;
          }
          .print-header-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 15px;
          }
          .header-logo {
            width: 80px;
            height: 80px;
            object-fit: contain;
          }
          .print-header-text {
            flex: 1;
            text-align: center;
          }
          .print-header-text h2 {
            margin: 0 0 8px 0;
            color: #1a3d7a;
            font-size: 1.5rem;
          }
          .print-header-text p {
            margin: 0;
            color: #586274;
            font-size: 0.95rem;
          }
          .print-details {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
            gap: 0;
          }
          .print-row {
            display: flex;
            padding: 12px 0;
            border-bottom: 1px solid #eee;
          }
          .print-label {
            font-weight: 600;
            color: #12305d;
            min-width: 45%;
            padding-right: 12px;
          }
          .print-value {
            flex: 1;
            color: #333;
            word-break: break-word;
          }
        </style>
      </head>
      <body>
        ${printContent}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }
});

setActiveTab('students-tab');
renderDashboardStats({ totalRegistered: 0, jss1q: 0, jss1s: 0, jss1i: 0, jss1y: 0, jss1n: 0 });
