// ════════════════════════════════════════════
// form.js — Multi-step form, plan selector, deploy submission
// ════════════════════════════════════════════
import { launchConfetti, setStep } from './animations.js';
import { loadPlatformStats } from './api.js';
import { showToast } from './utils.js';
import { apiFetch, authFetch } from '../lib/api-client.js';

// ── Instance name generator ──
const adj = ['cosmic', 'silent', 'blazing', 'frozen', 'velvet', 'neon', 'amber', 'crimson',
  'wild', 'lucky', 'swift', 'atomic', 'stellar', 'rusty', 'funky', 'hazy',
  'stormy', 'golden', 'hidden', 'mystic'];
const nounList = ['fox', 'wolf', 'orbit', 'signal', 'forge', 'pulse', 'spark', 'drift', 'prism',
  'blade', 'ghost', 'echo', 'flare', 'ridge', 'hatch', 'nexus', 'vault', 'storm',
  'pixel', 'comet'];
function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function genInstanceName() { return rnd(adj) + '-' + rnd(nounList) + '-' + (10 + Math.floor(Math.random() * 90)); }

// ── App state ──
let selectedPlan = 'starter';
let pollInterval = null;
let _deploying = false;

export let _paidPlan = '';
export let _paidIntentId = '';
export function setPaidState(plan, intentId) {
  _paidPlan = plan;
  _paidIntentId = intentId;
}

export function initForm() {
  const inameEl = document.getElementById('iname');
  if (inameEl && !inameEl.value) {
    inameEl.value = genInstanceName();
    updatePreview();
  }
  setFormStep(1);

  inameEl?.addEventListener('input', () => { sanitizeInstanceName(inameEl); updatePreview(); clearErrors(); });
  inameEl?.addEventListener('keydown', preventUppercase);
  document.getElementById('domain')?.addEventListener('input', () => { updatePreview(); clearErrors(); });
  document.getElementById('regen-btn')?.addEventListener('click', () => {
    if (inameEl) { inameEl.value = genInstanceName(); updatePreview(); clearErrors(); }
  });

  document.getElementById('next-step-1')?.addEventListener('click', () => nextStep(1));
  document.getElementById('next-step-2')?.addEventListener('click', () => nextStep(2));
  document.getElementById('prev-step-2')?.addEventListener('click', () => prevStep(2));
  document.getElementById('prev-step-3')?.addEventListener('click', () => prevStep(3));
  document.getElementById('submit-btn')?.addEventListener('click', handleSubmit);

  document.getElementById('plan-selector')?.addEventListener('click', e => {
    const opt = e.target.closest('.plan-opt');
    if (!opt || opt.classList.contains('disabled')) return;
    selectPlan(opt, opt.dataset.plan);
  });

  document.querySelectorAll('.pricing-card .plan-cta').forEach(btn => {
    btn.addEventListener('click', () => choosePlan(btn.dataset.plan));
  });

  document.getElementById('igit')?.addEventListener('input', toggleBranchField);

  document.getElementById('sc-copy-pass')?.addEventListener('click', function () {
    const pass = document.getElementById('sc-portal-pass')?.textContent;
    if (pass) copyTextEl(this, pass);
  });

  document.querySelectorAll('#step-1 input, #step-2 input, #step-3 input').forEach(el => {
    el.addEventListener('input', clearErrors);
  });

  // Auto-detect org domain from email (read-only display)
  const _PERSONAL = new Set([
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'icloud.com',
    'me.com', 'aol.com', 'protonmail.com', 'pm.me', 'zoho.com', 'yandex.com',
    'mail.com', 'gmx.com', 'fastmail.com', 'hey.com', 'tutanota.com',
  ]);
  document.getElementById('email')?.addEventListener('input', function () {
    const parts = this.value.trim().toLowerCase().split('@');
    const domEl = document.getElementById('company');
    if (!domEl) return;
    if (parts.length !== 2 || !parts[1].includes('.')) { domEl.value = ''; domEl.placeholder = 'detected from email…'; return; }
    const d = parts[1];
    if (_PERSONAL.has(d)) { domEl.value = ''; domEl.placeholder = 'personal email — private workspace'; }
    else { domEl.value = d; domEl.placeholder = d; }
  });
}

