// Browser LocalStorage Data Store — Sir Hamza Bull Trader Academy
// 100% Static Client-Side Persistence (No server or external sync)

const STORAGE_KEY = 'shbta_academy_data_v1';
const STUDENT_SESSION_KEY = 'shbta_student_session_id';

function createDefaultState() {
  return {
    version: 2,
    settings: {
      academyName: 'Sir Hamza Bull Trader Academy',
      tagline: 'Institutional Price Action, Liquidity Structure & Capital Preservation',
      whatsapp: '0325 6000474',
      email: 'sirhamzawebsite@gmail.com',
      address: 'Executive Trading Floor, Gulberg III, Lahore, Pakistan',
      officeHours: 'Monday – Saturday, 10:00 AM – 8:00 PM PKT',
      adminName: 'Sir Hamza',
      adminTitle: 'Lead Mentor & Academy Director',
      paymentAccounts: {
        'Bank Transfer (Meezan Bank)': 'Meezan Bank · Account Title: Hamza Trading Academy · IBAN: PK36MEZN0002810104829104',
        JazzCash: 'JazzCash Merchant · Title: Sir Hamza Academy · Number: 0325 6000474',
        EasyPaisa: 'EasyPaisa Account · Title: Sir Hamza Academy · Number: 0325 6000474',
        'SadaPay / NayaPay': 'SadaPay Wallet · Title: Sir Hamza Academy · Number: 0325 6000474',
      },
    },
    courses: [
      {
        id: 'CRS-101',
        name: 'Price Action & Market Structure Mastery',
        level: 'Foundation to Pro',
        duration: '8 Weeks · Live + Recorded',
        fee: 25000,
        description:
          'Master pure naked-chart market structure, multi-timeframe alignment, high-probability supply and demand zones, and disciplined trade execution.',
      },
      {
        id: 'CRS-102',
        name: 'Smart Money & Liquidity Execution',
        level: 'Intermediate',
        duration: '10 Weeks · Live Floor',
        fee: 38000,
        description:
          'Decode institutional order blocks, liquidity sweeps, fair value gaps, and session kill-zone entries across Forex, Gold (XAUUSD), and Indices.',
      },
      {
        id: 'CRS-103',
        name: 'Gold (XAUUSD) & Forex Intraday Desk',
        level: 'Advanced Desk',
        duration: '6 Weeks · Daily Live Desk',
        fee: 45000,
        description:
          'Live London and New York session execution on XAUUSD and major FX pairs with strict position sizing, drawdown rules, and trade journaling.',
      },
      {
        id: 'CRS-104',
        name: 'Prop Firm & Funded Account Blueprint',
        level: 'Evaluation Prep',
        duration: '6 Weeks · Mentorship',
        fee: 32000,
        description:
          'Structured challenge passing framework covering daily loss caps, trailing drawdown protection, risk-of-ruin math, and payout consistency.',
      },
    ],
    batches: [
      {
        id: 'BAT-2026-A',
        name: 'Batch 14 — Morning Executive',
        courseId: 'CRS-101',
        schedule: 'Mon, Wed, Fri · 11:00 AM – 1:00 PM PKT',
        startDate: '2026-12-07',
        capacity: 30,
        available: true,
      },
      {
        id: 'BAT-2026-B',
        name: 'Batch 15 — Evening Market Floor',
        courseId: 'CRS-102',
        schedule: 'Tue, Thu, Sat · 7:30 PM – 9:30 PM PKT',
        startDate: '2026-12-10',
        capacity: 25,
        available: true,
      },
      {
        id: 'BAT-2026-C',
        name: 'Batch 16 — NY Session Live Desk',
        courseId: 'CRS-103',
        schedule: 'Mon – Fri · 6:00 PM – 8:00 PM PKT',
        startDate: '2026-12-14',
        capacity: 20,
        available: true,
      },
      {
        id: 'BAT-2026-D',
        name: 'Batch 17 — Weekend Funded Prep',
        courseId: 'CRS-104',
        schedule: 'Sat & Sun · 3:00 PM – 5:30 PM PKT',
        startDate: '2026-12-19',
        capacity: 35,
        available: true,
      },
    ],
    students: [],
    logs: [],
  };
}

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createDefaultState();
      saveData(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.students)) {
      const fallback = createDefaultState();
      saveData(fallback);
      return fallback;
    }
    let changed = false;
    if (parsed.settings && ('adminUsername' in parsed.settings || 'adminPassword' in parsed.settings)) {
      delete parsed.settings.adminUsername;
      delete parsed.settings.adminPassword;
      changed = true;
    }
    if (parsed.version !== 2) {
      const demoIds = new Set(['SHBTA-2026-1001', 'SHBTA-2026-1002', 'SHBTA-2026-1003']);
      parsed.students = parsed.students.filter(
        (s) => !demoIds.has(s.id) && !String(s.email || '').toLowerCase().endsWith('@example.com')
      );
      parsed.logs = Array.isArray(parsed.logs)
        ? parsed.logs.filter((l) => l.category !== 'Initialization')
        : [];
      parsed.version = 2;
      changed = true;
    }
    if (changed) {
      saveData(parsed);
    }
    return parsed;
  } catch {
    const fallback = createDefaultState();
    saveData(fallback);
    return fallback;
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error('LocalStorage save error:', err);
    return false;
  }
}

