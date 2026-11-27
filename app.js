// Main Application Bootstrap & Hash-Based Router (GitHub Pages Compatible)
import { initCandlestickBackground } from './candlestick.js';
import { loadData } from './store.js';
import { buildWhatsAppUrl } from './utils.js';
import { renderHomePage } from './pages/home.js';
import { renderAdmissionPage } from './pages/admission.js';
import { renderPortalPage } from './pages/portal.js';
import { renderVerifyPage } from './pages/verify.js';
import { renderAdminPage } from './pages/admin.js';

const ROUTES = ['home', 'admission', 'portal', 'verify', 'admin'];

const state = {
  preselectedCourseId: '',
  portalStudentId: '',
  verifyStudentId: '',
};

function parseRoute() {
  const raw = (window.location.hash || '#home').replace(/^#/, '');
  const [routePart, queryPart] = raw.split('?');
  const normalized = routePart.toLowerCase();

  // Handle homepage section scroll hashes cleanly
  if (normalized.startsWith('home-')) {
    return { route: 'home', scrollTarget: normalized, params: new URLSearchParams(queryPart || '') };
  }

  const route = ROUTES.includes(normalized) ? normalized : 'home';
  return { route, scrollTarget: '', params: new URLSearchParams(queryPart || '') };
}

function updateActiveNav(route) {
  document.querySelectorAll('[data-route]').forEach((el) => {
    const r = el.getAttribute('data-route');
    el.classList.toggle('is-active', r === route);
  });
}

function syncFooterContact() {
  const { settings } = loadData();
  const phoneEl = document.getElementById('footer-phone-link');
  const emailEl = document.getElementById('footer-email-link');
  const yearEl = document.getElementById('footer-year');

  if (phoneEl) {
    phoneEl.textContent = settings.whatsapp || '0325 6000474';
    phoneEl.href = buildWhatsAppUrl(settings.whatsapp, 'Assalam-o-Alaikum Sir Hamza Bull Trader Academy');
  }
  if (emailEl) {
    emailEl.textContent = settings.email || 'sirhamzawebsite@gmail.com';
    emailEl.href = `mailto:${settings.email || 'sirhamzawebsite@gmail.com'}`;
  }
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
}

export function navigate(route, options = {}) {
  if (options.courseId) state.preselectedCourseId = options.courseId;
  if (options.studentId && route === 'portal') state.portalStudentId = options.studentId;
  if (options.studentId && route === 'verify') state.verifyStudentId = options.studentId;

  const targetHash = `#${route}`;
  if (window.location.hash !== targetHash) {
    window.location.hash = targetHash;
  } else {
    renderCurrentRoute();
  }
}

function renderCurrentRoute() {
  const root = document.getElementById('app-root');
  if (!root) return;

  const { route, scrollTarget, params } = parseRoute();
  updateActiveNav(route);
  syncFooterContact();

  const helpers = {
    navigate,
    setPreselectedCourse(courseId) {
      state.preselectedCourseId = courseId;
    },
  };

  if (route === 'admission') {
    renderAdmissionPage(root, {
      preselectedCourseId: params.get('course') || state.preselectedCourseId,
      ...helpers,
    });
  } else if (route === 'portal') {
    renderPortalPage(root, {
      initialStudentId: params.get('id') || state.portalStudentId,
      ...helpers,
    });
    state.portalStudentId = '';
  } else if (route === 'verify') {
    renderVerifyPage(root, {
      initialId: params.get('id') || state.verifyStudentId,
      ...helpers,
    });
    state.verifyStudentId = '';
  } else if (route === 'admin') {
    renderAdminPage(root, {
      resetToken: params.get('resetToken') || '',
      ...helpers,
    });
  } else {
    renderHomePage(root, helpers);
  }

  // Close mobile drawer if open
  const drawer = document.getElementById('mobile-drawer');
  const toggleBtn = document.getElementById('mobile-menu-toggle');
  if (drawer && !drawer.hidden) {
    drawer.hidden = true;
    toggleBtn?.setAttribute('aria-expanded', 'false');
  }

  if (scrollTarget) {
    requestAnimationFrame(() => {
      const target = document.getElementById(scrollTarget);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  } else {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}

function initNavigationListeners() {
  const toggleBtn = document.getElementById('mobile-menu-toggle');
  const drawer = document.getElementById('mobile-drawer');

  toggleBtn?.addEventListener('click', () => {
    if (!drawer) return;
    const isHidden = drawer.hidden;
    drawer.hidden = !isHidden;
    toggleBtn.setAttribute('aria-expanded', String(isHidden));
  });

  document.addEventListener('click', (e) => {
    const scrollEl = e.target.closest('[data-scroll]');
    if (scrollEl) {
      e.preventDefault();
      const targetId = scrollEl.getAttribute('data-scroll');
      const { route } = parseRoute();
      if (route !== 'home') {
        window.location.hash = `#${targetId}`;
      } else {
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (drawer && !drawer.hidden) {
        drawer.hidden = true;
        toggleBtn?.setAttribute('aria-expanded', 'false');
      }
    }
  });

  window.addEventListener('hashchange', renderCurrentRoute);
}

// Initialize app cleanly on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initCandlestickBackground();
  initNavigationListeners();
  renderCurrentRoute();
});
