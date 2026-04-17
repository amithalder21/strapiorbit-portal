// ════════════════════════════════════════════
// modals.js — Global modal behaviour (ESC, etc)
// ════════════════════════════════════════════

export function initModals() {
  // ESC to close any open modal
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  });
}
