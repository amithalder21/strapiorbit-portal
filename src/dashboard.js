// ════════════════════════════════════════════
// dashboard.js — Entry point for /dashboard
// (CSS is imported via app/(site)/layout.jsx in the Next.js app)
// ════════════════════════════════════════════
import { initPortal } from './modules/portal.js';
import { initPayment } from './modules/payment.js';
import { initModals } from './modules/modals.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Portal: login, tenants, manage
  initPortal();

  // Payment: renew subscription modal
  initPayment();

  // Global modals (ESC to close)
  initModals();

  // Handle password reset link: /dashboard.html?token=xxx
  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get('token');
  if (resetToken) {
    const { openResetModal } = await import('./modules/portal.js');
    openResetModal(resetToken);
  }

  // Lucide icons
  if (window.lucide) {
    lucide.createIcons();
    new MutationObserver(() => {
      lucide.createIcons();
    }).observe(document.body, { childList: true, subtree: true });
  }

  // Form error auto-clear
  document.addEventListener('input', () => {
    ['portal-err', 'portal-reg-err', 'cp-err', 'renew-err'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });
  });
});
