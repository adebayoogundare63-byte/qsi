const STUDENTS_SHEET_NAME = 'Students';
const SETTINGS_SHEET_NAME = 'Settings';
const DELETED_RECORDS_SHEET_NAME = 'Deleted Records';
const CLASS_SEQUENCE = ['JSS1Q', 'JSS1S', 'JSS1I', 'JSS1Y', 'JSS1N'];
const STARTING_ADMISSION_NUMBER = 5300;
const STUDENT_HEADERS = [
  'Admission Number',
  'Student Full Name',
  'Date of Birth',
  'Home Address',
  'Local Government of Origin',
  'State of Origin',
  'Parent/Guardian Name',
  'Parent/Guardian Phone',
  'Last School Attended',
  'Last Class Attended',
  'Religion',
  'Assigned Class',
  'Original Registration Date',
  'Original Registration Time',
  'Status'
];
const DELETED_RECORD_HEADERS = [
  'Admission Number',
  'Student Full Name',
  'Date of Birth',
  'Home Address',
  'Local Government of Origin',
  'State of Origin',
  'Parent/Guardian Name',
  'Parent/Guardian Phone',
  'Last School Attended',
  'Last Class Attended',
  'Religion',
  'Assigned Class',
  'Original Registration Date',
  'Original Registration Time',
  'Deleted Date',
  'Deleted Time',
  'Deleted By'
];

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    message: 'School registration backend is ready.'
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    let payload = {};

    if (e && e.parameter && Object.keys(e.parameter).length > 0) {
      payload = Object.fromEntries(Object.entries(e.parameter).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
    } else if (typeof e.postData !== 'undefined' && e.postData && e.postData.contents) {
      const raw = e.postData.contents;
      try {
        payload = JSON.parse(raw);
      } catch (jsonError) {
        payload = {};
      }
    }

    const action = payload.action || '';
    const result = handleAction(action, payload);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    const message = error && error.message ? error.message : 'Unable to process request. Please try again.';
    console.error('doPost error: ' + (error && error.stack ? error.stack : error));
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: message,
      debug: error && error.stack ? error.stack : String(error)
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function handleAction(action, payload) {
  switch (action) {
    case 'registerStudent':
      return registerStudent(payload);
    case 'adminLogin':
      return adminLogin(payload);
    case 'getAdminDashboard':
      return getAdminDashboard(payload);
    case 'deleteStudentRegistration':
      return deleteStudentRegistration(payload);
    default:
      return { success: false, message: 'Invalid action.' };
  }
}

function initializeProject() {
  ensureSheets();
  ensureSettings();
}

function ensureSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  const studentsSheet = spreadsheet.getSheetByName(STUDENTS_SHEET_NAME) || spreadsheet.insertSheet(STUDENTS_SHEET_NAME);
  const settingsSheet = spreadsheet.getSheetByName(SETTINGS_SHEET_NAME) || spreadsheet.insertSheet(SETTINGS_SHEET_NAME);
  const deletedSheet = spreadsheet.getSheetByName(DELETED_RECORDS_SHEET_NAME) || spreadsheet.insertSheet(DELETED_RECORDS_SHEET_NAME);

  ensureHeaderRow(studentsSheet, STUDENT_HEADERS);
  ensureHeaderRow(settingsSheet, ['Setting', 'Value']);
  ensureHeaderRow(deletedSheet, DELETED_RECORD_HEADERS);
}

function ensureHeaderRow(sheet, headers) {
  const currentHeaders = sheet.getDataRange().getValues();
  if (!currentHeaders.length || !currentHeaders[0] || currentHeaders[0].length === 0) {
    sheet.appendRow(headers);
    return;
  }

  const firstRow = currentHeaders[0];
  for (let i = 0; i < headers.length; i += 1) {
    if (firstRow[i] !== headers[i]) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      break;
    }
  }
}

