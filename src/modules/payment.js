// ════════════════════════════════════════════
// payment.js — Stripe payment & renew modals
// ════════════════════════════════════════════
import { handleSubmit, setPaidState } from './form.js';
import { showToast } from './utils.js';
import { apiFetch, authFetch } from '../lib/api-client.js';

let _pendingPlan       = '';
let _stripeInstance    = null;
let _stripeCard        = null;
let _paymentProcessing = false;

let _renewTenant     = '';
let _renewPlan       = '';
let _renewCard       = null;
let _renewProcessing = false;

// Boot Stripe on import
(function initStripe() {
  apiFetch('/api/stripe-publishable-key')
    .then(d => { if (d.ok) _stripeInstance = Stripe(d.key); })
    .catch(() => {});
})();

function _ensureStripe(cb) {
  if (_stripeInstance) { cb(); return; }
  apiFetch('/api/stripe-publishable-key')
    .then(d => {
      if (!d.ok) throw new Error('Stripe not configured');
      _stripeInstance = Stripe(d.key);
      cb();
    })
    .catch(e => {
      const el = document.getElementById('pay-err');
      if (el) el.textContent = e.message || 'Could not load payment form.';
    });
}

function _stripeCardStyle() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'classic';
  return {
    base: {
      color:       isLight ? '#061b31' : '#f0f2f7',
      fontFamily:  "'DM Mono', monospace",
      fontSize:    '14px',
      lineHeight:  '24px',
      '::placeholder': { color: isLight ? '#9aaab8' : '#3a3f52' },
      iconColor:   isLight ? '#64748d' : '#7a8099',
    },
    invalid: { color: '#ef4444', iconColor: '#ef4444' }
  };
}

export function openPaymentModal(plan) {
  _pendingPlan  = plan;
  setPaidState('', '');
  const price = plan === 'starter' ? '$29' : plan === 'pro' ? '$79' : '$199';
  const planEl  = document.getElementById('pay-plan-label');
  const priceEl = document.getElementById('pay-price-label');
  const errEl   = document.getElementById('pay-err');
  const btn     = document.getElementById('pay-btn');
  if (planEl)  planEl.textContent  = plan.charAt(0).toUpperCase() + plan.slice(1);
  if (priceEl) priceEl.textContent = price;
  if (errEl)   errEl.textContent   = '';
  if (btn)     { btn.textContent   = 'Subscribe — ' + price + '/mo'; btn.disabled = false; }
  _paymentProcessing = false;
  document.getElementById('payment-modal')?.classList.add('open');

  _ensureStripe(() => {
    if (_stripeCard) { _stripeCard.destroy(); _stripeCard = null; }
    const elements = _stripeInstance.elements();
    _stripeCard = elements.create('card', { style: _stripeCardStyle(), hidePostalCode: true });
    const mountEl = document.getElementById('stripe-card-element');
    if (mountEl) mountEl.innerHTML = '';
    _stripeCard.mount('#stripe-card-element');
    _stripeCard.on('change', e => {
      const errEl = document.getElementById('pay-err');
      if (errEl) errEl.textContent = e.error ? e.error.message : '';
    });
    setTimeout(() => _stripeCard.focus(), 100);
  });
}

function closePaymentModal() {
  if (_paymentProcessing) return;
  document.getElementById('payment-modal')?.classList.remove('open');
  if (_stripeCard) { _stripeCard.destroy(); _stripeCard = null; }
  _pendingPlan = '';
}

async function confirmPayment() {
  if (!_stripeInstance || !_stripeCard) {
    const e = document.getElementById('pay-err');
    if (e) e.textContent = 'Payment not ready — please reload the page.';
    return;
  }
  const btn = document.getElementById('pay-btn');
  if (btn) { btn.textContent = 'Processing...'; btn.disabled = true; }
  _paymentProcessing = true;
  const confirmedPlan = _pendingPlan;

  try {
    const d = await apiFetch('/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ plan: confirmedPlan }),
    });
    if (!d.ok) throw new Error(d.error || 'Server error');

    const result = await _stripeInstance.confirmCardPayment(d.client_secret, {
      payment_method: { card: _stripeCard },
    });
    if (result.error) throw new Error(result.error.message);

    setPaidState(confirmedPlan, result.paymentIntent.id);
    _pendingPlan = '';
    _paymentProcessing = false;
    document.getElementById('payment-modal')?.classList.remove('open');
    if (_stripeCard) { _stripeCard.destroy(); _stripeCard = null; }
    showToast('Payment confirmed — setting up your instance…', 4000);
    setTimeout(() => handleSubmit(), 400);
  } catch (err) {
    const errEl = document.getElementById('pay-err');
    if (errEl) errEl.textContent = err.message || 'Payment failed. Try again.';
    const price = confirmedPlan === 'starter' ? '$29' : confirmedPlan === 'pro' ? '$79' : '$199';
    if (btn) { btn.textContent = 'Subscribe — ' + price + '/mo'; btn.disabled = false; }
    _paymentProcessing = false;
  }
}

