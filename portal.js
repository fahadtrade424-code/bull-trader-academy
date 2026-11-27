// Student Portal Page — Login via Student ID, Profile, Statuses, PDF Slip, Logout
import {
  findStudentById,
  getStudentSessionId,
  setStudentSessionId,
  loadData,
} from '../store.js';
import {
  esc,
  formatPKR,
  formatDate,
  getInitials,
  renderStatusLabel,
  openModal,
  showToast,
} from '../utils.js';
import { downloadAdmissionSlipPDF } from '../pdf.js';

export function renderPortalPage(container, { initialStudentId = '', navigate }) {
  const data = loadData();
  if (initialStudentId) {
    setStudentSessionId(initialStudentId);
  }

  let activeId = getStudentSessionId();
  let student = activeId ? findStudentById(activeId) : null;
  let loginError = '';

  function render() {
    if (!student) {
      container.innerHTML = `
        <section class="page-shell">
          <div class="container" style="max-width:560px;">
            <div class="page-header">
              <div class="section-kicker">Enrolled Student Access</div>
              <h1 class="section-title">Student Portal</h1>
              <p class="section-subtitle">
                Sign in with your assigned Academy Student ID to inspect your profile, admission status, payment verification, and download your Admission Slip.
              </p>
            </div>

            <div class="panel panel-gold">
              <form id="student-login-form" style="display:flex;flex-direction:column;gap:16px;" novalidate>
                <div class="form-field">
                  <label class="form-label" for="portal-student-id">Student ID</label>
                  <input
                    id="portal-student-id"
                    class="form-input font-mono ${loginError ? 'is-invalid' : ''}"
                    type="text"
                    placeholder="e.g. SHBTA-2026-XXXX"
                    required
                  />
                  <div class="field-error">${esc(loginError)}</div>
                </div>
                <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between;">
                  <button type="submit" class="btn btn-gold">Access Student Portal</button>
                  <a href="#admission" class="btn btn-ghost btn-sm" data-route="admission">Apply for Admission</a>
                </div>
              </form>
            </div>
          </div>
        </section>
      `;

      container.querySelector('#student-login-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const inputVal = container.querySelector('#portal-student-id')?.value.trim().toUpperCase();
        const match = findStudentById(inputVal);
        if (!match) {
          loginError = `No student record found for "${inputVal || 'empty'}". Check your ID or submit a new admission.`;
          render();
          return;
        }
        loginError = '';
        setStudentSessionId(match.id);
        student = match;
        showToast(`Welcome back, ${match.fullName}.`, 'success');
        render();
      });
      return;
    }

    const safePhoto =
      typeof student.profilePhoto === 'string' && student.profilePhoto.startsWith('data:image/')
        ? student.profilePhoto
        : '';
    const safeReceipt =
      typeof student.paymentScreenshot === 'string' && student.paymentScreenshot.startsWith('data:image/')
        ? student.paymentScreenshot
        : '';

    // Authenticated Student Dashboard
    container.innerHTML = `
      <section class="page-shell">
        <div class="container" style="max-width:980px;">
          <div class="panel panel-gold" style="margin-bottom:24px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;">
              <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;">
                ${
                  safePhoto
                    ? `<img src="${esc(safePhoto)}" alt="${esc(student.fullName)}" style="width:74px;height:74px;border-radius:10px;object-fit:cover;border:1px solid var(--border-gold);" />`
                    : `<div style="width:74px;height:74px;border-radius:10px;border:1px solid var(--border-gold);background:#090b10;display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:1.4rem;color:var(--gold-bright);">${esc(getInitials(student.fullName))}</div>`
                }
                <div>
                  <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px;">Student Profile · <span class="font-mono" style="color:var(--gold-bright);">${esc(student.id)}</span></div>
                  <h1 style="font-family:var(--font-display);font-size:1.6rem;margin:0;color:var(--text-primary);">${esc(student.fullName)}</h1>
                  <div style="font-size:0.88rem;color:var(--text-secondary);margin-top:4px;">${esc(student.city)} · Enrolled ${esc(formatDate(student.createdAt))}</div>
                </div>
              </div>

              <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <button type="button" id="portal-download-slip" class="btn btn-gold btn-sm">Download Admission Slip</button>
                <button type="button" id="portal-logout-btn" class="btn btn-outline btn-sm">Logout</button>
              </div>
            </div>
          </div>

          <div class="admin-stats-grid portal-stats-grid" style="margin-bottom:24px;">
            <div class="stat-tile">
              <div class="stat-tile-label">Admission Status</div>
              <div style="margin-top:4px;">${renderStatusLabel(student.admissionStatus)}</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile-label">Payment Status</div>
              <div style="margin-top:4px;">${renderStatusLabel(student.paymentStatus)}</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile-label">${Number(student.courseFee) > 0 ? 'Program Fee' : 'TRX ID'}</div>
              <div class="stat-tile-value font-mono" style="font-size:1.05rem;color:var(--gold-bright);word-break:break-all;">${
                Number(student.courseFee) > 0 ? esc(formatPKR(student.courseFee)) : esc(student.transactionId || '—')
              }</div>
            </div>
          </div>

          <div class="courses-grid">
            <div class="panel">
              <h2 style="font-family:var(--font-display);font-size:1.15rem;color:var(--gold-bright);margin:0 0 16px;">Academic &amp; Payment Details</h2>
              <div class="summary-row">
                <div class="summary-key">Selected Course</div>
                <div class="summary-val">${esc(student.courseName)}</div>
              </div>
              <div class="summary-row">
                <div class="summary-key">TRX ID (Transaction ID)</div>
                <div class="summary-val font-mono">${esc(student.transactionId || '—')}</div>
              </div>
              <div class="summary-row">
                <div class="summary-key">Declaration Accepted</div>
                <div class="summary-val">${student.agreedTerms ? `Accepted (${esc(student.disclaimerVersion || 'v1.0')})` : 'Pending'}</div>
              </div>
              <div class="summary-row">
                <div class="summary-key">Written Agreement</div>
                <div class="summary-val" style="white-space:pre-wrap;">${esc(student.studentAgreement || student.learningGoals || '—')}</div>
              </div>
              ${
                safeReceipt
                  ? `
                <div style="margin-top:14px;">
                  <button type="button" id="portal-view-receipt" class="btn btn-ghost btn-sm">View Payment Screenshot</button>
                </div>
              `
                  : ''
              }
            </div>

            <div class="panel">
              <h2 style="font-family:var(--font-display);font-size:1.15rem;color:var(--gold-bright);margin:0 0 16px;">Student Information</h2>
              <div class="summary-row">
                <div class="summary-key">Full Name</div>
                <div class="summary-val">${esc(student.fullName)}</div>
              </div>
              <div class="summary-row">
                <div class="summary-key">Father's Name</div>
                <div class="summary-val">${esc(student.fatherName)}</div>
              </div>
              <div class="summary-row">
                <div class="summary-key">Date of Birth</div>
                <div class="summary-val font-mono">${esc(student.dateOfBirth ? formatDate(student.dateOfBirth) : '—')}</div>
              </div>
              <div class="summary-row">
                <div class="summary-key">Mobile Number</div>
                <div class="summary-val font-mono">${esc(student.phone)}</div>
              </div>
              <div class="summary-row">
                <div class="summary-key">Email Address</div>
                <div class="summary-val">${esc(student.email)}</div>
              </div>
              <div class="summary-row">
                <div class="summary-key">City &amp; Country</div>
                <div class="summary-val">${esc(student.city)}${student.country ? `, ${esc(student.country)}` : ''}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;

    container.querySelector('#portal-download-slip')?.addEventListener('click', () => {
      downloadAdmissionSlipPDF(student, data.settings);
      showToast('Downloading PDF Admission Slip...', 'success');
    });

    container.querySelector('#portal-logout-btn')?.addEventListener('click', () => {
      setStudentSessionId('');
      student = null;
      showToast('Logged out of Student Portal.');
      render();
    });

    container.querySelector('#portal-view-receipt')?.addEventListener('click', () => {
      if (!safeReceipt) return;
      openModal({
        title: `Payment Receipt — ${student.transactionId}`,
        bodyHtml: `<img src="${esc(safeReceipt)}" alt="Payment receipt screenshot" style="width:100%;border-radius:8px;border:1px solid var(--border-gold);" />`,
      });
    });
  }

  render();
}