export function addActivityLog(category, description, actor = 'Admin') {
  const data = loadData();
  data.logs.unshift({
    id: 'LOG-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    timestamp: new Date().toISOString(),
    actor,
    category,
    description,
  });
  if (data.logs.length > 250) {
    data.logs = data.logs.slice(0, 250);
  }
  saveData(data);
}

export function generateUniqueStudentId(existingStudents = null) {
  const students = existingStudents || loadData().students;
  const year = new Date().getFullYear();
  let candidate = '';
  let attempts = 0;
  do {
    const rand = Math.floor(1000 + Math.random() * 9000);
    candidate = `SHBTA-${year}-${rand}`;
    attempts++;
  } while (students.some((s) => s.id.toUpperCase() === candidate.toUpperCase()) && attempts < 100);
  return candidate;
}

export function findStudentById(studentId) {
  const clean = String(studentId || '').trim().toUpperCase();
  if (!clean) return null;
  const data = loadData();
  return data.students.find((s) => String(s.id).toUpperCase() === clean) || null;
}

export function submitAdmissionApplication(payload) {
  const data = loadData();
  const studentId = generateUniqueStudentId(data.students);
  const now = new Date().toISOString();

  const record = {
    id: studentId,
    fullName: (payload.fullName || '').trim(),
    fatherName: (payload.fatherName || '').trim(),
    dateOfBirth: (payload.dateOfBirth || '').trim(),
    phone: (payload.phone || '').trim(),
    whatsapp: (payload.whatsapp || payload.phone || '').trim(),
    email: (payload.email || '').trim(),
    city: (payload.city || '').trim(),
    country: (payload.country || 'Pakistan').trim(),
    address: (payload.address || '').trim(),
    profilePhoto: payload.profilePhoto || '',
    courseId: payload.courseId,
    courseName: payload.courseName,
    courseFee: Number(payload.courseFee) || 0,
    batchId: payload.batchId,
    batchName: payload.batchName,
    batchSchedule: payload.batchSchedule || '',
    paymentMethod: payload.paymentMethod,
    transactionId: (payload.transactionId || '').trim(),
    paymentScreenshot: payload.paymentScreenshot || '',
    experienceLevel: payload.experienceLevel || 'Not Specified',
    learningGoals: (payload.learningGoals || payload.studentAgreement || '').trim(),
    studentAgreement: (payload.studentAgreement || '').trim(),
    agreedTerms: Boolean(payload.agreedTerms),
    acceptedFullName: (payload.acceptedFullName || payload.fullName || '').trim(),
    acceptanceTimestamp: payload.acceptanceTimestamp || now,
    disclaimerVersion: payload.disclaimerVersion || 'v1.0',
    signatureDataUrl: payload.signatureDataUrl || '',
    signatureStrokes: payload.signatureStrokes || [],
    admissionStatus: 'Pending Review',
    paymentStatus: payload.paymentStatus || 'Pending Verification',
    createdAt: now,
    updatedAt: now,
  };

  data.students.unshift(record);
  data.logs.unshift({
    id: 'LOG-' + Date.now(),
    timestamp: now,
    actor: record.fullName,
    category: 'Admission Submitted',
    description: `New admission submitted by ${record.fullName} (${record.id}) for ${record.courseName}.`,
  });

  const saved = saveData(data);
  if (!saved) {
    throw new Error('Browser storage limit reached. Try uploading smaller images.');
  }
  return record;
}

