// ════════════════════════════════════════════
// utils.js — Shared helpers
// ════════════════════════════════════════════

export function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

export function copyText(el, text) {
  if (!text) return;
  const finish = () => {
    const orig = el.textContent;
    el.textContent = 'copied';
    el.classList.add('copied');
    setTimeout(() => { el.textContent = orig; el.classList.remove('copied'); }, 1800);
  };
  
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(finish).catch(err => {
      console.warn('[Utils] clipboard.writeText failed, using fallback', err);
      fallbackCopyText(text, finish);
    });
  } else {
    fallbackCopyText(text, finish);
  }
}

function fallbackCopyText(text, cb) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    if (cb) cb();
  } catch (err) {
    console.error('[Utils] Fallback copy failed', err);
  }
  document.body.removeChild(textArea);
}

export function timeAgo(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'recently';
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

// escHtml — encode HTML entities for safe innerHTML injection.
// Use this whenever server-supplied data is placed into an HTML template literal.
export function escHtml(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// escJs — escape backslashes and quotes for use inside JS string literals
// (e.g. data-* attributes that feed into onclick handlers).
// NOT sufficient for innerHTML — use escHtml for that.
export function escJs(s) {
  return escHtml(s).replace(/\\/g, '&#x5c;');
}

export function togglePw(fieldId, btn) {
  const inp = document.getElementById(fieldId);
  if (!inp) return;
  const showing = inp.type === 'password';
  inp.type = showing ? 'text' : 'password';
  btn.innerHTML = showing ? EYE_HIDE : EYE_SHOW;
}

const EYE_SHOW = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_HIDE = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