function ensureSettings() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_SHEET_NAME);
  if (!sheet) return;

  const allSettings = getSettingsMap();
  if (!allSettings['Next Admission Number']) {
    setSetting('Next Admission Number', String(STARTING_ADMISSION_NUMBER));
  }
  if (!allSettings['Next Class Index']) {
    setSetting('Next Class Index', '0');
  }
}

function getSettingsMap() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_SHEET_NAME);
  if (!sheet) return {};

  const values = sheet.getDataRange().getValues();
  const settingsMap = {};
  for (let i = 1; i < values.length; i += 1) {
    const row = values[i];
    if (row && row[0]) {
      settingsMap[String(row[0]).trim()] = row[1] !== undefined ? String(row[1]).trim() : '';
    }
  }
  return settingsMap;
}

function setSetting(key, value) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_SHEET_NAME);
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  let existingRowIndex = -1;
  for (let i = 1; i < data.length; i += 1) {
    if (data[i][0] === key) {
      existingRowIndex = i + 1;
      break;
    }
  }

  if (existingRowIndex > 0) {
    sheet.getRange(existingRowIndex, 1, 1, 2).setValues([[key, value]]);
  } else {
    sheet.appendRow([key, value]);
  }
}

function getSettingValue(name, fallback) {
  const settings = getSettingsMap();
  return settings[name] !== undefined ? settings[name] : fallback;
}

function getClassByIndex(index) {
  return CLASS_SEQUENCE[index % CLASS_SEQUENCE.length];
}

function sanitizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/\s+/g, ' ');
}

function sanitizeAdmissionNumber(value) {
  const sanitized = sanitizeText(value);
  return sanitized.replace(/[^A-Za-z0-9/\-]/g, '');
}

function validateRegistrationPayload(payload) {
  const requiredFields = [
    'studentFullName',
    'dateOfBirth',
    'homeAddress',
    'localGovernment',
    'stateOfOrigin',
    'parentName',
    'parentPhone',
    'religion'
  ];

  for (let i = 0; i < requiredFields.length; i += 1) {
    if (!sanitizeText(payload[requiredFields[i]])) {
      throw new Error('Please complete all required registration fields.');
    }
  }

  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(sanitizeText(payload.dateOfBirth))) {
    throw new Error('Invalid date of birth.');
  }

  if (!/^[0-9+()\-\s]{7,20}$/.test(sanitizeText(payload.parentPhone))) {
    throw new Error('Invalid parent or guardian phone number.');
  }
}

function generateRegistrationRecord(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const settings = getSettingsMap();
    const nextAdmissionNumber = Number(settings['Next Admission Number'] || STARTING_ADMISSION_NUMBER);
    const nextClassIndex = Number(settings['Next Class Index'] || 0);
    const admissionNumber = 'QSI/' + new Date().getFullYear() + '/' + nextAdmissionNumber;
    const assignedClass = getClassByIndex(nextClassIndex);

    setSetting('Next Admission Number', String(nextAdmissionNumber + 1));
    setSetting('Next Class Index', String(nextClassIndex + 1));

    const now = new Date();
    const registrationDate = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const registrationTime = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss');

    return {
      admissionNumber: admissionNumber,
      assignedClass: assignedClass,
      registrationDate: registrationDate,
      registrationTime: registrationTime,
      data: [
        admissionNumber,
        sanitizeText(payload.studentFullName),
        sanitizeText(payload.dateOfBirth),
        sanitizeText(payload.homeAddress),
        sanitizeText(payload.localGovernment),
        sanitizeText(payload.stateOfOrigin),
        sanitizeText(payload.parentName),
        sanitizeText(payload.parentPhone),
        sanitizeText(payload.lastSchool || ''),
        sanitizeText(payload.lastClass || ''),
        sanitizeText(payload.religion),
        assignedClass,
        registrationDate,
        registrationTime,
        'Active'
      ]
    };
  } finally {
    lock.releaseLock();
  }
}