export function setFormStep(n) {
  document.querySelectorAll('.form-step').forEach((el, i) => {
    el.style.display = (i + 1 === n) ? 'block' : 'none';
  });
  document.querySelectorAll('.progress-step').forEach((el, i) => {
    el.classList.toggle('active', i + 1 === n);
    el.classList.toggle('completed', i + 1 < n);
  });
}

function nextStep(current) {
  clearErrors();
  if (current === 1) {
    const name = document.getElementById('name')?.value.trim();
    if (!name) { document.getElementById('err-name').textContent = 'Please enter your name.'; return; }
    const phone = document.getElementById('phone')?.value.trim();
    if (!phone) { document.getElementById('err-phone').textContent = 'Please enter your phone number.'; return; }
    const email = document.getElementById('email')?.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      document.getElementById('err-email').textContent = 'Please enter a valid email address.'; return;
    }
  }
  if (current === 2) {
    const tenant = document.getElementById('iname')?.value.trim().toLowerCase();
    if (!tenant) { document.getElementById('err-tenant').textContent = 'Instance name is required.'; return; }
    if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(tenant) || tenant.length < 3) {
      document.getElementById('err-tenant').textContent = 'Use lowercase letters, numbers, and hyphens only (min 3 chars).'; return;
    }
    const domain = document.getElementById('domain')?.value.trim().toLowerCase();
    if (domain && !/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(domain)) {
      document.getElementById('err-domain').textContent = 'Please enter a valid domain (e.g. cms.mycompany.com).'; return;
    }
  }
  setFormStep(current + 1);
}

function prevStep(current) { setFormStep(current - 1); }

function choosePlan(plan) {
  const opt = document.querySelector(`#plan-selector .plan-opt[data-plan="${plan}"]`);
  if (opt) selectPlan(opt, plan);
  // Highlight the selected pricing card
  document.querySelectorAll('.pricing-card').forEach(c => c.classList.remove('selected'));
  document.querySelector(`.pricing-card .plan-cta[data-plan="${plan}"]`)
    ?.closest('.pricing-card')
    ?.classList.add('selected');
  document.getElementById('start')?.scrollIntoView({ behavior: 'smooth' });
  setFormStep(1);
}

