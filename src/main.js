// ════════════════════════════════════════════
// main.js — landing page entry point
// (CSS is imported via app/(site)/layout.jsx in the Next.js app)
// ════════════════════════════════════════════
import { initAnimations } from './modules/animations.js';
import { initForm } from './modules/form.js';
import { initPayment } from './modules/payment.js';
import { loadClusters, loadLiveInstances, loadPlatformStats } from './modules/api.js';
import { initModals } from './modules/modals.js';
import { showToast } from './modules/utils.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Animations & entrance effects
  initAnimations();

  // Form multi-step + plan/region selection
  initForm();

  // Stripe payment modals
  initPayment();

  // Global modals (ESC to close)
  initModals();

  // Load live data
  loadLiveInstances();
  setInterval(loadLiveInstances, 30000);
  loadClusters();
  loadPlatformStats();

  // Hero scroll buttons
  document.getElementById('hero-deploy-btn')?.addEventListener('click', () => {
    document.getElementById('start')?.scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('hero-how-btn')?.addEventListener('click', () => {
    document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' });
  });

  // Footer / coming-soon links
  document.querySelectorAll('.coming-soon-link, #tos-link').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      showToast('Coming soon');
    });
  });

  // Redirect password reset links to dashboard
  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get('token');
  if (resetToken) {
    window.location.replace('/dashboard.html?token=' + encodeURIComponent(resetToken));
    return;
  }

  // Final UI brush: render Lucide icons
  if (window.lucide) {
    lucide.createIcons();
    // Observe DOM changes to re-render icons if needed (for dynamic lists)
    new MutationObserver(() => {
      lucide.createIcons();
    }).observe(document.body, { childList: true, subtree: true });
  }

  // Form error auto-clear
  document.addEventListener('input', e => {
    const errIds = ['portal-err', 'portal-reg-err', 'err-general', 'err-name', 'err-email', 'err-phone', 'err-company', 'err-tenant', 'err-domain'];
    errIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });
  });
});