export function updateStudentRecord(studentId, patch, logDesc = null) {
  const data = loadData();
  const idx = data.students.findIndex((s) => s.id === studentId);
  if (idx === -1) return null;
  data.students[idx] = {
    ...data.students[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  if (logDesc) {
    data.logs.unshift({
      id: 'LOG-' + Date.now(),
      timestamp: new Date().toISOString(),
      actor: data.settings.adminName || 'Admin',
      category: 'Student Update',
      description: logDesc,
    });
  }
  saveData(data);
  return data.students[idx];
}

export function deleteStudentRecord(studentId) {
  const data = loadData();
  const target = data.students.find((s) => s.id === studentId);
  if (!target) return false;
  data.students = data.students.filter((s) => s.id !== studentId);
  data.logs.unshift({
    id: 'LOG-' + Date.now(),
    timestamp: new Date().toISOString(),
    actor: data.settings.adminName || 'Admin',
    category: 'Student Deleted',
    description: `Deleted student record ${target.fullName} (${target.id}).`,
  });
  saveData(data);
  return true;
}

export function upsertCourse(course) {
  const data = loadData();
  const idx = data.courses.findIndex((c) => c.id === course.id);
  const now = new Date().toISOString();
  if (idx >= 0) {
    data.courses[idx] = { ...data.courses[idx], ...course };
    data.logs.unshift({
      id: 'LOG-' + Date.now(),
      timestamp: now,
      actor: data.settings.adminName || 'Admin',
      category: 'Course Updated',
      description: `Updated course "${course.name}" (Fee: PKR ${Number(course.fee).toLocaleString()}).`,
    });
  } else {
    const newId = course.id || 'CRS-' + Math.floor(100 + Math.random() * 900);
    data.courses.push({ ...course, id: newId });
    data.logs.unshift({
      id: 'LOG-' + Date.now(),
      timestamp: now,
      actor: data.settings.adminName || 'Admin',
      category: 'Course Created',
      description: `Added new course "${course.name}" (Fee: PKR ${Number(course.fee).toLocaleString()}).`,
    });
  }
  saveData(data);
  return data.courses;
}

export function deleteCourse(courseId) {
  const data = loadData();
  const target = data.courses.find((c) => c.id === courseId);
  if (!target) return false;
  data.courses = data.courses.filter((c) => c.id !== courseId);
  data.logs.unshift({
    id: 'LOG-' + Date.now(),
    timestamp: new Date().toISOString(),
    actor: data.settings.adminName || 'Admin',
    category: 'Course Deleted',
    description: `Removed course "${target.name}" (${target.id}).`,
  });
  saveData(data);
  return true;
}

export function upsertBatch(batch) {
  const data = loadData();
  const idx = data.batches.findIndex((b) => b.id === batch.id);
  const now = new Date().toISOString();
  if (idx >= 0) {
    data.batches[idx] = { ...data.batches[idx], ...batch };
    data.logs.unshift({
      id: 'LOG-' + Date.now(),
      timestamp: now,
      actor: data.settings.adminName || 'Admin',
      category: 'Batch Updated',
      description: `Updated batch "${batch.name}" (${batch.available ? 'Open' : 'Closed'}).`,
    });
  } else {
    const newId = batch.id || 'BAT-' + new Date().getFullYear() + '-' + Math.floor(10 + Math.random() * 89);
    data.batches.push({ ...batch, id: newId });
    data.logs.unshift({
      id: 'LOG-' + Date.now(),
      timestamp: now,
      actor: data.settings.adminName || 'Admin',
      category: 'Batch Created',
      description: `Created batch "${batch.name}" (${batch.schedule}).`,
    });
  }
  saveData(data);
  return data.batches;
}

export function deleteBatch(batchId) {
  const data = loadData();
  const target = data.batches.find((b) => b.id === batchId);
  if (!target) return false;
  data.batches = data.batches.filter((b) => b.id !== batchId);
  data.logs.unshift({
    id: 'LOG-' + Date.now(),
    timestamp: new Date().toISOString(),
    actor: data.settings.adminName || 'Admin',
    category: 'Batch Deleted',
    description: `Deleted batch "${target.name}" (${target.id}).`,
  });
  saveData(data);
  return true;
}

export function updateSettings(patch, logDescription = 'Updated academy settings.') {
  const data = loadData();
  data.settings = { ...data.settings, ...patch };
  data.logs.unshift({
    id: 'LOG-' + Date.now(),
    timestamp: new Date().toISOString(),
    actor: data.settings.adminName || 'Admin',
    category: 'Settings Updated',
    description: logDescription,
  });
  saveData(data);
  return data.settings;
}

export function clearActivityLogs() {
  const data = loadData();
  data.logs = [
    {
      id: 'LOG-' + Date.now(),
      timestamp: new Date().toISOString(),
      actor: data.settings.adminName || 'Admin',
      category: 'Logs Cleared',
      description: 'Previous activity logs were cleared by administrator.',
    },
  ];
  saveData(data);
}

export function exportAcademyBackup() {
  const data = loadData();
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'Sir Hamza Bull Trader Academy',
    data,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shbta-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  addActivityLog('Backup Exported', 'Exported complete academy JSON backup.');
}

export function importAcademyBackup(jsonText) {
  const parsed = JSON.parse(jsonText);
  const incoming = parsed?.data && parsed.data.students ? parsed.data : parsed;
  if (
    !incoming ||
    !Array.isArray(incoming.students) ||
    !Array.isArray(incoming.courses) ||
    !Array.isArray(incoming.batches) ||
    !incoming.settings
  ) {
    throw new Error('Invalid backup structure. Please select a valid SHBTA backup JSON file.');
  }
  if (!Array.isArray(incoming.logs)) incoming.logs = [];
  incoming.logs.unshift({
    id: 'LOG-' + Date.now(),
    timestamp: new Date().toISOString(),
    actor: incoming.settings.adminName || 'Admin',
    category: 'Backup Imported',
    description: `Restored ${incoming.students.length} student(s), ${incoming.courses.length} course(s), and ${incoming.batches.length} batch(es) from JSON backup.`,
  });
  saveData(incoming);
  return incoming;
}

export function resetWorkspaceData() {
  const existing = loadData();
  const clean = {
    version: 2,
    settings: existing.settings || createDefaultState().settings,
    courses: existing.courses || createDefaultState().courses,
    batches: existing.batches || createDefaultState().batches,
    students: [],
    logs: [],
  };
  saveData(clean);
  localStorage.removeItem(STUDENT_SESSION_KEY);
  return clean;
}

export function resetDemoData() {
  return resetWorkspaceData();
}

// Session helpers (localStorage/sessionStorage only)
export function getStudentSessionId() {
  return localStorage.getItem(STUDENT_SESSION_KEY) || '';
}

export function setStudentSessionId(id) {
  if (id) {
    localStorage.setItem(STUDENT_SESSION_KEY, String(id).trim().toUpperCase());
  } else {
    localStorage.removeItem(STUDENT_SESSION_KEY);
  }
}