function registerStudent(payload) {
  try {
    initializeProject();
    validateRegistrationPayload(payload || {});

    const studentRecord = generateRegistrationRecord(payload);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STUDENTS_SHEET_NAME);
    sheet.appendRow(studentRecord.data);

    return {
      success: true,
      message: 'Student registration successful.',
      admissionNumber: studentRecord.admissionNumber,
      assignedClass: studentRecord.assignedClass
    };
  } catch (error) {
    console.error('registerStudent error: ' + error && error.stack ? error.stack : error);
    throw new Error(error && error.message ? error.message : 'Unable to register student. Please try again.');
  }
}

function getStudentRecords() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STUDENTS_SHEET_NAME);
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i += 1) {
    const row = values[i];
    if (!row || row.length === 0 || !row[0]) continue;
    const record = {};
    for (let j = 0; j < headers.length; j += 1) {
      record[headers[j]] = row[j] !== undefined ? row[j] : '';
    }
    rows.push(record);
  }
  return rows;
}

function getDeletedRecords() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DELETED_RECORDS_SHEET_NAME);
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i += 1) {
    const row = values[i];
    if (!row || row.length === 0 || !row[0]) continue;
    const record = {};
    for (let j = 0; j < headers.length; j += 1) {
      record[headers[j]] = row[j] !== undefined ? row[j] : '';
    }
    rows.push(record);
  }
  return rows;
}

function adminLogin(payload) {
  const username = sanitizeText(payload && (payload.username || payload.adminUsername));
  const password = sanitizeText(payload && (payload.password || payload.adminPassword));
  const storedUsername = sanitizeText(PropertiesService.getScriptProperties().getProperty('ADMIN_USERNAME'));
  const storedPassword = sanitizeText(PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD'));

  if (!storedUsername || !storedPassword) {
    return { success: false, message: 'Admin authentication is not configured.' };
  }

  if (username === storedUsername && password === storedPassword) {
    return {
      success: true,
      message: 'Admin login successful.',
      username: username
    };
  }

  return { success: false, message: 'Invalid admin credentials.' };
}

function requireAdmin(payload) {
  const username = sanitizeText(payload && (payload.username || payload.adminUsername));
  const password = sanitizeText(payload && (payload.password || payload.adminPassword));
  if (!username || !password) {
    throw new Error('Unauthorized admin access.');
  }

  const result = adminLogin({ username: username, password: password });
  if (!result.success) {
    throw new Error('Unauthorized admin access.');
  }
  return result.username;
}

function getAdminDashboard(payload) {
  const username = sanitizeText(payload && (payload.username || payload.adminUsername || ''));
  const password = sanitizeText(payload && (payload.password || payload.adminPassword || ''));
  if (!username && !password) {
    throw new Error('Unauthorized admin access.');
  }
  requireAdmin({ username: username, password: password });

  const searchText = sanitizeText(payload && payload.search || '');
  const classFilter = sanitizeText(payload && payload.classFilter || '');
  const allStudents = getStudentRecords();
  const deletedRecords = getDeletedRecords();

  const filteredStudents = allStudents.filter((student) => {
    const matchesSearch = !searchText || [
      student['Admission Number'],
      student['Student Full Name'],
      student['Parent/Guardian Name'],
      student['Parent/Guardian Phone']
    ].join(' ').toLowerCase().includes(searchText.toLowerCase());

    const matchesClass = !classFilter || student['Assigned Class'] === classFilter;
    return matchesSearch && matchesClass;
  });

  const stats = {
    totalRegistered: allStudents.length,
    jss1q: allStudents.filter((student) => student['Assigned Class'] === 'JSS1Q').length,
    jss1s: allStudents.filter((student) => student['Assigned Class'] === 'JSS1S').length,
    jss1i: allStudents.filter((student) => student['Assigned Class'] === 'JSS1I').length,
    jss1y: allStudents.filter((student) => student['Assigned Class'] === 'JSS1Y').length,
    jss1n: allStudents.filter((student) => student['Assigned Class'] === 'JSS1N').length
  };

  return {
    success: true,
    message: 'Dashboard loaded.',
    students: filteredStudents,
    deletedRecords: deletedRecords,
    stats: stats
  };
}

function findStudentByAdmissionNumber(admissionNumber) {
  const studentsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STUDENTS_SHEET_NAME);
  if (!studentsSheet) return null;

  const values = studentsSheet.getDataRange().getValues();
  if (values.length <= 1) return null;

  const headers = values[0];
  const target = sanitizeAdmissionNumber(admissionNumber);
  for (let i = 1; i < values.length; i += 1) {
    const row = values[i];
    if (!row || row.length === 0 || !row[0]) continue;
    const candidate = sanitizeAdmissionNumber(row[0]);
    if (candidate === target) {
      const record = {};
      for (let j = 0; j < headers.length; j += 1) {
        record[headers[j]] = row[j] !== undefined ? row[j] : '';
      }
      return { rowIndex: i + 1, record: record };
    }
  }
  return null;
}

