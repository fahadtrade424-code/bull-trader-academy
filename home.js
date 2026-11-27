// Homepage View — Sir Hamza Bull Trader Academy
import { loadData } from '../store.js';
import { esc, formatPKR, buildWhatsAppUrl, showToast } from '../utils.js';

const BULL_IMAGE_PATH = './src/assets/images/golden_bull_hero_1795761649392.jpg';
const MENTOR_IMAGE_PATH = './src/assets/images/academy_mentor_portrait_1795761649416.jpg';
const DESK_IMAGE_PATH = './src/assets/images/trading_floor_desk_1795761649521.jpg';

export function renderHomePage(container, { navigate, setPreselectedCourse }) {
  const data = loadData();
  const { courses, batches, settings } = data;
  const openBatchesCount = batches.filter((b) => b.available).length;
  const whatsappUrl = buildWhatsAppUrl(
    settings.whatsapp,
    'Assalam-o-Alaikum Sir Hamza Bull Trader Academy, I would like information regarding admissions.'
  );

  container.innerHTML = `
    <!-- HERO SECTION WITH PROMINENT 3D GOLDEN BULL BELOW HEADING -->
    <section class="hero-section">
      <div class="container">
        <div class="hero-header-block">
          <h1 class="hero-headline">
            How To Grow <span class="gold-text">100$ Into 1 lakh $</span> In One Month
          </h1>

          <div class="hero-cta-row">
            <a href="#admission" class="btn btn-gold btn-lg" data-route="admission">
              Apply for Admission
            </a>
            <a href="#verify" class="btn btn-outline btn-lg" data-route="verify">
              Verify Student ID
            </a>
          </div>
        </div>

        <!-- PROMINENT REALISTIC 3D GOLDEN BULL IMAGE DIRECTLY BELOW MAIN HEADING -->
        <div class="bull-showcase">
          <div class="bull-image-wrap">
            <img
              src="${BULL_IMAGE_PATH}"
              alt="3D sculpted metallic Golden Bull charging forward — emblem of Sir Hamza Bull Trader Academy"
              class="bull-image"
              referrerPolicy="no-referrer"
              onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
            />
            <div class="bull-fallback" style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;flex-direction:column;gap:8px;background:radial-gradient(circle, rgba(212,175,55,0.22), #07080b);padding:24px;text-align:center;">
              <strong style="font-family:var(--font-display);font-size:1.4rem;color:var(--gold-bright);">Sir Hamza Bull Trader Academy</strong>
              <span style="color:var(--text-secondary);">Disciplined Market Execution &amp; Capital Mastery</span>
            </div>
            <div class="bull-scrim"></div>
            <div class="bull-caption-bar">
              <div>
                <div class="bull-caption-title">The Bull Standard of Market Discipline</div>
                <p class="bull-caption-sub">Zero hype signals. Pure chart structure, risk mathematics, and live trading floor execution.</p>
              </div>
              <div class="bull-caption-links">
                <a href="#portal" data-route="portal">Student Portal</a>
                <a href="#admission" data-route="admission">Explore Courses</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ADMISSION CALL-TO-ACTION -->
    <section class="section section-bordered">
      <div class="container">
        <div class="cta-band">
          <div class="cta-band-copy">
            <div class="section-kicker">Admissions Open</div>
            <h2 class="section-title" style="margin-bottom:8px;">Reserve Your Seat in the Upcoming Batch</h2>
            <p class="section-subtitle">
              Complete the four-step admission form, upload your fee receipt, sign digitally, and download your official PDF Admission Slip immediately.
            </p>
          </div>
          <div class="cta-band-actions">
            <a href="#admission" class="btn btn-gold btn-lg" data-route="admission">Apply for Admission</a>
            <a href="#portal" class="btn btn-outline btn-lg" data-route="portal">Open Student Portal</a>
          </div>
        </div>
      </div>
    </section>

    <!-- CONTACT SECTION -->
    <section class="section section-bordered" id="home-contact">
      <div class="container">
        <div class="contact-grid">
          <div>
            <div class="section-kicker">Direct Admissions Desk</div>
            <h2 class="section-title">Connect With Sir Hamza Bull Trader Academy</h2>
            <p class="section-subtitle">
              Have questions about course prerequisites, batch timings, or fee transfer verification? Reach our admissions team directly via WhatsApp or email.
            </p>

            <div class="contact-info-list">
              <div class="contact-item">
                <div>
                  <div class="contact-item-label">WhatsApp &amp; Direct Call</div>
                  <div class="contact-item-value">${esc(settings.whatsapp)}</div>
                </div>
                <a href="${esc(whatsappUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-gold btn-sm">
                  Message on WhatsApp
                </a>
              </div>

              <div class="contact-item">
                <div>
                  <div class="contact-item-label">Official Academy Email</div>
                  <div class="contact-item-value">${esc(settings.email)}</div>
                </div>
                <a href="mailto:${esc(settings.email)}?subject=Admission%20Inquiry%20-%20Sir%20Hamza%20Bull%20Trader%20Academy" class="btn btn-outline btn-sm">
                  Send Email
                </a>
              </div>
            </div>
          </div>

          <div class="panel panel-gold">
            <h3 style="font-family:var(--font-display);font-size:1.25rem;margin:0 0 8px;color:var(--gold-bright);">Quick WhatsApp / Email Inquiry</h3>
            <p style="font-size:0.88rem;color:var(--text-secondary);margin:0 0 18px;">
              Compose your question below and launch it directly to WhatsApp or your email app with one click.
            </p>
            <form id="contact-quick-form" class="form-grid" novalidate>
              <div class="form-field">
                <label class="form-label" for="cq-name">Your Name <span class="req">*</span></label>
                <input id="cq-name" class="form-input" type="text" placeholder="Enter your full name" required />
              </div>
              <div class="form-field">
                <label class="form-label" for="cq-phone">Phone / WhatsApp <span class="req">*</span></label>
                <input id="cq-phone" class="form-input" type="tel" placeholder="03XX XXXXXXX" required />
              </div>
              <div class="form-field full-span">
                <label class="form-label" for="cq-course">Interested Program</label>
                <select id="cq-course" class="form-select">
                  <option value="General Admission Inquiry">General Admission Inquiry</option>
                  ${courses.map((c) => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('')}
                </select>
              </div>
              <div class="form-field full-span">
                <label class="form-label" for="cq-msg">Your Message <span class="req">*</span></label>
                <textarea id="cq-msg" class="form-textarea" placeholder="Ask about batch dates, course syllabus, or fee methods..." required></textarea>
              </div>
              <div class="form-field full-span" style="flex-direction:row;gap:12px;flex-wrap:wrap;">
                <button type="submit" data-channel="whatsapp" class="btn btn-gold">Send via WhatsApp</button>
                <button type="button" id="cq-email-btn" class="btn btn-outline">Send via Email</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  `;

  // Wire course quick-enroll buttons -> Admission Page pre-selected
  container.querySelectorAll('.enroll-course-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const courseId = btn.getAttribute('data-course-id');
      setPreselectedCourse(courseId);
      navigate('admission');
    });
  });

  // Wire quick contact form (WhatsApp & Email)
  const form = container.querySelector('#contact-quick-form');
  const buildMsg = () => {
    const name = container.querySelector('#cq-name')?.value.trim();
    const phone = container.querySelector('#cq-phone')?.value.trim();
    const course = container.querySelector('#cq-course')?.value;
    const msg = container.querySelector('#cq-msg')?.value.trim();
    if (!name || !phone || !msg) {
      showToast('Please enter your name, phone number, and message.', 'error');
      return null;
    }
    return `Assalam-o-Alaikum Sir Hamza Bull Trader Academy,\nName: ${name}\nPhone: ${phone}\nProgram: ${course}\nMessage: ${msg}`;
  };

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = buildMsg();
    if (!text) return;
    const url = buildWhatsAppUrl(settings.whatsapp, text);
    window.open(url, '_blank', 'noopener,noreferrer');
    showToast('Opening WhatsApp with your message...', 'success');
  });

  container.querySelector('#cq-email-btn')?.addEventListener('click', () => {
    const text = buildMsg();
    if (!text) return;
    const mailUrl = `mailto:${encodeURIComponent(settings.email)}?subject=${encodeURIComponent('Academy Inquiry - Sir Hamza Bull Trader Academy')}&body=${encodeURIComponent(text)}`;
    window.location.href = mailUrl;
    showToast('Opening your email client...', 'success');
  });
}
