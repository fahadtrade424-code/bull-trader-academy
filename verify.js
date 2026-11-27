// Student ID Verification Page
import { findStudentById, loadData } from '../store.js';
import { esc, formatDate, renderStatusLabel, buildWhatsAppUrl } from '../utils.js';

export function renderVerifyPage(container, { initialId = '', navigate }) {
  const data = loadData();
  let queryId = initialId;
  let searched = Boolean(initialId);
  let foundStudent = initialId ? findStudentById(initialId) : null;

  function render() {
    const whatsappUrl = buildWhatsAppUrl(
      data.settings.whatsapp,
      `Assalam-o-Alaikum, I need help verifying Student ID: ${queryId || ''}`
    );

    container.innerHTML = `
      <section class="page-shell">
        <div class="container" style="max-width:860px;">
          <div class="page-header">
            <div class="section-kicker">Credential Check</div>
            <h1 class="section-title">Student ID Verification</h1>
            <p class="section-subtitle">
              Enter your assigned Academy Student ID (format: <span class="font-mono" style="color:var(--gold-bright);">SHBTA-2026-XXXX</span>) to verify your enrollment and payment status.
            </p>
          </div>

          <div class="panel panel-gold" style="margin-bottom:24px;">
            <form id="verify-form" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;" novalidate>
              <div class="form-field" style="flex:1;min-width:240px;">
                <label class="form-label" for="verify-id-input">Academy Student ID</label>
                <input
                  id="verify-id-input"
                  class="form-input font-mono"
                  type="text"
                  value="${esc(queryId)}"
                  placeholder="e.g. SHBTA-2026-XXXX"
                  required
                />
              </div>
              <button type="submit" class="btn btn-gold">Verify Student ID</button>
            </form>
            <p class="field-hint" style="margin:12px 0 0;">
              Verification checks enrollment records saved in this browser.
            </p>
          </div>

          ${
            searched && foundStudent
              ? `
            <div class="panel" id="verify-result-card">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding-bottom:18px;margin-bottom:18px;border-bottom:1px solid var(--border-subtle);">
                <div>
                  <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px;">Verified Record</div>
                  <h2 style="font-family:var(--font-display);font-size:1.4rem;color:var(--gold-bright);margin:0;">${esc(foundStudent.fullName)}</h2>
                </div>
                <div class="font-mono" style="font-size:1.1rem;color:var(--text-primary);padding:8px 14px;border:1px solid var(--border-gold);border-radius:var(--radius-sm);background:#090b10;">
                  ${esc(foundStudent.id)}
                </div>
              </div>

              <div class="summary-grid">
                <div class="summary-row">
                  <div class="summary-key">Student Name</div>
                  <div class="summary-val">${esc(foundStudent.fullName)}</div>
                </div>
                <div class="summary-row">
                  <div class="summary-key">Student ID</div>
                  <div class="summary-val font-mono">${esc(foundStudent.id)}</div>
                </div>
                <div class="summary-row">
                  <div class="summary-key">Course</div>
                  <div class="summary-val">${esc(foundStudent.courseName)}</div>
                </div>
                <div class="summary-row">
                  <div class="summary-key">TRX ID</div>
                  <div class="summary-val font-mono">${esc(foundStudent.transactionId || '—')}</div>
                </div>
                <div class="summary-row">
                  <div class="summary-key">Admission Status</div>
                  <div class="summary-val">${renderStatusLabel(foundStudent.admissionStatus)}</div>
                </div>
                <div class="summary-row">
                  <div class="summary-key">Payment Status</div>
                  <div class="summary-val">${renderStatusLabel(foundStudent.paymentStatus)}</div>
                </div>
                <div class="summary-row">
                  <div class="summary-key">City</div>
                  <div class="summary-val">${esc(foundStudent.city)}</div>
                </div>
                <div class="summary-row">
                  <div class="summary-key">Submission Date</div>
                  <div class="summary-val tabular-nums">${esc(formatDate(foundStudent.createdAt))}</div>
                </div>
              </div>

              <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:22px;">
                <button type="button" id="open-portal-from-verify" class="btn btn-gold btn-sm">Open in Student Portal</button>
                <a href="${esc(whatsappUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">Contact Admissions Desk</a>
              </div>
            </div>
          `
              : searched
              ? `
            <div class="panel" style="border-color:rgba(239,68,68,0.45);">
              <h3 style="margin:0 0 8px;color:#fca5a5;font-size:1.15rem;">Invalid or Unrecognized Student ID</h3>
              <p style="margin:0 0 16px;color:var(--text-secondary);">
                No admission record matching <strong class="font-mono" style="color:var(--text-primary);">${esc(queryId || 'empty')}</strong> was found. Please check your Student ID spelling or submit a new admission application.
              </p>
              <div style="display:flex;gap:12px;flex-wrap:wrap;">
                <a href="#admission" class="btn btn-gold btn-sm" data-route="admission">Apply for Admission</a>
                <a href="${esc(whatsappUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">Ask Support on WhatsApp</a>
              </div>
            </div>
          `
              : ''
          }
        </div>
      </section>
    `;

    container.querySelector('#verify-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = container.querySelector('#verify-id-input');
      queryId = input.value.trim().toUpperCase();
      searched = true;
      foundStudent = findStudentById(queryId);
      render();
    });

    container.querySelector('#open-portal-from-verify')?.addEventListener('click', () => {
      if (foundStudent) {
        navigate('portal', { studentId: foundStudent.id });
      }
    });
  }

  render();
}
