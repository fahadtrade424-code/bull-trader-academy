// Complete 8-Section Admin Panel — Backend-Authenticated Console
import {
  loadData,
  updateStudentRecord,
  deleteStudentRecord,
  generateUniqueStudentId,
  upsertCourse,
  deleteCourse,
  upsertBatch,
  deleteBatch,
  updateSettings,
  clearActivityLogs,
  exportAcademyBackup,
  importAcademyBackup,
  resetDemoData,
  addActivityLog,
} from '../store.js';
import {
  esc,
  formatPKR,
  formatDate,
  formatDateTime,
  renderStatusLabel,
  openModal,
  closeModal,
  showConfirmModal,
  showToast,
} from '../utils.js';
import { downloadAdmissionSlipPDF } from '../pdf.js';

const SECTIONS = [
  { id: 'dashboard', label: 'Executive Dashboard' },
  { id: 'students', label: 'Students Management' },
  { id: 'batches', label: 'Batch Management' },
  { id: 'courses', label: 'Course Management' },
  { id: 'payments', label: 'Payment Verification' },
  { id: 'student-ids', label: 'Student ID Management' },
  { id: 'logs', label: 'Activity Logs' },
  { id: 'settings', label: 'Admin Settings' },
];

// In-memory admin session state only (never stored in localStorage/sessionStorage)
let adminToken = '';
let adminEmail = '';

async function apiFetch(url, options = {}) {
  const { skipAuthReset = false, headers = {}, body, ...rest } = options;
  const reqHeaders = { ...headers };
  if (body !== undefined && !reqHeaders['Content-Type']) {
    reqHeaders['Content-Type'] = 'application/json';
  }
  if (adminToken) {
    reqHeaders.Authorization = `Bearer ${adminToken}`;
  }

  const res = await fetch(url, {
    ...rest,
    headers: reqHeaders,
    body: body !== undefined && typeof body !== 'string' ? JSON.stringify(body) : body,
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (res.status === 401 && !skipAuthReset) {
    adminToken = '';
    adminEmail = '';
  }

  return { ok: res.ok, status: res.status, data };
}

function wirePasswordToggles(rootEl) {
  rootEl.querySelectorAll('[data-toggle-password]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-toggle-password');
      const input = rootEl.querySelector(`#${targetId}`);
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
      btn.setAttribute('aria-pressed', String(show));
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  });
}

function renderPasswordField(id, label, placeholder, autocomplete = 'current-password', extraClass = '') {
  return `
    <div class="form-field">
      <label class="form-label" for="${esc(id)}">${esc(label)}</label>
      <div class="password-input-wrap">
        <input
          id="${esc(id)}"
          class="form-input ${extraClass}"
          type="password"
          placeholder="${esc(placeholder)}"
          autocomplete="${esc(autocomplete)}"
          required
        />
        <button
          type="button"
          class="password-toggle-btn"
          data-toggle-password="${esc(id)}"
          aria-pressed="false"
          aria-label="Show password"
        >Show</button>
      </div>
    </div>
  `;
}

function renderChangePasswordFormHtml(prefix) {
  return `
    <form id="${esc(prefix)}-password-form" class="form-grid" novalidate>
      ${renderPasswordField(`${prefix}-old-pass`, 'Old Password', 'Enter current admin password', 'current-password')}
      <div class="form-field" style="display:flex;justify-content:flex-end;">
        <span class="field-hint">Use at least 8 characters with letters, numbers, or symbols.</span>
      </div>
      ${renderPasswordField(`${prefix}-new-pass`, 'New Password', 'Enter new password (min 8 chars)', 'new-password')}
      ${renderPasswordField(`${prefix}-confirm-pass`, 'Confirm New Password', 'Re-enter new password', 'new-password')}
      <div class="form-field full-span">
        <div id="${esc(prefix)}-pass-feedback" class="field-error" style="min-height:1.2em;"></div>
      </div>
      <div class="form-field full-span">
        <button type="submit" id="${esc(prefix)}-pass-submit" class="btn btn-gold" style="align-self:flex-start;">
          Update Password
        </button>
      </div>
    </form>
  `;
}

