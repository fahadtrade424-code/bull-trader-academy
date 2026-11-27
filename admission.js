// Four-Step Student Admission System
import { loadData, submitAdmissionApplication, setStudentSessionId } from '../store.js';
import {
  esc,
  isValidEmail,
  isValidPhone,
  compressImageFile,
  formatDateTime,
  renderStatusLabel,
  showToast,
} from '../utils.js';
import { downloadAdmissionSlipPDF } from '../pdf.js';

const DISCLAIMER_VERSION = 'v1.0 (SHBTA-2026)';

function countWords(text) {
  const cleaned = String(text || '').trim();
  return cleaned ? cleaned.split(/\s+/).filter(Boolean).length : 0;
}

const ADMISSION_COURSES = [
  {
    id: 'CRS-100-1LAKH',
    name: '100 to 1 Lakh Dollar and Personal Concepts',
    description:
      'Focused capital-growth blueprint and Sir Hamza personal market concepts for scaling small accounts with discipline.',
  },
  {
    id: 'CRS-BASIC-ADV',
    name: 'Basic to Advance Knowledge',
    description:
      'Complete structured market curriculum covering foundational candlestick reading through advanced institutional execution.',
  },
];

export function renderAdmissionPage(container, { preselectedCourseId = '', navigate }) {
  const data = loadData();
  const { settings } = data;

  let step = 1;
  let submittedStudent = null;

  const formState = {
    fullName: '',
    fatherName: '',
    dateOfBirth: '',
    phone: '',
    email: '',
    city: '',
    country: 'Pakistan',
    profilePhoto: '',

    courseId: ADMISSION_COURSES.some((c) => c.id === preselectedCourseId)
      ? preselectedCourseId
      : '',
    transactionId: '',

    studentAgreement: '',
    agreedTerms: false,
    acceptanceTimestamp: '',
    disclaimerVersion: DISCLAIMER_VERSION,

    signatureDataUrl: '',
    signatureStrokes: [],
  };

  const errors = {};

  function getSelectedCourse() {
    return ADMISSION_COURSES.find((c) => c.id === formState.courseId) || null;
  }

  function clearErrors() {
    Object.keys(errors).forEach((k) => delete errors[k]);
  }

  function validateStep(targetStep) {
    clearErrors();
    if (targetStep === 1) {
      if (!formState.fullName.trim() || formState.fullName.trim().length < 3) {
        errors.fullName = 'Please enter your full name (minimum 3 characters).';
      }
      if (!formState.fatherName.trim() || formState.fatherName.trim().length < 3) {
        errors.fatherName = "Please enter your father's full name.";
      }
      if (!formState.dateOfBirth) {
        errors.dateOfBirth = 'Date of Birth is required.';
      } else {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(formState.dateOfBirth);
        if (!match) {
          errors.dateOfBirth = 'Please select a valid Date of Birth.';
        } else {
          const y = Number(match[1]);
          const m = Number(match[2]);
          const d = Number(match[3]);
          const parsed = new Date(y, m - 1, d);
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          const validCalendar =
            parsed.getFullYear() === y &&
            parsed.getMonth() === m - 1 &&
            parsed.getDate() === d;
          if (!validCalendar || y < 1920 || parsed > today) {
            errors.dateOfBirth = 'Please enter a valid Date of Birth (cannot be in the future).';
          }
        }
      }
      if (!isValidPhone(formState.phone)) {
        errors.phone = 'Enter a valid 10–15 digit mobile number.';
      }
      if (!isValidEmail(formState.email)) {
        errors.email = 'Enter a valid email address.';
      }
      if (!formState.city.trim()) {
        errors.city = 'City is required.';
      }
      if (!formState.country.trim()) {
        errors.country = 'Country is required.';
      }
    } else if (targetStep === 2) {
      if (!getSelectedCourse()) {
        errors.courseId = 'Please select one course.';
      }
      if (!formState.transactionId.trim()) {
        errors.transactionId = 'TRX ID is required.';
      }
    } else if (targetStep === 3) {
      const words = countWords(formState.studentAgreement);
      if (words < 20) {
        errors.studentAgreement = `Please write at least 20 words in your agreement (${words} / 20 words entered).`;
      }
      if (!formState.agreedTerms) {
        errors.agreedTerms = 'You must check "I have read and understood the Student Declaration and Agreement." before proceeding.';
      }
      if (!formState.signatureDataUrl || formState.signatureStrokes.length === 0) {
        errors.signature = 'Please provide your electronic signature before proceeding to the next step.';
      }
      if (formState.agreedTerms && !formState.acceptanceTimestamp) {
        formState.acceptanceTimestamp = new Date().toISOString();
      }
    } else if (targetStep === 4) {
      if (!formState.signatureDataUrl || formState.signatureStrokes.length === 0) {
        errors.signature = 'Please draw your digital signature above before submitting.';
      }
    }
    return Object.keys(errors).length === 0;
  }

  function syncInputsFromDom() {
    if (step === 1) {
      const fn = container.querySelector('#ad-fullName');
      const fan = container.querySelector('#ad-fatherName');
      const dob = container.querySelector('#ad-dob');
      const ph = container.querySelector('#ad-phone');
      const em = container.querySelector('#ad-email');
      const ci = container.querySelector('#ad-city');
      const co = container.querySelector('#ad-country');
      if (fn) formState.fullName = fn.value;
      if (fan) formState.fatherName = fan.value;
      if (dob) formState.dateOfBirth = dob.value;
      if (ph) formState.phone = ph.value;
      if (em) formState.email = em.value;
      if (ci) formState.city = ci.value;
      if (co) formState.country = co.value;
    } else if (step === 2) {
      const checkedCourse = container.querySelector('input[name="ad-course"]:checked');
      const tx = container.querySelector('#ad-tx-id');
      if (checkedCourse) formState.courseId = checkedCourse.value;
      if (tx) formState.transactionId = tx.value;
    } else if (step === 3) {
      const agText = container.querySelector('#ad-student-agreement');
      const agCheck = container.querySelector('#ad-agree');
      if (agText) formState.studentAgreement = agText.value;
      if (agCheck) {
        formState.agreedTerms = agCheck.checked;
        if (agCheck.checked && !formState.acceptanceTimestamp) {
          formState.acceptanceTimestamp = new Date().toISOString();
        }
      }
    }
  }

  function renderSuccessView() {
    container.innerHTML = `
      <section class="page-shell">
        <div class="container" style="max-width:820px;">
          <div class="panel panel-gold">
            <div class="section-kicker">Admission Submitted</div>
            <h1 class="section-title">Application Received Successfully</h1>
            <p class="section-subtitle" style="margin-bottom:24px;">
              Thank you, <strong style="color:var(--text-primary);">${esc(submittedStudent.fullName)}</strong>. Your admission form and payment details have been saved locally and assigned a unique Student ID.
            </p>

            <div class="notice-box" style="margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
              <div>
                <div style="font-size:0.78rem;color:var(--text-muted);">Assigned Student ID</div>
                <div class="font-mono" style="font-size:1.55rem;font-weight:700;color:var(--gold-bright);">${esc(submittedStudent.id)}</div>
              </div>
              <button type="button" id="copy-student-id-btn" class="btn btn-outline btn-sm">Copy Student ID</button>
            </div>

            <div class="summary-grid" style="margin-bottom:28px;">
              <div class="summary-row">
                <div class="summary-key">Selected Course</div>
                <div class="summary-val">${esc(submittedStudent.courseName)}</div>
              </div>
              <div class="summary-row">
                <div class="summary-key">TRX ID (Transaction ID)</div>
                <div class="summary-val font-mono">${esc(submittedStudent.transactionId)}</div>
              </div>
              <div class="summary-row">
                <div class="summary-key">Admission Status</div>
                <div class="summary-val">${renderStatusLabel(submittedStudent.admissionStatus)}</div>
              </div>
              <div class="summary-row">
                <div class="summary-key">Payment Status</div>
                <div class="summary-val">${renderStatusLabel(submittedStudent.paymentStatus)}</div>
              </div>
            </div>

            <div style="display:flex;gap:12px;flex-wrap:wrap;">
              <button type="button" id="download-slip-btn" class="btn btn-gold">
                Download Admission Slip (PDF)
              </button>
              <button type="button" id="go-portal-btn" class="btn btn-outline">
                Open Student Portal
              </button>
              <button type="button" id="new-admission-btn" class="btn btn-ghost">
                Submit Another Application
              </button>
            </div>
          </div>
        </div>
      </section>
    `;

    container.querySelector('#copy-student-id-btn')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(submittedStudent.id);
      showToast(`Copied Student ID ${submittedStudent.id}`, 'success');
    });

    container.querySelector('#download-slip-btn')?.addEventListener('click', () => {
      downloadAdmissionSlipPDF(submittedStudent, settings);
      showToast('Downloading PDF Admission Slip...', 'success');
    });

    container.querySelector('#go-portal-btn')?.addEventListener('click', () => {
      setStudentSessionId(submittedStudent.id);
      navigate('portal', { studentId: submittedStudent.id });
    });

    container.querySelector('#new-admission-btn')?.addEventListener('click', () => {
      submittedStudent = null;
      step = 1;
      formState.fullName = '';
      formState.fatherName = '';
      formState.dateOfBirth = '';
      formState.phone = '';
      formState.email = '';
      formState.city = '';
      formState.country = 'Pakistan';
      formState.profilePhoto = '';
      formState.courseId = '';
      formState.transactionId = '';
      formState.studentAgreement = '';
      formState.agreedTerms = false;
      formState.acceptanceTimestamp = '';
      formState.disclaimerVersion = DISCLAIMER_VERSION;
      formState.signatureDataUrl = '';
      formState.signatureStrokes = [];
      render();
    });
  }

  function renderStep1() {
    return `
      <div class="form-grid">
        <div class="form-field">
          <label class="form-label" for="ad-fullName">Full Name <span class="req">*</span></label>
          <input id="ad-fullName" class="form-input ${errors.fullName ? 'is-invalid' : ''}" type="text" value="${esc(formState.fullName)}" placeholder="e.g. Ali Raza Khan" />
          <div class="field-error">${esc(errors.fullName || '')}</div>
        </div>

        <div class="form-field">
          <label class="form-label" for="ad-fatherName">Father's Name <span class="req">*</span></label>
          <input id="ad-fatherName" class="form-input ${errors.fatherName ? 'is-invalid' : ''}" type="text" value="${esc(formState.fatherName)}" placeholder="e.g. Muhammad Tariq Khan" />
          <div class="field-error">${esc(errors.fatherName || '')}</div>
        </div>

        <div class="form-field full-span">
          <label class="form-label" for="ad-dob">Date of Birth <span class="req">*</span></label>
          <input id="ad-dob" class="form-input font-mono ${errors.dateOfBirth ? 'is-invalid' : ''}" type="date" min="1920-01-01" max="${new Date().toISOString().slice(0, 10)}" value="${esc(formState.dateOfBirth)}" required />
          <div class="field-hint">Select Day / Month / Year</div>
          <div class="field-error">${esc(errors.dateOfBirth || '')}</div>
        </div>

        <div class="form-field">
          <label class="form-label" for="ad-phone">Mobile Number <span class="req">*</span></label>
          <input id="ad-phone" class="form-input font-mono ${errors.phone ? 'is-invalid' : ''}" type="tel" value="${esc(formState.phone)}" placeholder="03XX XXXXXXX" />
          <div class="field-error">${esc(errors.phone || '')}</div>
        </div>

        <div class="form-field">
          <label class="form-label" for="ad-email">Email Address <span class="req">*</span></label>
          <input id="ad-email" class="form-input ${errors.email ? 'is-invalid' : ''}" type="email" value="${esc(formState.email)}" placeholder="student@example.com" />
          <div class="field-error">${esc(errors.email || '')}</div>
        </div>

        <div class="form-field">
          <label class="form-label" for="ad-city">City <span class="req">*</span></label>
          <input id="ad-city" class="form-input ${errors.city ? 'is-invalid' : ''}" type="text" value="${esc(formState.city)}" placeholder="e.g. Lahore, Karachi, Islamabad" />
          <div class="field-error">${esc(errors.city || '')}</div>
        </div>

        <div class="form-field">
          <label class="form-label" for="ad-country">Country <span class="req">*</span></label>
          <input id="ad-country" class="form-input ${errors.country ? 'is-invalid' : ''}" type="text" value="${esc(formState.country)}" placeholder="e.g. Pakistan, UAE, United Kingdom" />
          <div class="field-error">${esc(errors.country || '')}</div>
        </div>

        <div class="form-field full-span">
          <label class="form-label" for="ad-photo">Student Profile Picture Upload (Optional)</label>
          <div class="upload-box">
            ${
              formState.profilePhoto
                ? `<img src="${formState.profilePhoto}" alt="Profile preview" class="upload-thumb" />`
                : `<div class="upload-thumb" style="display:flex;align-items:center;justify-content:center;font-size:0.75rem;color:var(--text-muted);">No Photo</div>`
            }
            <div style="flex:1;min-width:200px;">
              <input id="ad-photo" type="file" accept="image/*" class="form-input" style="padding:8px;" />
              <div class="field-hint" style="margin-top:6px;">Optional passport-style photo (JPG, PNG, or WebP). Compressed automatically for browser storage.</div>
            </div>
            ${
              formState.profilePhoto
                ? `<button type="button" id="remove-photo-btn" class="btn btn-ghost btn-sm">Remove</button>`
                : ''
            }
          </div>
        </div>
      </div>
    `;
  }

  function renderStep2() {
    return `
      <div class="form-grid">
        <div class="form-field full-span">
          <label class="form-label">Course Selection <span class="req">*</span></label>
          <div class="course-radio-grid" role="radiogroup" aria-label="Course Selection">
            ${ADMISSION_COURSES.map((c) => {
              const selected = formState.courseId === c.id;
              return `
                <label class="course-radio-card ${selected ? 'is-selected' : ''}">
                  <input
                    type="radio"
                    name="ad-course"
                    class="course-radio-input"
                    value="${esc(c.id)}"
                    ${selected ? 'checked' : ''}
                  />
                  <div>
                    <div class="course-radio-title">${esc(c.name)}</div>
                    <div class="course-radio-desc">${esc(c.description)}</div>
                  </div>
                </label>
              `;
            }).join('')}
          </div>
          <div class="field-error">${esc(errors.courseId || '')}</div>
        </div>

        <div class="form-field full-span">
          <label class="form-label" for="ad-tx-id">TRX ID (Transaction ID) <span class="req">*</span></label>
          <input
            id="ad-tx-id"
            class="form-input font-mono ${errors.transactionId ? 'is-invalid' : ''}"
            type="text"
            value="${esc(formState.transactionId)}"
            placeholder="Enter your TRX ID (Transaction ID)"
            required
          />
          <div class="field-error">${esc(errors.transactionId || '')}</div>
        </div>
      </div>
    `;
  }

  function renderStep3() {
    const words = countWords(formState.studentAgreement);
    const wordStatusClass = words >= 20 ? 'is-met' : words > 0 ? 'is-short' : '';
    const wordStatusText =
      words >= 20
        ? 'Minimum 20 words met — unlimited additional words allowed.'
        : words > 0
        ? `${20 - words} more word${20 - words === 1 ? '' : 's'} required (minimum 20 words).`
        : 'Minimum 20 words required (no maximum word limit).';
    const acceptanceDisplay = formState.agreedTerms && formState.acceptanceTimestamp
      ? formatDateTime(formState.acceptanceTimestamp)
      : `Auto-generated upon acceptance (${formatDateTime(new Date().toISOString())})`;

    return `
      <div class="form-grid">
        <div class="form-field full-span">
          <h2 class="declaration-main-heading">Student Declaration and Agreement</h2>
        </div>

        <div class="form-field full-span">
          <label class="form-label" for="ad-student-agreement">
            Personal Written Agreement <span class="req">*</span>
          </label>
          <textarea
            id="ad-student-agreement"
            class="form-textarea agreement-textarea ${errors.studentAgreement ? 'is-invalid' : ''}"
            placeholder="Write your personal agreement here. Minimum 20 words required."
            required
          >${esc(formState.studentAgreement)}</textarea>
          <div class="word-counter-bar">
            <span id="agreement-word-count" class="word-counter-pill">${words} word${words === 1 ? '' : 's'}</span>
            <span id="agreement-word-status" class="word-counter-status ${wordStatusClass}">${esc(wordStatusText)}</span>
          </div>
          <div id="ad-agreement-error" class="field-error">${esc(errors.studentAgreement || '')}</div>
        </div>

        <div class="form-field full-span">
          <div class="form-label" style="margin-bottom:4px;">
            Official Program Disclaimer <span class="font-mono" style="color:var(--gold-bright);margin-left:6px;">(${esc(DISCLAIMER_VERSION)})</span>
          </div>
          <div class="disclaimer-container" tabindex="0" aria-label="Program Disclaimer">
            <section class="disclaimer-section">
              <h3 class="disclaimer-sec-heading">01 — Program Ki Nature Aur Scope</h3>
              <p>Student is baat ki tasdeeq karta hai ke is program mein professional money management, mukhtalif capital amounts ke calculations, risk distribution, trading discipline, capital growth planning, advanced trading setups aur doosre relevant trading procedures ke baare mein educational information provide ki jayegi.</p>
              <p>Is program mein $100 se le kar $100,000 ya capital ki doosri amounts par based calculations aur examples educational aur mathematical explanation ke liye di jaye ge .</p>
              <p>In examples ka maqsad money management ke principles aur trading procedures ko samjhana hai. In examples ko kisi specific financial result, profit ya success ka promise, assurance ya guarantee nahi samjha jayega.</p>
            </section>

            <section class="disclaimer-section">
              <h3 class="disclaimer-sec-heading">02 — Profit Ya Capital Growth Ki Koi Guarantee Nahi</h3>
              <p>Student wazeh taur par samajhta hai aur accept karta hai ke Mentor kisi specific profit, daily ya monthly income, fixed profit rate, account growth, loss recovery ya kisi specific capital ko doosri amount mein convert karne ki guarantee nahi deta.</p>
              <p>Program ke dauran provide ki jane wali examples, estimates, calculations, setups, strategies aur practical demonstrations sirf educational purpose ke liye honge aur real trading results ki guarantee nahi honge.</p>
              <p>Real trading results theoretical calculations aur examples se thore bohat mukhtalif ho sakte hain.</p>
            </section>

            <section class="disclaimer-section">
              <h3 class="disclaimer-sec-heading">03 — Trading Risks Aur Financial Responsibility</h3>
              <p>Student samajhta hai ke Forex, Commodities, Cryptocurrency, Indices ya doosri financial markets mein trading karna high-risk activity hai.</p>
              <p>Trading ke dauran Student apne use kiye gaye capital ka kuch hissa ya poora capital bhi lose kar sakta hai.</p>
              <p>Trading karna ya na karna, kaunsa setup use karna, kitna risk lena aur kitna capital use karna, ye tamam decisions khud Student ki responsibility honge.</p>
              <p>Mentor Student ke trading account, broker, order execution, market movement ya Student ke trading decisions ko control nahi karta.</p>
              <p>Student agree karta hai ke trading ke dauran hone wale kisi bhi loss, financial damage, account drawdown, capital loss ya market-related loss ki zimmedari Mentor par nahi hogi. Student apne trading decisions, apne capital aur apne financial risk ka khud zimmedar hoga.</p>
              <p>Student is baat ko accept karta hai ke woh apni marzi aur apne risk assessment ke mutabiq trading karega aur kisi bhi trading loss ki basis par Mentor se loss ki compensation, repayment ya financial recovery ka mutalba nahi karega .</p>
            </section>

            <section class="disclaimer-section">
              <h3 class="disclaimer-sec-heading">04 — Program Fee, Non-Refundable Policy Aur Refund Terms</h3>
              <p>Student confirm karta hai ke program ki total fee, program details, access conditions aur refund policy usay payment karne se pehle clearly explain kar di gayi hain.</p>
              <p>Student acknowledge karta hai ke woh apni marzi se program ki educational information, procedures, guidance aur learning services ke liye fee pay kar raha hai, na ke kisi guaranteed income ya trading result ke liye.</p>
              <p>Student is baat ko clearly samajhta hai aur accept karta hai ke program ki fee payment ke baad kisi bhi surat mein refund nahi ki jayegi. Enrollment, payment aur program access ke baad Student apni personal reasons, irada change hone, program chhorne, expectations poori na hone, profit earn na karne, trading loss hone ya personal dissatisfaction ki basis par fee refund claim nahi karega, subject to applicable law and any mandatory consumer rights.</p>
              <p>Program ki fee educational services, learning material, guidance, training, procedures aur program access ke liye hai. Yeh fee kisi guaranteed profit, income ya trading result ke liye nahi li ja rahi.</p>
            </section>

            <section class="disclaimer-section">
              <h3 class="disclaimer-sec-heading">05 — Student Ki Consent Aur Voluntary Participation</h3>
              <p>Student confirm karta hai ke:</p>
              <ul class="disclaimer-bullet-list">
                <li>Program mein enrollment bilkul uski apni marzi se liya ja raha hai.</li>
                <li>Kisi ne usay fee pay karne ke liye force, threaten ya pressure nahi kiya.</li>
                <li>Usay program details read karne aur questions poochne ka opportunity diya gaya hai.</li>
                <li>Woh program ki educational nature ko samajhta hai.</li>
                <li>Usay guaranteed profit ya financial success ka koi promise nahi kiya gaya.</li>
                <li>Woh apni personal choice aur decision ke mutabiq educational information aur procedures receive kar raha hai.</li>
                <li>Woh trading ke financial risks aur apne capital ke possible loss ko samajhta aur accept karta hai.</li>
              </ul>
            </section>

            <section class="disclaimer-section">
              <h3 class="disclaimer-sec-heading">06 — Educational Content, Intellectual Property Rights Aur Unauthorized Sharing</h3>
              <p>Program mein provide kiye gaye tamam exclusive procedures, educational content, trading setups, recorded sessions, calculations, presentations, notes aur doosra material apne respective legal owner ki property rahenge.</p>
              <p>Student is material ko sirf apni personal education ke liye use kar sakta hai.</p>
              <p>Applicable law ke subject to, written permission ke baghair program content ko copy karna, record karna, resell karna, distribute karna, publish karna, access doosron ke saath share karna ya commercial purposes ke liye use karna prohibited hoga.</p>
              <p>Agar Student program ke exclusive content ko unauthorized tareeqe se copy, record, leak, share, resell ya distribute karta hai, to Mentor/program provider applicable law ke mutabiq complaint, claim ya legal action lene ka haq rakhta hai.</p>
            </section>

            <section class="disclaimer-section">
              <h3 class="disclaimer-sec-heading">07 — Complaints, Disputes &amp; Mutual Respect</h3>
              <p>Dono parties program se related matters mein honesty aur respect ke saath communication karne par agree karti hain.</p>
              <p>Koi bhi party doosri party ke khilaf jaan boojh kar false, fabricated ya misleading allegations nahi lagayegi.</p>
              <p>Student is baat ko accept karta hai ke trading loss, market movement, apne trading decisions ya profit na hone ki basis par Mentor ko blame karna ya usay personally loss ka zimmedar thehrana agreement ki accepted risk terms ke khilaf hoga.</p>
            </section>

            <section class="disclaimer-section">
              <h3 class="disclaimer-sec-heading">08 — Electronic Signatures &amp; Consent Record</h3>
              <p>Student is baat par agree karta hai ke is agreement ko electronic signatures ya recorded electronic consent ke through accept kiya ja sakta hai.</p>
              <p>Student ke signatures, written name, acceptance message, enrollment details, payment records aur relevant conversations ko enrollment aur consent ke proof ke taur par preserve kiya ja sakta hai, applicable law ke mutabiq.</p>
            </section>

            <section class="disclaimer-section">
              <h3 class="disclaimer-sec-heading">09 — Final Declaration &amp; Consent</h3>
              <p>Main confirm karta hoon ke main ne is agreement ko poori tarah read aur understand kar liya hai.</p>
              <p>Main samajhta hoon ke ye program professional money management, capital calculations, trading procedures aur advanced trading setups se related educational information provide karta hai.</p>
              <p>Main samajhta hoon ke is program mein profit, income, capital growth ya financial success ki koi guarantee nahi di jati.</p>
              <p>Main accept karta hoon ke trading mein mera capital partially ya completely lose ho sakta hai aur aise trading loss ki financial responsibility meri apni hogi, Mentor ki nahi, subject to applicable law.</p>
              <p>Main program ki fee aur non-refundable policy ko samajhta hoon aur accept karta hoon ke payment ke baad fee refund nahi ki jayegi, subject to applicable law.</p>
              <p>Main ne agreement ki terms, fee aur refund policy review karne aur questions poochne ka opportunity milne ke baad apni marzi se enrollment karne ka decision liya hai.</p>
              <p>Main applicable law ke subject to, pehle se clearly explain ki gayi tamam terms aur conditions se agree karta hoon.</p>
            </section>
          </div>
        </div>

        <div class="form-field full-span">
          <div class="acceptance-box">
            <h3 style="font-family:var(--font-display);font-size:1.08rem;color:var(--gold-bright);margin:0;">
              Student Acceptance and Signature
            </h3>

            <div>
              <label class="acceptance-check-row" for="ad-agree">
                <input id="ad-agree" type="checkbox" ${formState.agreedTerms ? 'checked' : ''} />
                <span>I have read and understood the Student Declaration and Agreement. <span class="req">*</span></span>
              </label>
              <div class="field-error">${esc(errors.agreedTerms || '')}</div>
            </div>

            <div class="form-grid">
              <div class="form-field">
                <label class="form-label" for="ad-accepted-fullname">Student Full Name</label>
                <input
                  id="ad-accepted-fullname"
                  class="form-input"
                  type="text"
                  value="${esc(formState.fullName || 'Not provided in Step 1')}"
                  readonly
                />
              </div>

              <div class="form-field">
                <label class="form-label" for="ad-acceptance-date">Date of Acceptance</label>
                <input
                  id="ad-acceptance-date"
                  class="form-input font-mono"
                  type="text"
                  value="${esc(acceptanceDisplay)}"
                  readonly
                />
              </div>
            </div>

            <div class="form-field">
              <label class="form-label">Electronic Signature / Student Signature <span class="req">*</span></label>
              <div class="signature-wrap">
                <canvas id="signature-canvas" width="760" height="170"></canvas>
                <div class="signature-toolbar">
                  <span>Sign inside the box using your mouse, trackpad, or finger</span>
                  <button type="button" id="clear-sig-btn" class="btn btn-ghost btn-sm" style="min-height:32px;padding:4px 12px;">Clear Signature</button>
                </div>
              </div>
              <div class="field-error">${esc(errors.signature || '')}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderStep4() {
    const course = getSelectedCourse();
    const acceptedDateLabel = formState.acceptanceTimestamp
      ? formatDateTime(formState.acceptanceTimestamp)
      : formatDateTime(new Date().toISOString());

    return `
      <div>
        <h3 style="font-family:var(--font-display);font-size:1.15rem;color:var(--gold-bright);margin:0 0 16px;">Complete Application Preview</h3>

        <div class="summary-grid" style="margin-bottom:24px;">
          <div class="summary-row">
            <div class="summary-key">Full Name</div>
            <div class="summary-val">${esc(formState.fullName)}</div>
          </div>
          <div class="summary-row">
            <div class="summary-key">Father's Name</div>
            <div class="summary-val">${esc(formState.fatherName)}</div>
          </div>
          <div class="summary-row">
            <div class="summary-key">Date of Birth</div>
            <div class="summary-val font-mono">${esc(formState.dateOfBirth)}</div>
          </div>
          <div class="summary-row">
            <div class="summary-key">Mobile Number</div>
            <div class="summary-val font-mono">${esc(formState.phone)}</div>
          </div>
          <div class="summary-row">
            <div class="summary-key">Email Address</div>
            <div class="summary-val">${esc(formState.email)}</div>
          </div>
          <div class="summary-row">
            <div class="summary-key">City &amp; Country</div>
            <div class="summary-val">${esc(formState.city)}, ${esc(formState.country)}</div>
          </div>
          <div class="summary-row">
            <div class="summary-key">Selected Course</div>
            <div class="summary-val">${esc(course?.name || '—')}</div>
          </div>
          <div class="summary-row">
            <div class="summary-key">TRX ID (Transaction ID)</div>
            <div class="summary-val font-mono">${esc(formState.transactionId)}</div>
          </div>
          <div class="summary-row">
            <div class="summary-key">Declaration Accepted</div>
            <div class="summary-val">${formState.agreedTerms ? 'Yes — Accepted' : 'No'} (${esc(formState.disclaimerVersion)})</div>
          </div>
          <div class="summary-row">
            <div class="summary-key">Date of Acceptance</div>
            <div class="summary-val font-mono">${esc(acceptedDateLabel)}</div>
          </div>
          <div class="summary-row">
            <div class="summary-key">Profile Photo</div>
            <div class="summary-val">${formState.profilePhoto ? 'Attached' : 'Not provided'}</div>
          </div>
          <div class="summary-row" style="grid-column:1 / -1;">
            <div class="summary-key">Student Written Agreement</div>
            <div class="summary-val" style="white-space:pre-wrap;">${esc(formState.studentAgreement)}</div>
          </div>
        </div>

        <div class="form-field">
          <label class="form-label">Electronic Signature <span class="req">*</span></label>
          <div class="signature-wrap">
            <canvas id="signature-canvas" width="760" height="170"></canvas>
            <div class="signature-toolbar">
              <span>Your signature from Step 3 is shown above. Sign or clear to update before submitting.</span>
              <button type="button" id="clear-sig-btn" class="btn btn-ghost btn-sm" style="min-height:32px;padding:4px 12px;">Clear Signature</button>
            </div>
          </div>
          <div class="field-error">${esc(errors.signature || '')}</div>
        </div>
      </div>
    `;
  }

  function setupSignaturePad() {
    const canvas = container.querySelector('#signature-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fbfaf6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const redrawStrokes = () => {
      ctx.fillStyle = '#fbfaf6';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#11141c';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const stroke of formState.signatureStrokes) {
        if (stroke.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x * canvas.width, stroke[0].y * canvas.height);
        for (let i = 1; i < stroke.length; i++) {
          ctx.lineTo(stroke[i].x * canvas.width, stroke[i].y * canvas.height);
        }
        ctx.stroke();
      }
    };
    redrawStrokes();

    let drawing = false;
    let activeStroke = [];

    const getNormCoords = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
      };
    };

    const startDraw = (pt) => {
      drawing = true;
      activeStroke = [pt];
      formState.signatureStrokes.push(activeStroke);
    };

    const moveDraw = (pt) => {
      if (!drawing) return;
      const prev = activeStroke[activeStroke.length - 1];
      activeStroke.push(pt);
      ctx.strokeStyle = '#11141c';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(prev.x * canvas.width, prev.y * canvas.height);
      ctx.lineTo(pt.x * canvas.width, pt.y * canvas.height);
      ctx.stroke();
    };

    const endDraw = () => {
      if (!drawing) return;
      drawing = false;
      formState.signatureDataUrl = canvas.toDataURL('image/png');
    };

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      startDraw(getNormCoords(e.clientX, e.clientY));
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      moveDraw(getNormCoords(e.clientX, e.clientY));
    });
    canvas.addEventListener('pointerup', endDraw);
    canvas.addEventListener('pointercancel', endDraw);

    container.querySelector('#clear-sig-btn')?.addEventListener('click', () => {
      formState.signatureStrokes = [];
      formState.signatureDataUrl = '';
      redrawStrokes();
    });
  }

  function render() {
    if (submittedStudent) {
      renderSuccessView();
      return;
    }

    const stepsMeta = [
      { n: 1, label: 'Personal Information' },
      { n: 2, label: 'Course & Payment' },
      { n: 3, label: 'Goals & Agreement' },
      { n: 4, label: 'Confirm & Sign' },
    ];

    container.innerHTML = `
      <section class="page-shell">
        <div class="container" style="max-width:920px;">
          <div class="page-header">
            <div class="section-kicker">Four-Step Enrollment</div>
            <h1 class="section-title">Student Admission Application</h1>
            <p class="section-subtitle">
              Complete all four steps below to register your seat, submit payment proof, and receive your downloadable PDF Admission Slip.
            </p>
          </div>

          <div class="wizard-steps" role="tablist" aria-label="Admission Steps">
            ${stepsMeta
              .map(
                (s) => `
              <button
                type="button"
                class="wizard-step ${step === s.n ? 'is-active' : s.n < step ? 'is-done' : ''}"
                data-jump-step="${s.n}"
                ${s.n > step ? 'disabled' : ''}
              >
                <span class="wizard-step-num">Step 0${s.n}</span>
                <span class="wizard-step-title">${esc(s.label)}</span>
              </button>
            `
              )
              .join('')}
          </div>

          <form id="admission-wizard-form" class="panel panel-gold" novalidate>
            ${
              step === 1
                ? renderStep1()
                : step === 2
                ? renderStep2()
                : step === 3
                ? renderStep3()
                : renderStep4()
            }

            <div class="wizard-footer">
              <div>
                ${
                  step > 1
                    ? `<button type="button" id="wizard-prev-btn" class="btn btn-outline">Back</button>`
                    : `<a href="#home" class="btn btn-ghost" data-route="home">Back to Home</a>`
                }
              </div>
              <div style="display:flex;align-items:center;gap:12px;">
                <span style="font-size:0.84rem;color:var(--text-muted);" class="tabular-nums">Step ${step} of 4</span>
                ${
                  step < 4
                    ? `<button type="submit" id="wizard-next-btn" class="btn btn-gold">Next: ${esc(stepsMeta[step].label)}</button>`
                    : `<button type="submit" id="wizard-submit-btn" class="btn btn-gold">Submit Admission</button>`
                }
              </div>
            </div>
          </form>
        </div>
      </section>
    `;

    // Jump back to completed steps
    container.querySelectorAll('[data-jump-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = Number(btn.getAttribute('data-jump-step'));
        if (target < step) {
          syncInputsFromDom();
          clearErrors();
          step = target;
          render();
        }
      });
    });

    // Step 1 listeners
    if (step === 1) {
      container.querySelector('#ad-photo')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          syncInputsFromDom();
          formState.profilePhoto = await compressImageFile(file, 420, 0.78);
          showToast('Profile picture uploaded.', 'success');
          render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });

      container.querySelector('#remove-photo-btn')?.addEventListener('click', () => {
        syncInputsFromDom();
        formState.profilePhoto = '';
        render();
      });
    }

    // Step 2 listeners
    if (step === 2) {
      container.querySelectorAll('input[name="ad-course"]').forEach((radio) => {
        radio.addEventListener('change', () => {
          syncInputsFromDom();
          delete errors.courseId;
          container.querySelectorAll('.course-radio-card').forEach((card) => {
            const input = card.querySelector('input[name="ad-course"]');
            card.classList.toggle('is-selected', Boolean(input?.checked));
          });
        });
      });
    }

    // Step 3 listeners: live word counter, acceptance timestamp & signature pad
    if (step === 3) {
      const agTextarea = container.querySelector('#ad-student-agreement');
      const countEl = container.querySelector('#agreement-word-count');
      const statusEl = container.querySelector('#agreement-word-status');
      const errEl = container.querySelector('#ad-agreement-error');
      const agreeCheck = container.querySelector('#ad-agree');
      const dateInput = container.querySelector('#ad-acceptance-date');

      agTextarea?.addEventListener('input', () => {
        formState.studentAgreement = agTextarea.value;
        const words = countWords(agTextarea.value);
        if (countEl) countEl.textContent = `${words} word${words === 1 ? '' : 's'}`;
        if (statusEl) {
          statusEl.classList.remove('is-met', 'is-short');
          if (words >= 20) {
            statusEl.classList.add('is-met');
            statusEl.textContent = 'Minimum 20 words met — unlimited additional words allowed.';
            agTextarea.classList.remove('is-invalid');
            if (errEl) errEl.textContent = '';
          } else if (words > 0) {
            statusEl.classList.add('is-short');
            statusEl.textContent = `${20 - words} more word${20 - words === 1 ? '' : 's'} required (minimum 20 words).`;
          } else {
            statusEl.textContent = 'Minimum 20 words required (no maximum word limit).';
          }
        }
      });

      agreeCheck?.addEventListener('change', () => {
        formState.agreedTerms = agreeCheck.checked;
        if (agreeCheck.checked) {
          formState.acceptanceTimestamp = new Date().toISOString();
          if (dateInput) dateInput.value = formatDateTime(formState.acceptanceTimestamp);
        } else {
          formState.acceptanceTimestamp = '';
          if (dateInput) dateInput.value = `Auto-generated upon acceptance (${formatDateTime(new Date().toISOString())})`;
        }
      });

      setupSignaturePad();
    }

    // Step 4 signature pad
    if (step === 4) {
      setupSignaturePad();
    }

    container.querySelector('#wizard-prev-btn')?.addEventListener('click', () => {
      syncInputsFromDom();
      clearErrors();
      step = Math.max(1, step - 1);
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    container.querySelector('#admission-wizard-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      syncInputsFromDom();

      if (!validateStep(step)) {
        render();
        showToast('Please check the highlighted fields before continuing.', 'error');
        return;
      }

      if (step < 4) {
        step += 1;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      try {
        const course = getSelectedCourse();
        submittedStudent = submitAdmissionApplication({
          ...formState,
          acceptedFullName: formState.fullName.trim(),
          learningGoals: formState.studentAgreement.trim(),
          acceptanceTimestamp: formState.acceptanceTimestamp || new Date().toISOString(),
          disclaimerVersion: formState.disclaimerVersion || DISCLAIMER_VERSION,
          whatsapp: formState.phone,
          address: `${formState.city}, ${formState.country}`,
          courseId: course?.id || '',
          courseName: course?.name || 'Trading Program',
          courseFee: 0,
          batchId: '',
          batchName: 'Standard Enrollment',
          batchSchedule: '',
          paymentMethod: 'TRX ID',
          paymentScreenshot: '',
          paymentStatus: 'Pending Verification',
        });
        showToast(`Admission submitted! Student ID: ${submittedStudent.id}`, 'success');
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        showToast(err.message || 'Could not save application.', 'error');
      }
    });
  }

  render();
}
