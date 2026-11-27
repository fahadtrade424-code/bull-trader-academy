// Shared DOM, formatting, validation, image compression, modal, and toast helpers

export function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatPKR(amount) {
  const num = Number(amount) || 0;
  return 'PKR ' + num.toLocaleString('en-PK');
}

export function formatDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return String(isoString);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return String(isoString);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getInitials(name) {
  const parts = String(name || 'S').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'S';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function statusClass(status) {
  const val = String(status || '').toLowerCase();
  if (val.includes('approved') || val.includes('verified') || val === 'open') {
    return 'status-approved';
  }
  if (val.includes('rejected') || val === 'closed') {
    return 'status-rejected';
  }
  return 'status-pending';
}

export function statusSymbol(status) {
  const val = String(status || '').toLowerCase();
  if (val.includes('approved') || val.includes('verified') || val === 'open') return '✓';
  if (val.includes('rejected') || val === 'closed') return '✕';
  return '◷';
}

export function renderStatusLabel(status) {
  const cls = statusClass(status);
  const sym = statusSymbol(status);
  return `<span class="status-text ${cls}"><span aria-hidden="true">${sym}</span><span>${esc(status)}</span></span>`;
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export function isValidPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

export function showToast(message, type = 'info') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast-item ${type === 'error' ? 'is-error' : type === 'success' ? 'is-success' : ''}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 3800);
}

export function openModal({ title, bodyHtml, footerHtml = '', onMount = null }) {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h3 id="modal-title" class="modal-title">${esc(title)}</h3>
        <button type="button" class="btn btn-ghost btn-sm" id="modal-close-btn" aria-label="Close modal">Close</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    </div>
  `;
  root.hidden = false;

  const closeBtn = root.querySelector('#modal-close-btn');
  const handleBackdrop = (e) => {
    if (e.target === root) closeModal();
  };
  const handleEsc = (e) => {
    if (e.key === 'Escape') closeModal();
  };

  root._cleanup = () => {
    root.removeEventListener('click', handleBackdrop);
    document.removeEventListener('keydown', handleEsc);
  };

  closeBtn?.addEventListener('click', closeModal);
  root.addEventListener('click', handleBackdrop);
  document.addEventListener('keydown', handleEsc);

  if (typeof onMount === 'function') {
    onMount(root);
  }
}

export function closeModal() {
  const root = document.getElementById('modal-root');
  if (!root) return;
  if (typeof root._cleanup === 'function') {
    root._cleanup();
    root._cleanup = null;
  }
  root.hidden = true;
  root.innerHTML = '';
}

export function showConfirmModal({ title, message, confirmLabel = 'Confirm Delete', danger = true }) {
  return new Promise((resolve) => {
    openModal({
      title,
      bodyHtml: `<p style="margin:0;color:var(--text-secondary);">${esc(message)}</p>`,
      footerHtml: `
        <button type="button" class="btn btn-ghost btn-sm" id="confirm-cancel-btn">Cancel</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-gold'} btn-sm" id="confirm-ok-btn">${esc(confirmLabel)}</button>
      `,
      onMount(root) {
        root.querySelector('#confirm-cancel-btn')?.addEventListener('click', () => {
          closeModal();
          resolve(false);
        });
        root.querySelector('#confirm-ok-btn')?.addEventListener('click', () => {
          closeModal();
          resolve(true);
        });
      },
    });
  });
}

// Resize image uploads cleanly so LocalStorage quota remains healthy
export function compressImageFile(file, maxDimension = 720, quality = 0.76) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Please select a valid image file (JPG, PNG, or WebP).'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Selected file could not be decoded as an image.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0e1017';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function buildWhatsAppUrl(phoneRaw, message) {
  const digits = String(phoneRaw || '03256000474').replace(/\D/g, '');
  let normalized = digits;
  if (normalized.startsWith('0')) {
    normalized = '92' + normalized.slice(1);
  } else if (!normalized.startsWith('92')) {
    normalized = '92' + normalized;
  }
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${normalized}${text}`;
}