export function renderAdminPage(container, { resetToken = '' } = {}) {
  let activeSection = 'dashboard';
  let studentSearch = '';
  let studentFilter = 'All';
  let paymentFilter = 'All';
  let logFilter = 'All';

  let authView = resetToken ? 'reset' : 'login';
  let loginEmail = '';
  let loginError = '';
  let loginNotice = '';
  let loginBusy = false;

  let forgotEmail = '';
  let forgotError = '';
  let forgotSuccess = '';
  let forgotBusy = false;

  let activeResetToken = resetToken || '';
  let resetStatus = resetToken ? 'verifying' : 'invalid'; // 'verifying' | 'valid' | 'invalid'
  let resetVerifiedEmail = '';
  let resetError = '';
  let resetBusy = false;

  async function verifyResetTokenFlow(token) {
    resetStatus = 'verifying';
    resetError = '';
    renderAuthGate();
    try {
      const res = await apiFetch(`/api/admin/verify-reset-token?token=${encodeURIComponent(token)}`, {
        method: 'GET',
        skipAuthReset: true,
      });
      if (res.ok && res.data?.valid) {
        resetStatus = 'valid';
        resetVerifiedEmail = res.data.email || '';
      } else {
        resetStatus = 'invalid';
        resetError = res.data?.error || 'This password reset link is invalid or has expired.';
      }
    } catch {
      resetStatus = 'invalid';
      resetError = 'Unable to verify reset link with the server. Please try again.';
    }
    renderAuthGate();
  }

  function renderAuthGate() {
    if (authView === 'forgot') {
      container.innerHTML = `
        <section class="page-shell">
          <div class="container" style="max-width:540px;">
            <div class="page-header">
              <div class="section-kicker">Admin Account Recovery</div>
              <h1 class="section-title">Forgot Password</h1>
              <p class="section-subtitle">
                Request a secure password reset link for the registered academy administrator email.
              </p>
            </div>

            <div class="panel panel-gold">
              <form id="admin-forgot-form" style="display:flex;flex-direction:column;gap:16px;" novalidate>
                <div class="form-field">
                  <label class="form-label" for="forgot-email">Registered Admin Email Address</label>
                  <input
                    id="forgot-email"
                    class="form-input ${forgotError ? 'is-invalid' : ''}"
                    type="email"
                    value="${esc(forgotEmail)}"
                    placeholder="Enter registered admin email"
                    autocomplete="email"
                    required
                  />
                  <div class="field-error">${esc(forgotError)}</div>
                </div>

                ${
                  forgotSuccess
                    ? `<div class="notice-box" style="border-color:rgba(52,211,153,0.45);background:rgba(52,211,153,0.08);color:#a7f3d0;">${esc(forgotSuccess)}</div>`
                    : ''
                }

                <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;justify-content:space-between;">
                  <button type="submit" class="btn btn-gold" ${forgotBusy ? 'disabled' : ''}>
                    ${forgotBusy ? 'Sending Reset Link...' : 'Send Reset Link'}
                  </button>
                  <button type="button" id="back-to-login-btn" class="admin-link-btn">Back to Admin Login</button>
                </div>
              </form>
            </div>
          </div>
        </section>
      `;

      container.querySelector('#back-to-login-btn')?.addEventListener('click', () => {
        forgotError = '';
        forgotSuccess = '';
        authView = 'login';
        renderAuthGate();
      });

      container.querySelector('#admin-forgot-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = container.querySelector('#forgot-email')?.value.trim() || '';
        forgotEmail = email;
        forgotError = '';
        forgotSuccess = '';

        if (!email) {
          forgotError = 'Please enter the registered admin email address.';
          renderAuthGate();
          return;
        }

        forgotBusy = true;
        renderAuthGate();
        try {
          const res = await apiFetch('/api/admin/forgot-password', {
            method: 'POST',
            body: { email },
            skipAuthReset: true,
          });
          if (res.ok) {
            forgotSuccess = res.data.message || 'Password reset link sent to your email.';
            showToast('Reset link email dispatched.', 'success');
          } else {
            forgotError = res.data?.error || 'Could not process password recovery request.';
          }
        } catch {
          forgotError = 'Network error while contacting the authentication server.';
        } finally {
          forgotBusy = false;
          renderAuthGate();
        }
      });
      return;
    }

    if (authView === 'reset') {
      let bodyHtml = '';
      if (resetStatus === 'verifying') {
        bodyHtml = `
          <div style="padding:12px 0;color:var(--text-secondary);">
            Verifying your password reset link...
          </div>
        `;
      } else if (resetStatus === 'invalid') {
        bodyHtml = `
          <div style="display:flex;flex-direction:column;gap:16px;">
            <div class="notice-box" style="border-color:rgba(239,68,68,0.45);background:rgba(239,68,68,0.08);color:#fca5a5;">
              ${esc(resetError || 'This password reset link is invalid or has expired.')}
            </div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;">
              <button type="button" id="reset-request-new-btn" class="btn btn-gold btn-sm">Request New Reset Link</button>
              <button type="button" id="reset-back-login-btn" class="btn btn-ghost btn-sm">Back to Login</button>
            </div>
          </div>
        `;
      } else {
        bodyHtml = `
          <form id="admin-reset-form" style="display:flex;flex-direction:column;gap:16px;" novalidate>
            <div class="notice-box" style="padding:12px 14px;">
              Resetting password for verified admin account: <strong>${esc(resetVerifiedEmail)}</strong>
            </div>
            ${renderPasswordField('reset-new-pass', 'New Password', 'Enter new password (min 8 characters)', 'new-password')}
            ${renderPasswordField('reset-confirm-pass', 'Confirm New Password', 'Confirm new password', 'new-password')}
            <div class="field-error">${esc(resetError)}</div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between;">
              <button type="submit" class="btn btn-gold" ${resetBusy ? 'disabled' : ''}>
                ${resetBusy ? 'Updating Password...' : 'Set New Password'}
              </button>
              <button type="button" id="reset-back-login-btn" class="admin-link-btn">Back to Login</button>
            </div>
          </form>
        `;
      }

      container.innerHTML = `
        <section class="page-shell">
          <div class="container" style="max-width:540px;">
            <div class="page-header">
              <div class="section-kicker">Secure Password Recovery</div>
              <h1 class="section-title">Set New Admin Password</h1>
              <p class="section-subtitle">
                Verify your reset token and choose a strong new password for the Admin Panel.
              </p>
            </div>
            <div class="panel panel-gold">
              ${bodyHtml}
            </div>
          </div>
        </section>
      `;

      wirePasswordToggles(container);

      container.querySelector('#reset-request-new-btn')?.addEventListener('click', () => {
        activeResetToken = '';
        if (window.location.hash.includes('resetToken=')) {
          window.history.replaceState(null, '', '#admin');
        }
        authView = 'forgot';
        renderAuthGate();
      });

      container.querySelector('#reset-back-login-btn')?.addEventListener('click', () => {
        activeResetToken = '';
        if (window.location.hash.includes('resetToken=')) {
          window.history.replaceState(null, '', '#admin');
        }
        authView = 'login';
        renderAuthGate();
      });

      container.querySelector('#admin-reset-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = container.querySelector('#reset-new-pass')?.value || '';
        const confirmNewPassword = container.querySelector('#reset-confirm-pass')?.value || '';
        resetError = '';

        if (newPassword.length < 8) {
          resetError = 'Password must be at least 8 characters long.';
          renderAuthGate();
          return;
        }
        if (newPassword !== confirmNewPassword) {
          resetError = 'New password and confirmation do not match.';
          renderAuthGate();
          return;
        }

        resetBusy = true;
        renderAuthGate();
        try {
          const res = await apiFetch('/api/admin/reset-password', {
            method: 'POST',
            body: { token: activeResetToken, newPassword, confirmNewPassword },
            skipAuthReset: true,
          });
          if (res.ok) {
            activeResetToken = '';
            if (window.location.hash.includes('resetToken=')) {
              window.history.replaceState(null, '', '#admin');
            }
            loginNotice = res.data.message || 'Password reset successfully. Please log in.';
            loginError = '';
            authView = 'login';
            showToast('Admin password has been reset.', 'success');
          } else {
            resetError = res.data?.error || 'Could not reset password.';
          }
        } catch {
          resetError = 'Network error while resetting password.';
        } finally {
          resetBusy = false;
          renderAuthGate();
        }
      });
      return;
    }

    container.innerHTML = `
      <section class="page-shell">
        <div class="container" style="max-width:540px;">
          <div class="page-header">
            <div class="section-kicker">Academy Console</div>
            <h1 class="section-title">Admin Panel Sign In</h1>
            <p class="section-subtitle">
              Sign in with your administrator email and password to manage admissions, courses, payments, and student records.
            </p>
          </div>

          ${
            loginNotice
              ? `<div class="notice-box" style="margin-bottom:20px;border-color:rgba(52,211,153,0.45);background:rgba(52,211,153,0.08);color:#a7f3d0;">${esc(loginNotice)}</div>`
              : ''
          }

          <div class="panel panel-gold">
            <form id="admin-login-form" style="display:flex;flex-direction:column;gap:16px;" novalidate>
              <div class="form-field">
                <label class="form-label" for="admin-email">Email Address</label>
                <input
                  id="admin-email"
                  class="form-input ${loginError ? 'is-invalid' : ''}"
                  type="email"
                  value="${esc(loginEmail)}"
                  placeholder="Enter admin email address"
                  autocomplete="email"
                  required
                />
              </div>

              <div class="form-field">
                <label class="form-label" for="admin-pass">Password</label>
                <div class="password-input-wrap">
                  <input
                    id="admin-pass"
                    class="form-input ${loginError ? 'is-invalid' : ''}"
                    type="password"
                    placeholder="Enter admin password"
                    autocomplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    class="password-toggle-btn"
                    data-toggle-password="admin-pass"
                    aria-pressed="false"
                    aria-label="Show password"
                  >Show</button>
                </div>
                <div class="field-error">${esc(loginError)}</div>
              </div>

              <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;justify-content:space-between;">
                <button type="submit" class="btn btn-gold" ${loginBusy ? 'disabled' : ''}>
                  ${loginBusy ? 'Signing In...' : 'Login'}
                </button>
                <button type="button" id="forgot-password-link" class="admin-link-btn">
                  Forgot Password?
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    `;

    wirePasswordToggles(container);

    container.querySelector('#forgot-password-link')?.addEventListener('click', () => {
      loginError = '';
      loginNotice = '';
      forgotError = '';
      forgotSuccess = '';
      authView = 'forgot';
      renderAuthGate();
    });

    container.querySelector('#admin-login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = container.querySelector('#admin-email')?.value.trim() || '';
      const password = container.querySelector('#admin-pass')?.value || '';
      loginEmail = email;
      loginError = '';
      loginNotice = '';

      if (!email || !password) {
        loginError = 'Email address and password are required.';
        renderAuthGate();
        return;
      }

      loginBusy = true;
      renderAuthGate();
      try {
        const res = await apiFetch('/api/admin/login', {
          method: 'POST',
          body: { email, password },
          skipAuthReset: true,
        });
        if (res.ok && res.data?.token) {
          adminToken = res.data.token;
          adminEmail = res.data.email || email;
          loginError = '';
          const data = loadData();
          addActivityLog('Admin Login', `Signed in to Admin Panel (${adminEmail}).`, data.settings.adminName || 'Admin');
          showToast('Signed in to Admin Panel.', 'success');
          render();
          return;
        }
        loginError = res.data?.error || 'Invalid admin email or password.';
      } catch {
        loginError = 'Authentication server is unavailable. Please try again.';
      } finally {
        loginBusy = false;
        if (!adminToken) renderAuthGate();
      }
    });
  }

  function openStudentDetailModal(student) {
    const data = loadData();
    const safePhoto =
      typeof student.profilePhoto === 'string' && student.profilePhoto.startsWith('data:image/')
        ? student.profilePhoto
        : '';
    const safeReceipt =
      typeof student.paymentScreenshot === 'string' && student.paymentScreenshot.startsWith('data:image/')
        ? student.paymentScreenshot
        : '';
    const safeSignature =
      typeof student.signatureDataUrl === 'string' && student.signatureDataUrl.startsWith('data:image/')
        ? student.signatureDataUrl
        : '';
    openModal({
      title: `Student Record — ${student.id}`,
      bodyHtml: `
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:18px;flex-wrap:wrap;">
          ${
            safePhoto
              ? `<img src="${esc(safePhoto)}" alt="${esc(student.fullName)}" style="width:72px;height:72px;border-radius:8px;object-fit:cover;border:1px solid var(--border-gold);" />`
              : ''
          }
          <div>
            <div style="font-size:1.15rem;font-weight:700;color:var(--text-primary);">${esc(student.fullName)}</div>
            <div style="font-size:0.86rem;color:var(--text-secondary);">S/O ${esc(student.fatherName)} · ${esc(student.city)}</div>
            <div style="margin-top:6px;display:flex;gap:14px;flex-wrap:wrap;">
              ${renderStatusLabel(student.admissionStatus)}
              ${renderStatusLabel(student.paymentStatus)}
            </div>
          </div>
        </div>

        <div class="summary-grid" style="margin-bottom:18px;">
          <div class="summary-row"><div class="summary-key">Date of Birth</div><div class="summary-val font-mono">${esc(student.dateOfBirth ? formatDate(student.dateOfBirth) : '—')}</div></div>
          <div class="summary-row"><div class="summary-key">Phone / WhatsApp</div><div class="summary-val font-mono">${esc(student.phone)} / ${esc(student.whatsapp)}</div></div>
          <div class="summary-row"><div class="summary-key">Email</div><div class="summary-val">${esc(student.email)}</div></div>
          <div class="summary-row"><div class="summary-key">Address</div><div class="summary-val">${esc(student.address)}</div></div>
          <div class="summary-row"><div class="summary-key">Course</div><div class="summary-val">${esc(student.courseName)}${Number(student.courseFee) > 0 ? ` (${esc(formatPKR(student.courseFee))})` : ''}</div></div>
          <div class="summary-row"><div class="summary-key">Batch</div><div class="summary-val">${esc(student.batchName || '—')}</div></div>
          <div class="summary-row"><div class="summary-key">Payment &amp; Tx ID</div><div class="summary-val">${esc(student.paymentMethod)} · <span class="font-mono">${esc(student.transactionId)}</span></div></div>
          <div class="summary-row"><div class="summary-key">Submitted</div><div class="summary-val">${esc(formatDateTime(student.createdAt))}</div></div>
          <div class="summary-row"><div class="summary-key">Declaration Accepted</div><div class="summary-val">${student.agreedTerms ? '<span class="status-text status-approved">Yes — Accepted</span>' : '<span class="status-text status-rejected">Not Accepted</span>'}</div></div>
          <div class="summary-row"><div class="summary-key">Accepted Full Name</div><div class="summary-val">${esc(student.acceptedFullName || student.fullName)}</div></div>
          <div class="summary-row"><div class="summary-key">Date &amp; Time of Acceptance</div><div class="summary-val font-mono">${esc(student.acceptanceTimestamp ? formatDateTime(student.acceptanceTimestamp) : formatDateTime(student.createdAt))}</div></div>
          <div class="summary-row"><div class="summary-key">Disclaimer Version Accepted</div><div class="summary-val font-mono">${esc(student.disclaimerVersion || 'v1.0')}</div></div>
          <div class="summary-row" style="grid-column:1 / -1;">
            <div class="summary-key">Student Written Agreement</div>
            <div class="summary-val" style="white-space:pre-wrap;padding:10px 12px;border-radius:6px;background:#090b10;border:1px solid var(--border-subtle);margin-top:4px;">${esc(student.studentAgreement || student.learningGoals || '—')}</div>
          </div>
        </div>

        ${
          safeReceipt
            ? `<div style="margin-bottom:16px;"><div class="summary-key" style="margin-bottom:6px;">Payment Screenshot</div><img src="${esc(safeReceipt)}" alt="Payment receipt" style="max-height:240px;border-radius:8px;border:1px solid var(--border-gold);" /></div>`
            : ''
        }
        ${
          safeSignature
            ? `<div><div class="summary-key" style="margin-bottom:6px;">Electronic Signature</div><img src="${esc(safeSignature)}" alt="Student signature" style="max-height:110px;background:#fbfaf6;border-radius:6px;border:1px solid var(--border-subtle);" /></div>`
            : `<div style="font-size:0.84rem;color:var(--text-muted);">Electronic Signature: Not provided</div>`
        }
      `,
      footerHtml: `
        <button type="button" class="btn btn-outline btn-sm" id="modal-pdf-btn">Download PDF Slip</button>
        <button type="button" class="btn btn-success btn-sm" id="modal-approve-btn">Approve Admission</button>
        <button type="button" class="btn btn-danger btn-sm" id="modal-reject-btn">Reject</button>
      `,
      onMount(root) {
        root.querySelector('#modal-pdf-btn')?.addEventListener('click', () => {
          downloadAdmissionSlipPDF(student, data.settings);
        });
        root.querySelector('#modal-approve-btn')?.addEventListener('click', () => {
          updateStudentRecord(
            student.id,
            { admissionStatus: 'Approved' },
            `Approved admission for ${student.fullName} (${student.id}).`
          );
          closeModal();
          showToast(`Approved ${student.fullName}.`, 'success');
          render();
        });
        root.querySelector('#modal-reject-btn')?.addEventListener('click', () => {
          updateStudentRecord(
            student.id,
            { admissionStatus: 'Rejected' },
            `Rejected admission for ${student.fullName} (${student.id}).`
          );
          closeModal();
          showToast(`Rejected ${student.fullName}.`);
          render();
        });
      },
    });
  }

  function openEditStudentModal(student) {
    const data = loadData();
    openModal({
      title: `Edit Student — ${student.id}`,
      bodyHtml: `
        <form id="edit-student-form" class="form-grid">
          <div class="form-field">
            <label class="form-label">Full Name</label>
            <input id="es-name" class="form-input" value="${esc(student.fullName)}" required />
          </div>
          <div class="form-field">
            <label class="form-label">Father's Name</label>
            <input id="es-father" class="form-input" value="${esc(student.fatherName)}" required />
          </div>
          <div class="form-field">
            <label class="form-label">Date of Birth</label>
            <input id="es-dob" class="form-input font-mono" type="date" value="${esc(student.dateOfBirth || '')}" />
          </div>
          <div class="form-field">
            <label class="form-label">Phone</label>
            <input id="es-phone" class="form-input font-mono" value="${esc(student.phone)}" required />
          </div>
          <div class="form-field">
            <label class="form-label">WhatsApp</label>
            <input id="es-wa" class="form-input font-mono" value="${esc(student.whatsapp)}" required />
          </div>
          <div class="form-field">
            <label class="form-label">Email</label>
            <input id="es-email" class="form-input" type="email" value="${esc(student.email)}" required />
          </div>
          <div class="form-field">
            <label class="form-label">City</label>
            <input id="es-city" class="form-input" value="${esc(student.city)}" required />
          </div>
          <div class="form-field full-span">
            <label class="form-label">Address</label>
            <input id="es-addr" class="form-input" value="${esc(student.address)}" required />
          </div>
          <div class="form-field">
            <label class="form-label">Course</label>
            <select id="es-course" class="form-select">
              ${data.courses
                .map(
                  (c) => `<option value="${esc(c.id)}" ${c.id === student.courseId ? 'selected' : ''}>${esc(c.name)}</option>`
                )
                .join('')}
            </select>
          </div>
          <div class="form-field">
            <label class="form-label">Batch</label>
            <select id="es-batch" class="form-select">
              ${data.batches
                .map(
                  (b) => `<option value="${esc(b.id)}" ${b.id === student.batchId ? 'selected' : ''}>${esc(b.name)}</option>`
                )
                .join('')}
            </select>
          </div>
          <div class="form-field">
            <label class="form-label">Admission Status</label>
            <select id="es-adm-status" class="form-select">
              ${['Pending Review', 'Approved', 'Rejected']
                .map((st) => `<option value="${st}" ${st === student.admissionStatus ? 'selected' : ''}>${st}</option>`)
                .join('')}
            </select>
          </div>
          <div class="form-field">
            <label class="form-label">Payment Status</label>
            <select id="es-pay-status" class="form-select">
              ${['Pending Verification', 'Verified', 'Rejected']
                .map((st) => `<option value="${st}" ${st === student.paymentStatus ? 'selected' : ''}>${st}</option>`)
                .join('')}
            </select>
          </div>
        </form>
      `,
      footerHtml: `
        <button type="button" class="btn btn-ghost btn-sm" id="es-cancel">Cancel</button>
        <button type="button" class="btn btn-gold btn-sm" id="es-save">Save Changes</button>
      `,
      onMount(root) {
        root.querySelector('#es-cancel')?.addEventListener('click', closeModal);
        root.querySelector('#es-save')?.addEventListener('click', () => {
          const courseObj = data.courses.find((c) => c.id === root.querySelector('#es-course').value);
          const batchObj = data.batches.find((b) => b.id === root.querySelector('#es-batch').value);
          updateStudentRecord(
            student.id,
            {
              fullName: root.querySelector('#es-name').value.trim(),
              fatherName: root.querySelector('#es-father').value.trim(),
              dateOfBirth: root.querySelector('#es-dob').value.trim(),
              phone: root.querySelector('#es-phone').value.trim(),
              whatsapp: root.querySelector('#es-wa').value.trim(),
              email: root.querySelector('#es-email').value.trim(),
              city: root.querySelector('#es-city').value.trim(),
              address: root.querySelector('#es-addr').value.trim(),
              courseId: courseObj?.id || student.courseId,
              courseName: courseObj?.name || student.courseName,
              courseFee: courseObj?.fee ?? student.courseFee,
              batchId: batchObj?.id || student.batchId,
              batchName: batchObj?.name || student.batchName,
              batchSchedule: batchObj?.schedule || student.batchSchedule,
              admissionStatus: root.querySelector('#es-adm-status').value,
              paymentStatus: root.querySelector('#es-pay-status').value,
            },
            `Edited student profile & status for ${student.id}.`
          );
          closeModal();
          showToast('Student record updated.', 'success');
          render();
        });
      },
    });
  }

  // 1. EXECUTIVE DASHBOARD
  function renderDashboardSection(data) {
    const total = data.students.length;
    const approved = data.students.filter((s) => s.admissionStatus === 'Approved').length;
    const pending = data.students.filter((s) => s.admissionStatus === 'Pending Review').length;
    const rejected = data.students.filter((s) => s.admissionStatus === 'Rejected').length;

    const verifiedPayments = data.students.filter((s) => s.paymentStatus === 'Verified');
    const pendingPayments = data.students.filter((s) => s.paymentStatus === 'Pending Verification');
    const rejectedPayments = data.students.filter((s) => s.paymentStatus === 'Rejected');

    const verifiedSum = verifiedPayments.reduce((sum, s) => sum + Number(s.courseFee || 0), 0);
    const pendingSum = pendingPayments.reduce((sum, s) => sum + Number(s.courseFee || 0), 0);

    return `
      <div class="panel">
        <div class="section-kicker">Section 01</div>
        <h2 style="font-family:var(--font-display);font-size:1.45rem;margin:0 0 6px;">Executive Dashboard</h2>
        <p style="font-size:0.9rem;color:var(--text-secondary);margin:0;">
          Live overview of student admissions, active programs, batches, and payment verification totals in LocalStorage.
        </p>
      </div>

      <div class="admin-stats-grid">
        <div class="stat-tile">
          <div class="stat-tile-label">Total Students</div>
          <div class="stat-tile-value">${total}</div>
        </div>
        <div class="stat-tile">
          <div class="stat-tile-label">Approved Students</div>
          <div class="stat-tile-value" style="color:var(--status-approved);">${approved}</div>
        </div>
        <div class="stat-tile">
          <div class="stat-tile-label">Pending Students</div>
          <div class="stat-tile-value" style="color:var(--status-pending);">${pending}</div>
        </div>
        <div class="stat-tile">
          <div class="stat-tile-label">Rejected Students</div>
          <div class="stat-tile-value" style="color:var(--status-rejected);">${rejected}</div>
        </div>
        <div class="stat-tile">
          <div class="stat-tile-label">Total Courses</div>
          <div class="stat-tile-value" style="color:var(--gold-bright);">${data.courses.length}</div>
        </div>
        <div class="stat-tile">
          <div class="stat-tile-label">Total Batches</div>
          <div class="stat-tile-value" style="color:var(--gold-bright);">${data.batches.length}</div>
        </div>
        <div class="stat-tile">
          <div class="stat-tile-label">Verified Revenue</div>
          <div class="stat-tile-value" style="font-size:1.15rem;color:var(--status-approved);">${esc(formatPKR(verifiedSum))}</div>
        </div>
        <div class="stat-tile">
          <div class="stat-tile-label">Pending Verification</div>
          <div class="stat-tile-value" style="font-size:1.15rem;color:var(--status-pending);">${esc(formatPKR(pendingSum))}</div>
        </div>
      </div>

      <div class="panel">
        <h3 style="font-family:var(--font-display);font-size:1.15rem;color:var(--gold-bright);margin:0 0 14px;">Payment Statistics Breakdown</h3>
        <div class="summary-grid">
          <div class="summary-row">
            <div class="summary-key">Verified Payments</div>
            <div class="summary-val tabular-nums">${verifiedPayments.length} student(s) · ${esc(formatPKR(verifiedSum))}</div>
          </div>
          <div class="summary-row">
            <div class="summary-key">Pending Payment Review</div>
            <div class="summary-val tabular-nums">${pendingPayments.length} student(s) · ${esc(formatPKR(pendingSum))}</div>
          </div>
          <div class="summary-row">
            <div class="summary-key">Rejected Payments</div>
            <div class="summary-val tabular-nums">${rejectedPayments.length} student(s)</div>
          </div>
          <div class="summary-row">
            <div class="summary-key">Open Enrolling Batches</div>
            <div class="summary-val tabular-nums">${data.batches.filter((b) => b.available).length} of ${data.batches.length} batches</div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="table-toolbar">
          <h3 style="font-family:var(--font-display);font-size:1.15rem;margin:0;">Recent Student Applications</h3>
          <button type="button" class="btn btn-outline btn-sm jump-admin-sec" data-sec="students">Manage All Students</button>
        </div>
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Full Name</th>
                <th>Course</th>
                <th>Fee</th>
                <th>Admission</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              ${
                data.students.length === 0
                  ? `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">No student admissions submitted yet.</td></tr>`
                  : data.students
                      .slice(0, 5)
                      .map(
                        (s) => `
                <tr>
                  <td class="font-mono">${esc(s.id)}</td>
                  <td>${esc(s.fullName)}</td>
                  <td>${esc(s.courseName)}</td>
                  <td class="num-col">${Number(s.courseFee) > 0 ? esc(formatPKR(s.courseFee)) : '—'}</td>
                  <td>${renderStatusLabel(s.admissionStatus)}</td>
                  <td>${renderStatusLabel(s.paymentStatus)}</td>
                </tr>
              `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="panel panel-gold" style="margin-top:24px;">
        <h3 style="font-family:var(--font-display);font-size:1.15rem;color:var(--gold-bright);margin:0 0 6px;">Change Password</h3>
        <p style="font-size:0.88rem;color:var(--text-secondary);margin:0 0 18px;">
          Update the administrator password for <strong style="color:var(--text-primary);">${esc(adminEmail)}</strong>. Passwords are hashed and stored securely on the backend server.
        </p>
        ${renderChangePasswordFormHtml('dash')}
      </div>
    `;
  }

  // 2. STUDENTS MANAGEMENT
  function renderStudentsSection(data) {
    const q = studentSearch.trim().toLowerCase();
    const filtered = data.students.filter((s) => {
      const matchFilter = studentFilter === 'All' || s.admissionStatus === studentFilter;
      const matchQuery =
        !q ||
        s.fullName.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.courseName.toLowerCase().includes(q);
      return matchFilter && matchQuery;
    });

    return `
      <div class="panel">
        <div class="section-kicker">Section 02</div>
        <h2 style="font-family:var(--font-display);font-size:1.45rem;margin:0 0 16px;">Students Management</h2>

        <div class="table-toolbar">
          <input
            id="admin-student-search"
            class="form-input"
            type="search"
            value="${esc(studentSearch)}"
            placeholder="Search by Student ID, name, phone, city, or course..."
            style="max-width:360px;"
          />
          <div class="filter-group" role="tablist" aria-label="Filter applications">
            ${['All', 'Pending Review', 'Approved', 'Rejected']
              .map(
                (f) => `<button type="button" class="filter-tab student-filter-btn ${studentFilter === f ? 'is-active' : ''}" data-filter="${esc(f)}">${esc(f)}</button>`
              )
              .join('')}
          </div>
        </div>

        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Student Name</th>
                <th>Course &amp; Batch</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                filtered.length === 0
                  ? `<tr><td colspan="5" style="text-align:center;padding:28px;color:var(--text-muted);">No matching student records found.</td></tr>`
                  : filtered
                      .map(
                        (s) => `
                <tr>
                  <td class="font-mono">${esc(s.id)}</td>
                  <td>
                    <div style="font-weight:600;color:var(--text-primary);">${esc(s.fullName)}</div>
                    <div style="font-size:0.78rem;color:var(--text-muted);">${esc(s.phone)} · ${esc(s.city)}</div>
                  </td>
                  <td>
                    <div>${esc(s.courseName)}</div>
                    <div style="font-size:0.78rem;color:var(--text-muted);">${esc(s.batchName)}</div>
                  </td>
                  <td>${renderStatusLabel(s.admissionStatus)}</td>
                  <td>
                    <div class="row-actions">
                      <button type="button" class="btn btn-ghost btn-sm stu-view-btn" data-id="${esc(s.id)}">View</button>
                      <button type="button" class="btn btn-success btn-sm stu-approve-btn" data-id="${esc(s.id)}">Approve</button>
                      <button type="button" class="btn btn-danger btn-sm stu-reject-btn" data-id="${esc(s.id)}">Reject</button>
                      <button type="button" class="btn btn-outline btn-sm stu-edit-btn" data-id="${esc(s.id)}">Edit</button>
                      <button type="button" class="btn btn-danger btn-sm stu-del-btn" data-id="${esc(s.id)}">Delete</button>
                    </div>
                  </td>
                </tr>
              `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // 3. BATCH MANAGEMENT
  function renderBatchesSection(data) {
    return `
      <div class="panel">
        <div class="table-toolbar" style="margin-bottom:14px;">
          <div>
            <div class="section-kicker">Section 03</div>
            <h2 style="font-family:var(--font-display);font-size:1.45rem;margin:0;">Batch Management</h2>
          </div>
          <button type="button" id="add-batch-btn" class="btn btn-gold btn-sm">Add New Batch</button>
        </div>

        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Batch ID</th>
                <th>Batch Name</th>
                <th>Schedule</th>
                <th>Start Date</th>
                <th>Seats</th>
                <th>Availability</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${data.batches
                .map(
                  (b) => `
                <tr>
                  <td class="font-mono">${esc(b.id)}</td>
                  <td style="font-weight:600;color:var(--text-primary);">${esc(b.name)}</td>
                  <td>${esc(b.schedule)}</td>
                  <td class="tabular-nums">${esc(b.startDate || '—')}</td>
                  <td class="num-col">${esc(b.capacity)}</td>
                  <td>${renderStatusLabel(b.available ? 'Open' : 'Closed')}</td>
                  <td>
                    <div class="row-actions">
                      <button type="button" class="btn btn-outline btn-sm batch-toggle-btn" data-id="${esc(b.id)}">${b.available ? 'Set Closed' : 'Set Open'}</button>
                      <button type="button" class="btn btn-ghost btn-sm batch-edit-btn" data-id="${esc(b.id)}">Edit</button>
                      <button type="button" class="btn btn-danger btn-sm batch-del-btn" data-id="${esc(b.id)}">Delete</button>
                    </div>
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // 4. COURSE MANAGEMENT
  function renderCoursesSection(data) {
    return `
      <div class="panel">
        <div class="table-toolbar" style="margin-bottom:14px;">
          <div>
            <div class="section-kicker">Section 04</div>
            <h2 style="font-family:var(--font-display);font-size:1.45rem;margin:0;">Course Management</h2>
          </div>
          <button type="button" id="add-course-btn" class="btn btn-gold btn-sm">Add New Course</button>
        </div>

        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Course Name</th>
                <th>Level &amp; Duration</th>
                <th>Fee</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${data.courses
                .map(
                  (c) => `
                <tr>
                  <td class="font-mono">${esc(c.id)}</td>
                  <td>
                    <div style="font-weight:600;color:var(--text-primary);">${esc(c.name)}</div>
                    <div style="font-size:0.78rem;color:var(--text-muted);max-width:42ch;">${esc(c.description)}</div>
                  </td>
                  <td>${esc(c.level)} · ${esc(c.duration)}</td>
                  <td class="num-col" style="color:var(--gold-bright);">${esc(formatPKR(c.fee))}</td>
                  <td>
                    <div class="row-actions">
                      <button type="button" class="btn btn-outline btn-sm course-edit-btn" data-id="${esc(c.id)}">Edit</button>
                      <button type="button" class="btn btn-danger btn-sm course-del-btn" data-id="${esc(c.id)}">Delete</button>
                    </div>
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // 5. PAYMENT VERIFICATION
  function renderPaymentsSection(data) {
    const filtered = data.students.filter(
      (s) => paymentFilter === 'All' || s.paymentStatus === paymentFilter
    );
    return `
      <div class="panel">
        <div class="table-toolbar">
          <div>
            <div class="section-kicker">Section 05</div>
            <h2 style="font-family:var(--font-display);font-size:1.45rem;margin:0;">Payment Verification</h2>
          </div>
          <div class="filter-group">
            ${['All', 'Pending Verification', 'Verified', 'Rejected']
              .map(
                (f) => `<button type="button" class="filter-tab pay-filter-btn ${paymentFilter === f ? 'is-active' : ''}" data-filter="${esc(f)}">${esc(f)}</button>`
              )
              .join('')}
          </div>
        </div>

        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Method &amp; Tx ID</th>
                <th>Amount</th>
                <th>Screenshot</th>
                <th>Payment Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                filtered.length === 0
                  ? `<tr><td colspan="6" style="text-align:center;padding:28px;color:var(--text-muted);">No payments in this filter.</td></tr>`
                  : filtered
                      .map(
                        (s) => `
                <tr>
                  <td>
                    <div style="font-weight:600;color:var(--text-primary);">${esc(s.fullName)}</div>
                    <div class="font-mono" style="font-size:0.78rem;color:var(--text-muted);">${esc(s.id)}</div>
                  </td>
                  <td>
                    <div>${esc(s.paymentMethod)}</div>
                    <div class="font-mono" style="font-size:0.8rem;color:var(--gold-bright);">${esc(s.transactionId)}</div>
                  </td>
                  <td class="num-col">${Number(s.courseFee) > 0 ? esc(formatPKR(s.courseFee)) : '—'}</td>
                  <td>
                    ${
                      s.paymentScreenshot
                        ? `<button type="button" class="btn btn-ghost btn-sm pay-view-shot-btn" data-id="${esc(s.id)}">View Receipt</button>`
                        : `<span style="font-size:0.8rem;color:var(--text-muted);">No upload</span>`
                    }
                  </td>
                  <td>${renderStatusLabel(s.paymentStatus)}</td>
                  <td>
                    <div class="row-actions">
                      <button type="button" class="btn btn-success btn-sm pay-approve-btn" data-id="${esc(s.id)}">Approve</button>
                      <button type="button" class="btn btn-danger btn-sm pay-reject-btn" data-id="${esc(s.id)}">Reject</button>
                      <select class="form-select pay-status-select" data-id="${esc(s.id)}" style="min-height:36px;padding:4px 10px;width:auto;font-size:0.8rem;">
                        ${['Pending Verification', 'Verified', 'Rejected']
                          .map((st) => `<option value="${st}" ${st === s.paymentStatus ? 'selected' : ''}>${st}</option>`)
                          .join('')}
                      </select>
                    </div>
                  </td>
                </tr>
              `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // 6. STUDENT ID MANAGEMENT
  function renderStudentIdsSection(data) {
    return `
      <div class="panel">
        <div class="section-kicker">Section 06</div>
        <h2 style="font-family:var(--font-display);font-size:1.45rem;margin:0 0 8px;">Student ID Management</h2>
        <p style="font-size:0.9rem;color:var(--text-secondary);margin:0 0 18px;">
          Generate or regenerate unique Student IDs, verify records against LocalStorage, and export official Admission Slips.
        </p>

        <div class="notice-box" style="margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;">
          <div>
            <strong>Instant Student ID Verification Check:</strong>
            <span style="margin-left:8px;color:var(--text-secondary);">Quickly check any registered Student ID stored in this browser.</span>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <input id="admin-quick-verify-input" class="form-input font-mono" style="width:210px;min-height:38px;" placeholder="SHBTA-2026-XXXX" />
            <button type="button" id="admin-quick-verify-btn" class="btn btn-gold btn-sm">Verify ID</button>
          </div>
        </div>

        <div id="admin-verify-inline-result" style="margin-bottom:18px;"></div>

        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Student Name</th>
                <th>Course</th>
                <th>Admission</th>
                <th>Issued Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                data.students.length === 0
                  ? `<tr><td colspan="6" style="text-align:center;padding:28px;color:var(--text-muted);">No registered students yet.</td></tr>`
                  : data.students
                      .map(
                        (s) => `
                <tr>
                  <td class="font-mono" style="color:var(--gold-bright);">${esc(s.id)}</td>
                  <td>${esc(s.fullName)}</td>
                  <td>${esc(s.courseName)}</td>
                  <td>${renderStatusLabel(s.admissionStatus)}</td>
                  <td class="tabular-nums">${esc(formatDate(s.createdAt))}</td>
                  <td>
                    <div class="row-actions">
                      <button type="button" class="btn btn-outline btn-sm sid-regen-btn" data-id="${esc(s.id)}">Generate New ID</button>
                      <button type="button" class="btn btn-ghost btn-sm sid-pdf-btn" data-id="${esc(s.id)}">PDF Slip</button>
                      <button type="button" class="btn btn-ghost btn-sm sid-manage-btn" data-id="${esc(s.id)}">Manage</button>
                    </div>
                  </td>
                </tr>
              `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // 7. ACTIVITY LOGS
  function renderLogsSection(data) {
    const categories = ['All', ...new Set(data.logs.map((l) => l.category))];
    const filtered = data.logs.filter((l) => logFilter === 'All' || l.category === logFilter);

    return `
      <div class="panel">
        <div class="table-toolbar">
          <div>
            <div class="section-kicker">Section 07</div>
            <h2 style="font-family:var(--font-display);font-size:1.45rem;margin:0;">Activity Logs</h2>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
            <select id="log-cat-filter" class="form-select" style="min-height:38px;width:auto;">
              ${categories
                .map((c) => `<option value="${esc(c)}" ${c === logFilter ? 'selected' : ''}>${esc(c)}</option>`)
                .join('')}
            </select>
            <button type="button" id="clear-logs-btn" class="btn btn-danger btn-sm">Clear Logs</button>
          </div>
        </div>

        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>Category</th>
                <th>Actor</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              ${
                filtered.length === 0
                  ? `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted);">No activity logs recorded.</td></tr>`
                  : filtered
                      .map(
                        (l) => `
                <tr>
                  <td class="tabular-nums" style="white-space:nowrap;">${esc(formatDateTime(l.timestamp))}</td>
                  <td style="color:var(--gold-bright);font-weight:500;">${esc(l.category)}</td>
                  <td>${esc(l.actor)}</td>
                  <td>${esc(l.description)}</td>
                </tr>
              `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // 8. ADMIN SETTINGS
  function renderSettingsSection(data) {
    const s = data.settings;
    return `
      <div class="panel">
        <div class="section-kicker">Section 08</div>
        <h2 style="font-family:var(--font-display);font-size:1.45rem;margin:0 0 18px;">Admin Settings &amp; Data Backup</h2>

        <form id="settings-profile-form" class="form-grid" style="margin-bottom:28px;padding-bottom:24px;border-bottom:1px solid var(--border-subtle);">
          <div class="form-field full-span">
            <h3 style="margin:0;font-size:1.05rem;color:var(--gold-bright);">Academy, Contact &amp; Admin Profile</h3>
          </div>
          <div class="form-field">
            <label class="form-label" for="set-academy-name">Academy Name</label>
            <input id="set-academy-name" class="form-input" value="${esc(s.academyName)}" required />
          </div>
          <div class="form-field">
            <label class="form-label" for="set-tagline">Academy Tagline</label>
            <input id="set-tagline" class="form-input" value="${esc(s.tagline)}" required />
          </div>
          <div class="form-field">
            <label class="form-label" for="set-admin-name">Admin Profile Name</label>
            <input id="set-admin-name" class="form-input" value="${esc(s.adminName)}" required />
          </div>
          <div class="form-field">
            <label class="form-label" for="set-admin-title">Admin Role Title</label>
            <input id="set-admin-title" class="form-input" value="${esc(s.adminTitle)}" required />
          </div>
          <div class="form-field">
            <label class="form-label" for="set-whatsapp">WhatsApp / Contact Number</label>
            <input id="set-whatsapp" class="form-input font-mono" value="${esc(s.whatsapp)}" required />
          </div>
          <div class="form-field">
            <label class="form-label" for="set-email">Admin Email</label>
            <input id="set-email" class="form-input" type="email" value="${esc(s.email)}" required />
          </div>
          <div class="form-field full-span">
            <label class="form-label" for="set-address">Academy Address</label>
            <input id="set-address" class="form-input" value="${esc(s.address)}" required />
          </div>
          <div class="form-field full-span">
            <button type="submit" class="btn btn-gold" style="align-self:flex-start;">Save Academy &amp; Contact Settings</button>
          </div>
        </form>

        <div style="margin-bottom:28px;padding-bottom:24px;border-bottom:1px solid var(--border-subtle);">
          <h3 style="margin:0 0 4px;font-size:1.05rem;color:var(--gold-bright);">Change Admin Password</h3>
          <p class="field-hint" style="margin:0 0 16px;">Passwords are encrypted and verified securely via backend authentication.</p>
          ${renderChangePasswordFormHtml('settings')}
        </div>

        <div>
          <h3 style="margin:0 0 8px;font-size:1.05rem;color:var(--gold-bright);">Data Backup &amp; Restore (JSON)</h3>
          <p style="font-size:0.88rem;color:var(--text-secondary);margin:0 0 16px;">
            LocalStorage data lives only on this browser and device. Export a JSON backup to archive records or transfer them to another browser.
          </p>
          <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
            <button type="button" id="export-json-btn" class="btn btn-gold btn-sm">Export All Data (JSON)</button>
            <label class="btn btn-outline btn-sm" style="cursor:pointer;">
              Import JSON Backup
              <input id="import-json-input" type="file" accept="application/json,.json" hidden />
            </label>
            <button type="button" id="reset-demo-btn" class="btn btn-danger btn-sm">Clear Students &amp; Logs</button>
          </div>
        </div>
      </div>
    `;
  }

  function wireChangePasswordForm(prefix) {
    const form = container.querySelector(`#${prefix}-password-form`);
    if (!form) return;

    wirePasswordToggles(form);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const oldInput = form.querySelector(`#${prefix}-old-pass`);
      const newInput = form.querySelector(`#${prefix}-new-pass`);
      const confirmInput = form.querySelector(`#${prefix}-confirm-pass`);
      const feedback = form.querySelector(`#${prefix}-pass-feedback`);
      const submitBtn = form.querySelector(`#${prefix}-pass-submit`);

      const oldPassword = oldInput?.value || '';
      const newPassword = newInput?.value || '';
      const confirmNewPassword = confirmInput?.value || '';

      const setFeedback = (msg, isSuccess = false) => {
        if (!feedback) return;
        feedback.textContent = msg;
        feedback.style.color = isSuccess ? '#a7f3d0' : '#fca5a5';
      };

      if (!oldPassword || !newPassword || !confirmNewPassword) {
        setFeedback('All password fields are required.');
        return;
      }
      if (newPassword.length < 8) {
        setFeedback('New password must be at least 8 characters long.');
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setFeedback('New password and confirm new password do not match.');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Updating...';
      }

      try {
        const res = await apiFetch('/api/admin/change-password', {
          method: 'POST',
          body: { oldPassword, newPassword, confirmNewPassword },
        });
        if (res.ok) {
          if (res.data?.token) adminToken = res.data.token;
          if (oldInput) oldInput.value = '';
          if (newInput) newInput.value = '';
          if (confirmInput) confirmInput.value = '';
          setFeedback(res.data?.message || 'Admin password updated securely.', true);
          addActivityLog('Admin Security', 'Administrator password updated.', loadData().settings.adminName || 'Admin');
          showToast('Admin password updated securely.', 'success');
        } else {
          setFeedback(res.data?.error || 'Could not update password.');
          if (res.status === 401 && !adminToken) {
            showToast('Session expired. Please sign in again.', 'error');
            renderAuthGate();
          }
        }
      } catch {
        setFeedback('Network error while updating password.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Update Password';
        }
      }
    });
  }

  function wireSectionEvents(data) {
    // Dashboard Change Password & jump buttons
    wireChangePasswordForm('dash');
    container.querySelectorAll('.jump-admin-sec').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeSection = btn.getAttribute('data-sec');
        render();
      });
    });

    // Students Management
    const searchInput = container.querySelector('#admin-student-search');
    searchInput?.addEventListener('input', (e) => {
      studentSearch = e.target.value;
      render();
      const restored = container.querySelector('#admin-student-search');
      if (restored) {
        restored.focus();
        restored.setSelectionRange(studentSearch.length, studentSearch.length);
      }
    });

    container.querySelectorAll('.student-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        studentFilter = btn.getAttribute('data-filter');
        render();
      });
    });

    container.querySelectorAll('.stu-view-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const s = data.students.find((item) => item.id === btn.getAttribute('data-id'));
        if (s) openStudentDetailModal(s);
      });
    });

    container.querySelectorAll('.stu-approve-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        updateStudentRecord(id, { admissionStatus: 'Approved' }, `Approved admission for ${id}.`);
        showToast(`Approved ${id}.`, 'success');
        render();
      });
    });

    container.querySelectorAll('.stu-reject-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        updateStudentRecord(id, { admissionStatus: 'Rejected' }, `Rejected admission for ${id}.`);
        showToast(`Marked ${id} as Rejected.`);
        render();
      });
    });

    container.querySelectorAll('.stu-edit-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const s = data.students.find((item) => item.id === btn.getAttribute('data-id'));
        if (s) openEditStudentModal(s);
      });
    });

    container.querySelectorAll('.stu-del-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const ok = await showConfirmModal({
          title: 'Delete Student Record',
          message: `Are you sure you want to permanently delete student record ${id} from LocalStorage?`,
        });
        if (ok) {
          deleteStudentRecord(id);
          showToast(`Deleted student ${id}.`);
          render();
        }
      });
    });

    // Batch Management
    const openBatchModal = (batch = null) => {
      openModal({
        title: batch ? `Edit Batch — ${batch.id}` : 'Add New Batch',
        bodyHtml: `
          <form id="batch-modal-form" class="form-grid">
            <div class="form-field full-span">
              <label class="form-label">Batch Name</label>
              <input id="bm-name" class="form-input" value="${esc(batch?.name || '')}" placeholder="e.g. Batch 18 — Evening Gold Desk" required />
            </div>
            <div class="form-field full-span">
              <label class="form-label">Assigned Course</label>
              <select id="bm-course" class="form-select">
                ${data.courses
                  .map(
                    (c) => `<option value="${esc(c.id)}" ${c.id === batch?.courseId ? 'selected' : ''}>${esc(c.name)}</option>`
                  )
                  .join('')}
              </select>
            </div>
            <div class="form-field full-span">
              <label class="form-label">Schedule &amp; Timings</label>
              <input id="bm-schedule" class="form-input" value="${esc(batch?.schedule || '')}" placeholder="e.g. Mon, Wed, Fri · 8:00 PM – 10:00 PM PKT" required />
            </div>
            <div class="form-field">
              <label class="form-label">Start Date</label>
              <input id="bm-date" class="form-input" type="date" value="${esc(batch?.startDate || '2026-12-20')}" />
            </div>
            <div class="form-field">
              <label class="form-label">Seat Capacity</label>
              <input id="bm-cap" class="form-input tabular-nums" type="number" min="1" value="${esc(batch?.capacity || 25)}" />
            </div>
            <div class="form-field full-span">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                <input id="bm-avail" type="checkbox" ${batch ? (batch.available ? 'checked' : '') : 'checked'} />
                <span>Batch Open for Student Admissions</span>
              </label>
            </div>
          </form>
        `,
        footerHtml: `
          <button type="button" class="btn btn-ghost btn-sm" id="bm-cancel">Cancel</button>
          <button type="button" class="btn btn-gold btn-sm" id="bm-save">Save Batch</button>
        `,
        onMount(root) {
          root.querySelector('#bm-cancel')?.addEventListener('click', closeModal);
          root.querySelector('#bm-save')?.addEventListener('click', () => {
            const name = root.querySelector('#bm-name').value.trim();
            const schedule = root.querySelector('#bm-schedule').value.trim();
            if (!name || !schedule) {
              showToast('Batch name and schedule are required.', 'error');
              return;
            }
            upsertBatch({
              id: batch?.id || '',
              name,
              courseId: root.querySelector('#bm-course').value,
              schedule,
              startDate: root.querySelector('#bm-date').value,
              capacity: Number(root.querySelector('#bm-cap').value) || 25,
              available: root.querySelector('#bm-avail').checked,
            });
            closeModal();
            showToast(batch ? 'Batch updated.' : 'Batch created.', 'success');
            render();
          });
        },
      });
    };

    container.querySelector('#add-batch-btn')?.addEventListener('click', () => openBatchModal(null));
    container.querySelectorAll('.batch-edit-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const b = data.batches.find((item) => item.id === btn.getAttribute('data-id'));
        if (b) openBatchModal(b);
      });
    });
    container.querySelectorAll('.batch-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const b = data.batches.find((item) => item.id === btn.getAttribute('data-id'));
        if (b) {
          upsertBatch({ ...b, available: !b.available });
          showToast(`Batch "${b.name}" set to ${!b.available ? 'Open' : 'Closed'}.`);
          render();
        }
      });
    });
    container.querySelectorAll('.batch-del-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const ok = await showConfirmModal({
          title: 'Delete Batch',
          message: `Delete batch ${id}? Existing student records referencing this batch name will remain intact.`,
        });
        if (ok) {
          deleteBatch(id);
          showToast('Batch deleted.');
          render();
        }
      });
    });

    // Course Management
    const openCourseModal = (course = null) => {
      openModal({
        title: course ? `Edit Course — ${course.id}` : 'Add New Course',
        bodyHtml: `
          <form id="course-modal-form" class="form-grid">
            <div class="form-field full-span">
              <label class="form-label">Course Name</label>
              <input id="cm-name" class="form-input" value="${esc(course?.name || '')}" placeholder="e.g. Institutional Order Flow Mastery" required />
            </div>
            <div class="form-field">
              <label class="form-label">Level</label>
              <input id="cm-level" class="form-input" value="${esc(course?.level || 'Intermediate')}" required />
            </div>
            <div class="form-field">
              <label class="form-label">Duration</label>
              <input id="cm-duration" class="form-input" value="${esc(course?.duration || '8 Weeks · Live')}" required />
            </div>
            <div class="form-field full-span">
              <label class="form-label">Course Fee (PKR)</label>
              <input id="cm-fee" class="form-input font-mono" type="number" min="0" value="${esc(course?.fee || 30000)}" required />
            </div>
            <div class="form-field full-span">
              <label class="form-label">Course Description</label>
              <textarea id="cm-desc" class="form-textarea" required>${esc(course?.description || '')}</textarea>
            </div>
          </form>
        `,
        footerHtml: `
          <button type="button" class="btn btn-ghost btn-sm" id="cm-cancel">Cancel</button>
          <button type="button" class="btn btn-gold btn-sm" id="cm-save">Save Course</button>
        `,
        onMount(root) {
          root.querySelector('#cm-cancel')?.addEventListener('click', closeModal);
          root.querySelector('#cm-save')?.addEventListener('click', () => {
            const name = root.querySelector('#cm-name').value.trim();
            const desc = root.querySelector('#cm-desc').value.trim();
            const fee = Number(root.querySelector('#cm-fee').value);
            if (!name || !desc || Number.isNaN(fee)) {
              showToast('Please complete all course fields.', 'error');
              return;
            }
            upsertCourse({
              id: course?.id || '',
              name,
              level: root.querySelector('#cm-level').value.trim() || 'All Levels',
              duration: root.querySelector('#cm-duration').value.trim() || '6 Weeks',
              fee,
              description: desc,
            });
            closeModal();
            showToast(course ? 'Course updated.' : 'Course added.', 'success');
            render();
          });
        },
      });
    };

    container.querySelector('#add-course-btn')?.addEventListener('click', () => openCourseModal(null));
    container.querySelectorAll('.course-edit-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const c = data.courses.find((item) => item.id === btn.getAttribute('data-id'));
        if (c) openCourseModal(c);
      });
    });
    container.querySelectorAll('.course-del-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const ok = await showConfirmModal({
          title: 'Delete Course',
          message: `Are you sure you want to delete course ${id}?`,
        });
        if (ok) {
          deleteCourse(id);
          showToast('Course deleted.');
          render();
        }
      });
    });

    // Payment Verification
    container.querySelectorAll('.pay-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        paymentFilter = btn.getAttribute('data-filter');
        render();
      });
    });

    container.querySelectorAll('.pay-view-shot-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const s = data.students.find((item) => item.id === btn.getAttribute('data-id'));
        const safeShot =
          typeof s?.paymentScreenshot === 'string' && s.paymentScreenshot.startsWith('data:image/')
            ? s.paymentScreenshot
            : '';
        if (safeShot) {
          openModal({
            title: `Payment Screenshot — ${s.transactionId}`,
            bodyHtml: `
              <p style="margin:0 0 12px;font-size:0.88rem;color:var(--text-secondary);">Student: ${esc(s.fullName)} (${esc(s.id)}) · ${esc(s.paymentMethod)}</p>
              <img src="${esc(safeShot)}" alt="Payment receipt screenshot" style="width:100%;border-radius:8px;border:1px solid var(--border-gold);" />
            `,
          });
        }
      });
    });

    container.querySelectorAll('.pay-approve-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        updateStudentRecord(id, { paymentStatus: 'Verified' }, `Verified payment for student ${id}.`);
        showToast(`Payment verified for ${id}.`, 'success');
        render();
      });
    });

    container.querySelectorAll('.pay-reject-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        updateStudentRecord(id, { paymentStatus: 'Rejected' }, `Rejected payment for student ${id}.`);
        showToast(`Payment rejected for ${id}.`);
        render();
      });
    });

    container.querySelectorAll('.pay-status-select').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const id = sel.getAttribute('data-id');
        const val = e.target.value;
        updateStudentRecord(id, { paymentStatus: val }, `Updated payment status for ${id} to ${val}.`);
        showToast(`Payment status updated to ${val}.`, 'success');
        render();
      });
    });

    // Student ID Management
    container.querySelector('#admin-quick-verify-btn')?.addEventListener('click', () => {
      const val = container.querySelector('#admin-quick-verify-input')?.value.trim().toUpperCase();
      const box = container.querySelector('#admin-verify-inline-result');
      if (!box) return;
      const match = data.students.find((s) => s.id.toUpperCase() === val);
      if (match) {
        box.innerHTML = `<div class="panel" style="padding:16px;border-color:rgba(52,211,153,0.45);"><strong>Verified:</strong> ${esc(match.fullName)} (${esc(match.id)}) · ${esc(match.courseName)} · ${renderStatusLabel(match.admissionStatus)}</div>`;
      } else {
        box.innerHTML = `<div class="panel" style="padding:16px;border-color:rgba(239,68,68,0.45);color:#fca5a5;">No local record found for "${esc(val || 'empty')}".</div>`;
      }
    });

    container.querySelectorAll('.sid-regen-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const oldId = btn.getAttribute('data-id');
        const ok = await showConfirmModal({
          title: 'Generate New Student ID',
          message: `Assign a fresh unique Student ID to replace ${oldId}?`,
          confirmLabel: 'Generate New ID',
          danger: false,
        });
        if (ok) {
          const nextId = generateUniqueStudentId(data.students);
          updateStudentRecord(oldId, { id: nextId }, `Generated new Student ID ${nextId} (replaced ${oldId}).`);
          showToast(`Assigned new Student ID: ${nextId}`, 'success');
          render();
        }
      });
    });

    container.querySelectorAll('.sid-pdf-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const s = data.students.find((item) => item.id === btn.getAttribute('data-id'));
        if (s) {
          downloadAdmissionSlipPDF(s, data.settings);
          showToast(`Downloading ${s.id}.pdf`, 'success');
        }
      });
    });

    container.querySelectorAll('.sid-manage-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const s = data.students.find((item) => item.id === btn.getAttribute('data-id'));
        if (s) openStudentDetailModal(s);
      });
    });

    // Activity Logs
    container.querySelector('#log-cat-filter')?.addEventListener('change', (e) => {
      logFilter = e.target.value;
      render();
    });

    container.querySelector('#clear-logs-btn')?.addEventListener('click', async () => {
      const ok = await showConfirmModal({
        title: 'Clear Activity Logs',
        message: 'Clear all historical activity log entries stored locally in this browser?',
      });
      if (ok) {
        clearActivityLogs();
        showToast('Activity logs cleared.');
        render();
      }
    });

    // Admin Settings
    container.querySelector('#settings-profile-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      updateSettings(
        {
          academyName: container.querySelector('#set-academy-name').value.trim(),
          tagline: container.querySelector('#set-tagline').value.trim(),
          adminName: container.querySelector('#set-admin-name').value.trim(),
          adminTitle: container.querySelector('#set-admin-title').value.trim(),
          whatsapp: container.querySelector('#set-whatsapp').value.trim(),
          email: container.querySelector('#set-email').value.trim(),
          address: container.querySelector('#set-address').value.trim(),
        },
        'Updated academy profile and contact details.'
      );
      showToast('Academy & contact settings saved.', 'success');
      render();
    });

    wireChangePasswordForm('settings');

    container.querySelector('#export-json-btn')?.addEventListener('click', () => {
      exportAcademyBackup();
      showToast('JSON backup exported.', 'success');
    });

    container.querySelector('#import-json-input')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        importAcademyBackup(text);
        showToast('Backup imported successfully into LocalStorage.', 'success');
        render();
      } catch (err) {
        showToast(err.message || 'Invalid JSON backup file.', 'error');
      }
    });

    container.querySelector('#reset-demo-btn')?.addEventListener('click', async () => {
      const ok = await showConfirmModal({
        title: 'Clear Students & Activity Logs',
        message: 'This will remove all student admission records and activity logs in this browser while keeping your courses, batches, and academy settings intact. Continue?',
      });
      if (ok) {
        resetDemoData();
        showToast('Student records and activity logs cleared.');
        render();
      }
    });
  }

  function render() {
    if (!adminToken) {
      renderAuthGate();
      return;
    }

    const data = loadData();
    const counts = {
      dashboard: '',
      students: data.students.length,
      batches: data.batches.length,
      courses: data.courses.length,
      payments: data.students.filter((s) => s.paymentStatus === 'Pending Verification').length,
      'student-ids': data.students.length,
      logs: data.logs.length,
      settings: '',
    };

    let sectionHtml = '';
    if (activeSection === 'dashboard') sectionHtml = renderDashboardSection(data);
    else if (activeSection === 'students') sectionHtml = renderStudentsSection(data);
    else if (activeSection === 'batches') sectionHtml = renderBatchesSection(data);
    else if (activeSection === 'courses') sectionHtml = renderCoursesSection(data);
    else if (activeSection === 'payments') sectionHtml = renderPaymentsSection(data);
    else if (activeSection === 'student-ids') sectionHtml = renderStudentIdsSection(data);
    else if (activeSection === 'logs') sectionHtml = renderLogsSection(data);
    else sectionHtml = renderSettingsSection(data);

    container.innerHTML = `
      <section class="page-shell">
        <div class="container">
          <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:24px;padding-bottom:18px;border-bottom:1px solid var(--border-subtle);">
            <div>
              <div class="section-kicker">Academy Operations</div>
              <h1 class="section-title" style="margin-bottom:4px;">Admin Control Panel</h1>
              <p style="margin:0;font-size:0.86rem;color:var(--text-muted);">
                Signed in as <strong style="color:var(--gold-bright);">${esc(adminEmail)}</strong> · Authenticated Admin Session
              </p>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <button type="button" id="admin-top-export" class="btn btn-outline btn-sm">Export Backup</button>
              <button type="button" id="admin-logout-btn" class="btn btn-ghost btn-sm">Logout</button>
            </div>
          </div>

          <div class="admin-layout">
            <aside class="admin-sidebar" aria-label="Admin Sections">
              <div class="admin-sidebar-title">Administration</div>
              <nav class="admin-nav">
                ${SECTIONS.map(
                  (sec) => `
                  <button
                    type="button"
                    class="admin-nav-btn ${activeSection === sec.id ? 'is-active' : ''}"
                    data-admin-sec="${esc(sec.id)}"
                  >
                    <span>${esc(sec.label)}</span>
                    ${counts[sec.id] !== '' ? `<span class="admin-nav-count">${counts[sec.id]}</span>` : ''}
                  </button>
                `
                ).join('')}
              </nav>
            </aside>

            <div class="admin-main">
              ${sectionHtml}
            </div>
          </div>
        </div>
      </section>
    `;

    container.querySelectorAll('[data-admin-sec]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeSection = btn.getAttribute('data-admin-sec');
        render();
      });
    });

    container.querySelector('#admin-top-export')?.addEventListener('click', () => {
      exportAcademyBackup();
      showToast('Exported JSON backup.', 'success');
    });

    container.querySelector('#admin-logout-btn')?.addEventListener('click', async () => {
      try {
        await apiFetch('/api/admin/logout', { method: 'POST', skipAuthReset: true });
      } catch {
        // Clear client session regardless
      }
      adminToken = '';
      adminEmail = '';
      authView = 'login';
      loginError = '';
      loginNotice = '';
      showToast('Logged out of Admin Panel.');
      renderAuthGate();
    });

    wireSectionEvents(data);
  }

  if (activeResetToken) {
    verifyResetTokenFlow(activeResetToken);
  } else if (adminToken) {
    apiFetch('/api/admin/session', { method: 'GET' })
      .then((res) => {
        if (res.ok && res.data?.authenticated) {
          adminEmail = res.data.email || adminEmail;
          render();
        } else {
          adminToken = '';
          adminEmail = '';
          renderAuthGate();
        }
      })
      .catch(() => {
        adminToken = '';
        adminEmail = '';
        renderAuthGate();
      });
  } else {
    render();
  }
}