export function selectPlan(el, plan) {
  el.closest('.plan-selector')?.querySelectorAll('.plan-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  selectedPlan = plan;

  if (_paidPlan && _paidPlan !== plan) { _paidPlan = ''; _paidIntentId = ''; }

  const badge = document.getElementById('prev-badge');
  if (badge) {
    badge.textContent = plan.toUpperCase();
    badge.className = 'badge ' + (plan === 'starter' ? 'b-s' : plan === 'pro' ? 'b-p' : 'b-e');
  }

  const hpaSpan = document.getElementById('hpa-row')?.querySelector('span:last-child');
  if (hpaSpan) {
    hpaSpan.textContent = plan === 'enterprise' ? '✓' : '—';
    hpaSpan.style.color = plan === 'enterprise' ? 'var(--green)' : 'var(--faint)';
  }
}

function updatePreview() {
  const name = document.getElementById('iname')?.value.trim() || 'my-project';
  const domain = document.getElementById('domain')?.value.trim() || (name + '.justbots.tech');
  const n = document.getElementById('prev-name');
  const d = document.getElementById('prev-domain');
  if (n) n.textContent = name;
  if (d) d.textContent = domain;
}

function clearErrors() {
  ['err-email', 'err-tenant', 'err-domain', 'err-general', 'err-region', 'err-name', 'err-phone', 'err-company'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

function sanitizeInstanceName(el) {
  const v = el.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+/, '');
  if (el.value !== v) el.value = v;
}

function preventUppercase(e) {
  if (e.key && e.key.length === 1 && e.key >= 'A' && e.key <= 'Z') {
    e.preventDefault();
    const el = e.target;
    const start = el.selectionStart, end = el.selectionEnd;
    el.value = el.value.slice(0, start) + e.key.toLowerCase() + el.value.slice(end);
    el.setSelectionRange(start + 1, start + 1);
    updatePreview(); clearErrors();
  }
}

function toggleBranchField() {
  const repo = document.getElementById('igit')?.value.trim();
  const show = repo ? '' : 'none';
  ['git-branch-field', 'git-basedir-field', 'git-node-field'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = show;
  });
}

function colorLine(line) {
  const stripped = line.replace(/^\[.*?\]\s*/, '');
  if (/^(Tenant|Domain|Package|Email|Cluster):\s/.test(stripped)) return '';
  if (/Monitoring stack reachable|Infrastructure verified|Credentials generated/i.test(stripped)) return '';
  const safe = escHtml(line);
  if (line.includes('✓')) return `<span style="color:var(--green)">${safe}</span>`;
  if (line.includes('✗') || /error|failed/i.test(line)) return `<span style="color:var(--red)">${safe}</span>`;
  if (line.includes('━')) return `<span style="color:var(--accent3)">${safe}</span>`;
  if (line.includes('⚠')) return `<span style="color:var(--amber)">${safe}</span>`;
  return `<span>${safe}</span>`;
}

function pollJob(jobId, knownIngress) {
  let delay = 2000;
  async function tick() {
    try {
      const data = await authFetch('/api/status/' + jobId);
      if (!data.ingress && knownIngress) data.ingress = knownIngress;
      const logBody = document.getElementById('log-body');
      const badge = document.getElementById('log-status-badge');
      const btn = document.getElementById('submit-btn');

      if (logBody) logBody.innerHTML = data.log.map(colorLine).filter(Boolean).join('<br>');
      if (logBody) logBody.scrollTop = logBody.scrollHeight;

      if (data.status === 'done') {
        if (badge) { badge.textContent = 'live'; badge.style.background = 'rgba(34,197,94,0.12)'; badge.style.color = 'var(--green)'; }
        if (btn) { btn.textContent = 'Instance is live!'; btn.style.background = 'var(--green)'; btn.style.opacity = '0.7'; btn.disabled = true; btn.style.cursor = 'not-allowed'; }
        showSuccessCard(data);
        setStep(2);
        launchConfetti();
        loadPlatformStats();
        return;
      } else if (data.status === 'error') {
        if (badge) { badge.textContent = 'failed'; badge.style.background = 'rgba(239,68,68,0.12)'; badge.style.color = 'var(--red)'; }
        if (btn) { btn.textContent = 'Deployment failed — try again'; btn.style.background = 'var(--red)'; btn.style.opacity = '1'; btn.disabled = false; }
        return;
      }
    } catch (e) { console.error('Poll error:', e); }
    delay = Math.min(delay * 1.4, 10000);
    pollInterval = setTimeout(tick, delay);
  }
  pollInterval = setTimeout(tick, delay);
}

function showSuccessCard(data) {
  const r = data.result || {};
  const domain = data.domain;

  const portalSection = document.getElementById('sc-portal-section');
  if (r.portal_email) {
    const emailEl = document.getElementById('sc-portal-email');
    const passEl = document.getElementById('sc-portal-pass');
    const passRow = document.getElementById('sc-portal-pass-row');
    const passNote = document.getElementById('sc-portal-pass-note');
    const newNote = document.getElementById('sc-portal-new-note');
    if (emailEl) emailEl.textContent = r.portal_email;
    if (r.portal_password) {
      if (passEl) passEl.textContent = r.portal_password;
      if (passRow) passRow.style.display = '';
      if (passNote) passNote.style.display = 'none';
      if (newNote) newNote.textContent = "Save this password — it won't be shown again.";
    } else {
      if (passRow) passRow.style.display = 'none';
      if (passNote) passNote.style.display = '';
      if (newNote) newNote.textContent = '';
    }
    if (portalSection) portalSection.style.display = 'block';
  } else {
    if (portalSection) portalSection.style.display = 'none';
  }

  const ingress = data.ingress || '';
  const meta = window._provisionMeta || {};

  const cnameEl = document.getElementById('sc-cname');
  if (cnameEl) {
    if (meta.platform_domain && !meta.org_verified) {
      // Deployed to temp URL — show that as the live link, custom domain as the CNAME target
      cnameEl.innerHTML =
        '<span style="color:var(--amber);">Your instance is live at: ' +
        '<a href="https://' + escHtml(meta.platform_domain) + '" target="_blank" rel="noopener" style="color:var(--accent2);">' +
        escHtml(meta.platform_domain) + '</a></span>';
    } else {
      cnameEl.textContent = ingress
        ? domain + '  →  ' + ingress
        : domain + '  →  [contact support — hosting address pending]';
    }
  }

  // DNS verification instructions in the success card
  const dnsBox = document.getElementById('sc-dns-section');
  if (dnsBox) {
    if (meta.dns_token && !meta.org_verified) {
      document.getElementById('sc-dns-token').textContent = meta.dns_token;
      dnsBox.style.display = 'block';
    } else {
      dnsBox.style.display = 'none';
    }
  }

  const card = document.getElementById('success-card');
  if (card) { card.style.display = 'block'; card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function handleSubmit() {
  if (_deploying) return;
  const btn = document.getElementById('submit-btn');
  const name = document.getElementById('name')?.value.trim();
  const phone = document.getElementById('phone')?.value.trim();
  const email = document.getElementById('email')?.value.trim();
  const tenant = document.getElementById('iname')?.value.trim().toLowerCase();
  const domain = document.getElementById('domain')?.value.trim().toLowerCase();
  const gitRepo = document.getElementById('igit')?.value.trim();
  const gitBranch = document.getElementById('igit-branch')?.value.trim() || 'main';
  const gitBaseDir = document.getElementById('igit-basedir')?.value.trim();
  const gitNode = document.getElementById('igit-node')?.value || '22';
  clearErrors();

  let hasError = false;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById('err-email').textContent = 'Please enter a valid email address.';
    hasError = true;
  }
  if (!tenant) {
    document.getElementById('err-tenant').textContent = 'Instance name is required.';
    hasError = true;
  } else if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(tenant) || tenant.length < 3) {
    document.getElementById('err-tenant').textContent = 'Use lowercase letters, numbers, and hyphens only (min 3 chars).';
    hasError = true;
  }
  if (domain && !/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(domain)) {
    document.getElementById('err-domain').textContent = 'Please enter a valid domain (e.g. cms.mycompany.com).';
    hasError = true;
  }
  if (!window._selectedCluster) {
    document.getElementById('err-region').textContent = 'Please select a region.';
    hasError = true;
  }
  if (hasError) return;

  if (_paidPlan !== selectedPlan) {
    const { openPaymentModal } = await import('./payment.js');
    openPaymentModal(selectedPlan);
    return;
  }

  const orgNameEl = document.getElementById('org-name-input');
  const orgName = orgNameEl?.value.trim() || '';

  // org_domain is auto-detected from email (read-only field); send it so
  // the backend can resolve/create the correct corporate org.
  const orgDomain = (document.getElementById('company')?.value || '').trim().toLowerCase() || null;

  const payload = {
    name, phone, email, tenant,
    domain: domain || (tenant + '.justbots.tech'),
    package: selectedPlan,
    cluster_id: window._selectedCluster,
    payment_intent_id: _paidIntentId,
    org_domain: orgDomain,
  };
  if (orgName) payload.org_name = orgName;
  if (gitRepo) payload.git = { repo: gitRepo, branch: gitBranch, base_dir: gitBaseDir, node_version: gitNode };

  _deploying = true;
  if (btn) { btn.textContent = 'Deploying...'; btn.disabled = true; btn.style.opacity = '0.7'; }

  let data;
  try {
    data = await apiFetch('/api/provision', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (e) {
    let netMsg = 'Network error — please try again.';
    if (_paidIntentId) netMsg += ' Your payment is safe, click Retry Deploy.';
    document.getElementById('err-general').textContent = netMsg;
    if (btn) { btn.textContent = _paidIntentId ? 'Retry Deploy' : 'Deploy instance'; btn.disabled = false; btn.style.opacity = '1'; }
    _deploying = false;
    return;
  }

  if (!data.ok) {
    // ── Public email provider: need explicit org/project name ──
    if (data.public_email && data.errors?.org_name) {
      _showOrgNamePrompt(data.errors.org_name);
      if (btn) { btn.textContent = _paidIntentId ? 'Retry Deploy' : 'Deploy instance'; btn.disabled = false; btn.style.opacity = '1'; }
      _deploying = false;
      return;
    }
    // ── Starter plan trying to use custom domain ──
    if (data.upgrade_required) {
      const errEl = document.getElementById('err-domain');
      if (errEl) errEl.textContent = data.errors?.domain || 'Custom domains require Pro plan.';
      // Also flash an upgrade CTA near the submit button
      _showUpgradeCta('Custom domains are a Pro feature. Upgrade your plan to use your own domain.');
      if (btn) { btn.textContent = _paidIntentId ? 'Retry Deploy' : 'Deploy instance'; btn.disabled = false; btn.style.opacity = '1'; }
      _deploying = false;
      return;
    }
    // ── Plan instance limit reached ──
    if (data.limit_reached) {
      const msg = data.errors?.general || `Plan limit reached (${data.current_count}/${data.plan_limit} instances).`;
      document.getElementById('err-general').textContent = msg;
      _showUpgradeCta(msg);
      if (btn) { btn.textContent = _paidIntentId ? 'Retry Deploy' : 'Deploy instance'; btn.disabled = false; btn.style.opacity = '1'; }
      _deploying = false;
      return;
    }
    if (data.errors) {
      ['tenant', 'domain', 'email', 'name', 'phone', 'company', 'org_name'].forEach(k => {
        const el = document.getElementById('err-' + k);
        if (el && data.errors[k]) el.textContent = data.errors[k];
      });
      if (data.errors.general) {
        let msg = data.errors.general;
        if (_paidIntentId) msg += ' — your payment is safe, click Deploy to retry.';
        document.getElementById('err-general').textContent = msg;
      }
    }
    if (btn) { btn.textContent = _paidIntentId ? 'Retry Deploy' : 'Deploy instance'; btn.disabled = false; btn.style.opacity = '1'; }
    _deploying = false;
    return;
  }

  if (btn) btn.textContent = 'Setting up…';

  // Dynamic onboarding message: new org vs joining existing workspace
  const ctxBanner = document.getElementById('provision-context-banner');
  if (ctxBanner) {
    if (data.is_new_org) {
      ctxBanner.innerHTML = '<span style="color:var(--green);font-weight:600;">&#10003; Welcome to Strapi Orbit!</span> Your organisation has been created.';
    } else if (data.org_name) {
      ctxBanner.innerHTML = '<span style="color:var(--accent2);font-weight:600;">Joining ' + escHtml(data.org_name) + ' workspace.</span> Deploying to your team\'s fleet.';
    }
    ctxBanner.style.display = 'block';
  }

  // Show the temp platform URL immediately so they can start working
  if (data.platform_domain) {
    const tempUrlBanner = document.getElementById('temp-url-banner');
    const tempUrlLink = document.getElementById('temp-url-link');
    if (tempUrlBanner && tempUrlLink) {
      tempUrlLink.href = 'https://' + data.platform_domain;
      tempUrlLink.textContent = data.platform_domain;
      tempUrlBanner.style.display = 'block';
    }
  }

  const drawer = document.getElementById('log-drawer');
  if (drawer) { drawer.style.display = 'block'; drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  setStep(1);

  // Store dns_token on window so pollJob can render it in the success card
  window._provisionMeta = {
    platform_domain: data.platform_domain || null,
    dns_token: data.dns_token || null,
    org_verified: data.org_verified || false,
    is_new_org: data.is_new_org || false,
    org_name: data.org_name || '',
  };

  pollJob(data.job_id, data.ingress || '');
}

function copyTextEl(el, text) {
  navigator.clipboard.writeText(text).catch(() => { });
  const orig = el.textContent;
  el.textContent = 'copied!';
  el.classList.add('copied');
  setTimeout(() => { el.textContent = orig; el.classList.remove('copied'); }, 1500);
}

// ── Plan upgrade CTA ──────────────────────────────────────────────────────────
// Shown when the user hits a plan gate (custom domain on Starter, instance limit).
// Renders a dismissible banner with a link to the pricing section.
function _showUpgradeCta(message) {
  let box = document.getElementById('upgrade-cta-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'upgrade-cta-box';
    box.style.cssText = [
      'background:rgba(139,92,246,0.08)',
      'border:1px solid rgba(139,92,246,0.35)',
      'border-radius:8px',
      'padding:14px 16px',
      'margin-top:12px',
      'display:flex',
      'align-items:flex-start',
      'gap:12px',
    ].join(';');
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn?.parentNode) submitBtn.parentNode.insertBefore(box, submitBtn);
    else document.getElementById('step-3')?.appendChild(box);
  }
  box.innerHTML = [
    '<span style="font-size:20px;flex-shrink:0;">&#x2B06;</span>',
    '<div style="flex:1;">',
    '<p style="margin:0 0 8px;font-size:13px;color:var(--accent);">' + escHtml(message) + '</p>',
    '<a href="#pricing" style="font-size:12px;color:var(--accent2);text-decoration:underline;">View upgrade options &rarr;</a>',
    '</div>',
    '<button onclick="this.parentNode.style.display=\'none\'" style="background:none;border:none;color:var(--faint);cursor:pointer;font-size:16px;flex-shrink:0;">&#x2715;</button>',
  ].join('');
  box.style.display = 'flex';
}

// ── Public email: org name prompt ─────────────────────────────────────────────
// When the backend returns public_email=true, inject a prompt asking for the
// project/org name into the form so the user can supply it and retry.
function _showOrgNamePrompt(message) {
  let box = document.getElementById('org-name-prompt-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'org-name-prompt-box';
    box.className = 'field';
    box.style.cssText = 'margin-top:0;padding:14px 16px 16px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.28);';
    box.innerHTML =
      '<label style="color:var(--amber,#f59e0b);letter-spacing:1px;margin-bottom:8px;display:block;">' +
      'ORGANIZATION / PROJECT NAME' +
      '</label>' +
      '<p style="margin:0 0 10px;font-size:12px;color:var(--muted);">' +
      escHtml(message) +
      '</p>' +
      '<input id="org-name-input" type="text" autocomplete="organization" ' +
      'placeholder="e.g. Acme Corp, My SaaS, Personal Blog">' +
      '<div id="err-org_name" class="field-error" style="margin-top:6px;"></div>';

    // Insert before the button row inside step-3
    const btnRow = document.querySelector('#step-3 .field-row');
    if (btnRow) {
      btnRow.parentNode.insertBefore(box, btnRow);
    } else {
      document.getElementById('step-3')?.appendChild(box);
    }
  }
  box.style.display = 'block';
  document.getElementById('org-name-input')?.focus();
}

// ── CNAME propagation check ───────────────────────────────────────────────────
// Called from the DNS banner's "Check Propagation" button in the portal.
// Hits the backend CNAME check endpoint and updates the button state.
export async function checkCnamePropagation(orgId, domain, btnEl) {
  if (!orgId) return;
  const orig = btnEl?.textContent;
  if (btnEl) { btnEl.textContent = 'Checking…'; btnEl.disabled = true; }
  try {
    const { authFetch: _af } = await import('../lib/api-client.js');
    const data = await _af(`/api/v1/orgs/${orgId}/check-cname`, {
      method: 'POST',
      body: JSON.stringify({ domain }),
    });
    if (btnEl) { btnEl.textContent = orig; btnEl.disabled = false; }
    if (data.pointed) {
      showToast('CNAME propagated! You can now verify your domain.', 'success');
    } else {
      showToast(data.message || 'CNAME not yet propagated — DNS changes can take up to 48h.', 'warn');
    }
    return data;
  } catch (e) {
    if (btnEl) { btnEl.textContent = orig; btnEl.disabled = false; }
    showToast('Could not check CNAME — please try again.', 'error');
  }
}