export function openRenewModal(tenant, plan) {
  _renewTenant     = tenant;
  _renewPlan       = plan;
  _renewProcessing = false;
  const price = plan === 'starter' ? '$29' : plan === 'pro' ? '$79' : '$199';
  const tenantEl = document.getElementById('renew-tenant-label');
  const planEl   = document.getElementById('renew-plan-label');
  const priceEl  = document.getElementById('renew-price-label');
  const errEl    = document.getElementById('renew-err');
  const btn      = document.getElementById('renew-btn');
  if (tenantEl) tenantEl.textContent = tenant;
  if (planEl)   planEl.textContent   = plan.charAt(0).toUpperCase() + plan.slice(1);
  if (priceEl)  priceEl.textContent  = price;
  if (errEl)    errEl.textContent    = '';
  if (btn)      btn.disabled         = false;
  document.getElementById('renew-modal')?.classList.add('open');

  _ensureStripe(() => {
    if (_renewCard) { _renewCard.destroy(); _renewCard = null; }
    const elements = _stripeInstance.elements();
    _renewCard = elements.create('card', { style: _stripeCardStyle(), hidePostalCode: true });
    const mountEl = document.getElementById('renew-card-element');
    if (mountEl) mountEl.innerHTML = '';
    _renewCard.mount('#renew-card-element');
    _renewCard.on('change', e => {
      const errEl = document.getElementById('renew-err');
      if (errEl) errEl.textContent = e.error ? e.error.message : '';
    });
    setTimeout(() => _renewCard.focus(), 100);
  });
}

function closeRenewModal() {
  if (_renewProcessing) return;
  document.getElementById('renew-modal')?.classList.remove('open');
  if (_renewCard) { _renewCard.destroy(); _renewCard = null; }
  _renewTenant = '';
  _renewPlan   = '';
}

async function confirmRenewal() {
  if (!_stripeInstance || !_renewCard) {
    const e = document.getElementById('renew-err');
    if (e) e.textContent = 'Payment not ready — please reload.';
    return;
  }
  const btn   = document.getElementById('renew-btn');
  const errEl = document.getElementById('renew-err');
  if (btn) { btn.textContent = 'Processing...'; btn.disabled = true; }
  _renewProcessing = true;
  const tenant = _renewTenant;
  const plan   = _renewPlan;
  const price  = plan === 'starter' ? '$29' : plan === 'pro' ? '$79' : '$199';

  try {
    const intentData = await authFetch('/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ plan, type: 'renewal' }),
    });
    if (!intentData.ok) throw new Error(intentData.error || 'Server error');

    const result = await _stripeInstance.confirmCardPayment(intentData.client_secret, {
      payment_method: { card: _renewCard },
    });
    if (result.error) throw new Error(result.error.message);

    const renewData = await authFetch(`/api/my/tenants/${tenant}/renew`, {
      method: 'POST',
      body: JSON.stringify({ payment_intent_id: result.paymentIntent.id }),
    });
    if (!renewData.ok) throw new Error(renewData.error || 'Renewal failed');

    _renewProcessing = false;
    document.getElementById('renew-modal')?.classList.remove('open');
    if (_renewCard) { _renewCard.destroy(); _renewCard = null; }
    const end = renewData.period_end ? renewData.period_end.substring(0, 10) : 'updated';
    showToast('Subscription renewed — active until ' + end, 5000);
    const { loadUserTenants } = await import('./portal.js');
    loadUserTenants();
  } catch (err) {
    if (errEl) errEl.textContent = err.message || 'Something went wrong. Try again.';
    if (btn) { btn.innerHTML = `Renew — <span id="renew-price-label">${price}</span>/mo`; btn.disabled = false; }
    _renewProcessing = false;
  }
}

export function initPayment() {
  document.getElementById('close-payment-modal')?.addEventListener('click', closePaymentModal);
  document.getElementById('payment-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget && !_paymentProcessing) closePaymentModal();
  });
  document.getElementById('pay-btn')?.addEventListener('click', confirmPayment);

  document.getElementById('close-renew-modal')?.addEventListener('click', closeRenewModal);
  document.getElementById('renew-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget && !_renewProcessing) closeRenewModal();
  });
  document.getElementById('renew-btn')?.addEventListener('click', confirmRenewal);
}