function deleteStudentRegistration(payload) {
  const admissionNumber = sanitizeAdmissionNumber(payload && payload.admissionNumber || '');
  const deletedBy = sanitizeText(payload && payload.deletedBy || '');

  if (!admissionNumber) {
    throw new Error('Invalid admission number.');
  }

  const username = sanitizeText(payload && (payload.username || payload.adminUsername || ''));
  const password = sanitizeText(payload && (payload.password || payload.adminPassword || ''));
  if (!username && !password) {
    throw new Error('Unauthorized admin access.');
  }

  requireAdmin({ username: username, password: password });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const found = findStudentByAdmissionNumber(admissionNumber);
    if (!found) {
      throw new Error('Student not found.');
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STUDENTS_SHEET_NAME);
    const deletedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DELETED_RECORDS_SHEET_NAME);
    if (!sheet || !deletedSheet) {
      throw new Error('Google Sheets is unavailable.');
    }

    const now = new Date();
    const deletedDate = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const deletedTime = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss');

    const deletedRecord = [
      found.record['Admission Number'] || '',
      found.record['Student Full Name'] || '',
      found.record['Date of Birth'] || '',
      found.record['Home Address'] || '',
      found.record['Local Government of Origin'] || '',
      found.record['State of Origin'] || '',
      found.record['Parent/Guardian Name'] || '',
      found.record['Parent/Guardian Phone'] || '',
      found.record['Last School Attended'] || '',
      found.record['Last Class Attended'] || '',
      found.record['Religion'] || '',
      found.record['Assigned Class'] || '',
      found.record['Original Registration Date'] || '',
      found.record['Original Registration Time'] || '',
      deletedDate,
      deletedTime,
      deletedBy || 'Administrator'
    ];

    deletedSheet.appendRow(deletedRecord);
    sheet.deleteRow(found.rowIndex);

    return {
      success: true,
      message: 'Student registration deleted successfully.'
    };
  } catch (error) {
    console.error('deleteStudentRegistration error: ' + error && error.stack ? error.stack : error);
    throw new Error(error && error.message ? error.message : 'Unable to delete registration. Please try again.');
  } finally {
    lock.releaseLock();
  }
}

function getCurrentUser() {
  return Session.getActiveUser() ? Session.getActiveUser().getEmail() : 'System';
}

function ensureAdminCredentials() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ADMIN_USERNAME')) {
    props.setProperty('ADMIN_USERNAME', 'admin');
  }
  if (!props.getProperty('ADMIN_PASSWORD')) {
    props.setProperty('ADMIN_PASSWORD', 'admin123');
  }
}

function setAdminCredentials(username, password) {
  const props = PropertiesService.getScriptProperties();
  if (sanitizeText(username)) {
    props.setProperty('ADMIN_USERNAME', sanitizeText(username));
  }
  if (sanitizeText(password)) {
    props.setProperty('ADMIN_PASSWORD', sanitizeText(password));
  }
}

function getAllSettingsForScriptDebug() {
  return JSON.stringify(getSettingsMap());
}

ensureAdminCredentials();
initializeProject();
