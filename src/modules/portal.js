// ════════════════════════════════════════════
// portal.js — User login, tenant management
// ════════════════════════════════════════════
import { timeAgo, copyText, escJs, escHtml, togglePw, showToast } from './utils.js';
import { openRenewModal } from './payment.js';
import { authFetch, apiFetch, API_BASE, setAccessToken, getAccessToken, clearAccessToken, tryRestoreSession } from '../lib/api-client.js';

// ── Helpers ──
function confirmDialog(title, message, confirmText = 'Confirm', danger = false) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:380px;">
        <div class="modal-title">${title}</div>
        <div class="modal-sub">${message}</div>
        <div class="modal-actions">
          <button class="modal-cancel" id="cd-cancel">Cancel</button>
          <button class="modal-confirm" id="cd-confirm" style="background:${danger ? 'var(--red)' : 'var(--accent)'}">${confirmText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const cleanup = (val) => { modal.remove(); resolve(val); };
    modal.querySelector('#cd-cancel').onclick = () => cleanup(false);
    modal.querySelector('#cd-confirm').onclick = () => cleanup(true);
    modal.onclick = (e) => { if (e.target === modal) cleanup(false); };
  });
}

// _portalToken is now stored in api-client memory via setAccessToken/getAccessToken.
// No localStorage — the HttpOnly refresh cookie handles persistence.
let _currentOrgs = [];  // org list from login/me response
let _activeOrg   = null; // currently selected org context
let _inviteToken = null; // B-14: invitation token from URL

export function initPortal() {
  document.getElementById('portal-login-btn')?.addEventListener('click', portalLogin);
  document.getElementById('portal-email')?.addEventListener('keydown', e => { if (e.key === 'Enter') portalLogin(); });
  document.getElementById('portal-pass')?.addEventListener('keydown',  e => { if (e.key === 'Enter') portalLogin(); });
  document.getElementById('portal-pw-toggle')?.addEventListener('click', function() { togglePw('portal-pass', this); });

  document.getElementById('portal-reg-btn')?.addEventListener('click', portalRegister);
  document.getElementById('show-signup-btn')?.addEventListener('click', () => {
    document.getElementById('login-fields').style.display = 'none';
    document.getElementById('signup-fields').style.display = 'block';
  });

  // Auto-detect org domain from email (read-only — user cannot override)
  const _PERSONAL_DOMAINS = new Set([
    'gmail.com','yahoo.com','hotmail.com','outlook.com','live.com','icloud.com',
    'me.com','aol.com','protonmail.com','pm.me','zoho.com','yandex.com',
    'mail.com','gmx.com','fastmail.com','hey.com','tutanota.com',
  ]);
  document.getElementById('portal-reg-email')?.addEventListener('input', function() {
    const parts = this.value.trim().toLowerCase().split('@');
    const orgEl = document.getElementById('portal-reg-org');
    if (!orgEl) return;
    if (parts.length !== 2 || !parts[1].includes('.')) { orgEl.value = ''; return; }
    const domain = parts[1];
    orgEl.value = _PERSONAL_DOMAINS.has(domain) ? '' : domain;
  });
  document.getElementById('show-login-btn')?.addEventListener('click', () => {
    document.getElementById('login-fields').style.display = 'block';
    document.getElementById('signup-fields').style.display = 'none';
  });

  document.getElementById('portal-logout-btn')?.addEventListener('click', portalLogout);
  document.getElementById('refresh-tenants-btn')?.addEventListener('click', loadUserTenants);
  document.getElementById('change-pass-btn')?.addEventListener('click', openChangePassword);
  document.getElementById('forgot-pass-btn')?.addEventListener('click', openForgotModal);

  document.getElementById('close-change-pass')?.addEventListener('click', closeChangePassword);
  document.getElementById('change-pass-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeChangePassword();
  });
  document.getElementById('cp-btn')?.addEventListener('click', submitChangePassword);
  document.getElementById('cp-confirm')?.addEventListener('input', checkPwMatch);
  document.getElementById('cp-confirm')?.addEventListener('keydown', e => { if (e.key === 'Enter') submitChangePassword(); });

  document.querySelectorAll('.pw-toggle[data-target]').forEach(btn => {
    btn.addEventListener('click', function() { togglePw(this.dataset.target, this); });
  });

  document.getElementById('close-forgot-modal')?.addEventListener('click', closeForgotModal);
  document.getElementById('forgot-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeForgotModal();
  });
  document.getElementById('forgot-submit-btn')?.addEventListener('click', submitForgot);
  document.getElementById('forgot-email')?.addEventListener('keydown', e => { if (e.key === 'Enter') submitForgot(); });

  document.getElementById('reset-submit-btn')?.addEventListener('click', submitReset);
  document.getElementById('reset-pass1')?.addEventListener('keydown', e => { if (e.key === 'Enter') submitReset(); });
  document.getElementById('reset-pass2')?.addEventListener('keydown', e => { if (e.key === 'Enter') submitReset(); });

  document.addEventListener('api:forbidden', () => {
    showToast('You do not have the required permissions for this action.', 'error');
  });

  // Handle Invitation Token (B-14)
  const urlParams = new URLSearchParams(window.location.search);
  _inviteToken = urlParams.get('invite');
  if (_inviteToken) {
    const notice = document.getElementById('invite-notice');
    if (notice) notice.style.display = 'block';
    // Smooth scroll to portal if token present
    setTimeout(() => {
      document.getElementById('manage')?.scrollIntoView({ behavior: 'smooth' });
    }, 500);
  }

  (async function restoreSession() {
    // Attempt to restore session using the HttpOnly refresh cookie.
    // No localStorage read needed — tryRestoreSession() calls /api/auth/refresh.
    const sessionData = await tryRestoreSession();
    if (sessionData && sessionData.ok) {
      _currentOrgs = sessionData.orgs || [];
      _activeOrg   = _currentOrgs[0] || null;
      showPortal(sessionData.email);
      loadUserTenants();
    }
  })();
}

// ── Auth ──
async function portalLogin() {
  const email = (document.getElementById('portal-email')?.value || '').trim().toLowerCase();
  const pass  = (document.getElementById('portal-pass')?.value  || '').trim();
  const err   = document.getElementById('portal-err');
  const btn   = document.getElementById('portal-login-btn');
  if (err) err.textContent = '';
  if (!email || !pass) { if (err) err.textContent = 'Email and password required.'; return; }
  if (btn) { btn.textContent = 'Signing in…'; btn.disabled = true; }
  try {
    const payload = { email, password: pass };
    if (_inviteToken) payload.invite_token = _inviteToken;

    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!data.ok) {
      if (err) err.textContent = data.error || 'Invalid credentials.';
      document.getElementById('portal-pass').value = '';
      document.getElementById('portal-pass').focus();
      if (btn) { btn.textContent = 'Sign in'; btn.disabled = false; }
      return;
    }
    setAccessToken(data.access_token || data.token);
    _currentOrgs = data.orgs || [];
    
    // If invited, try to find that org specifically
    if (data.invited_org_id) {
       _activeOrg = _currentOrgs.find(o => o.id === data.invited_org_id) || _currentOrgs[0];
       showToast('Organization joined successfully!', 'success');
       // Remove invite from URL
       history.replaceState(null, '', window.location.pathname);
    } else {
       _activeOrg = _currentOrgs[0] || null;
    }

    if (btn) { btn.textContent = 'Sign in'; btn.disabled = false; }
    showPortal(data.email);
    loadUserTenants();
  } catch (e) {
    if (err) err.textContent = 'Request failed.';
    if (btn) { btn.textContent = 'Sign in'; btn.disabled = false; }
  }
}

async function portalRegister() {
  const name      = (document.getElementById('portal-reg-name')?.value  || '').trim();
  const email     = (document.getElementById('portal-reg-email')?.value || '').trim().toLowerCase();
  const pass      = (document.getElementById('portal-reg-pass')?.value  || '').trim();
  const orgDomain = (document.getElementById('portal-reg-org')?.value   || '').trim().toLowerCase();
  const err       = document.getElementById('portal-reg-err');
  const btn       = document.getElementById('portal-reg-btn');

  if (err) err.textContent = '';
  if (!email || !pass) { if (err) err.textContent = 'Email and password required.'; return; }
  if (pass.length < 8) { if (err) err.textContent = 'Password must be at least 8 characters.'; return; }

  // Validate domain format if provided
  if (orgDomain && !/^[a-z0-9]([a-z0-9\-\.]{0,251}[a-z0-9])?$/.test(orgDomain)) {
    if (err) err.textContent = 'Enter a valid domain (e.g. company.com).';
    return;
  }

  if (btn) { btn.textContent = 'Creating account…'; btn.disabled = true; }
  try {
    const payload = { email, password: pass, name, org_domain: orgDomain || null };
    if (_inviteToken) payload.invite_token = _inviteToken;

    const data = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!data.ok) {
      if (err) err.textContent = data.error || (data.errors ? Object.values(data.errors)[0] : 'Registration failed.');
      if (btn) { btn.textContent = 'Create Account'; btn.disabled = false; }
      return;
    }
    setAccessToken(data.access_token || data.token);
    _currentOrgs = data.org ? [data.org] : [];
    _activeOrg   = data.org || null;
    
    if (data.invited_org_id) {
       showToast('Account created and organization joined!', 'success');
       history.replaceState(null, '', window.location.pathname);
    }

    if (btn) { btn.textContent = 'Create Account'; btn.disabled = false; }
    showPortal(data.email);
    loadUserTenants();
  } catch (e) {
    if (err) err.textContent = 'Request failed.';
    if (btn) { btn.textContent = 'Create Account'; btn.disabled = false; }
  }
}

function showPortal(email) {
  document.getElementById('portal-login').style.display  = 'none';
  document.getElementById('user-portal').style.display   = '';
  const emailEl = document.getElementById('portal-user-email');
  if (emailEl) emailEl.textContent = email;
  renderOrgSwitcher();
  _startAutoRefresh();
}

function renderOrgSwitcher() {
  const el = document.getElementById('org-switcher');
  if (!el) return;
  if (!_currentOrgs.length) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  const cur = _activeOrg || _currentOrgs[0];
  if (_currentOrgs.length === 1) {
    el.innerHTML = `<span style="font-size:11px;color:var(--muted);">Org: <strong style="color:var(--text);">${escJs(cur.name || cur.org_name || '')}</strong></span>`;
    return;
  }
  el.innerHTML =
    `<label style="font-size:11px;color:var(--muted);margin-right:6px;">Org:</label>` +
    `<select id="org-switcher-sel" style="font-size:12px;background:var(--bg-surface);border:1px solid var(--border);color:var(--text);padding:3px 8px;border-radius:var(--radius-xs);cursor:pointer;">` +
    _currentOrgs.map(o =>
      `<option value="${escJs(o.id || o.org_id || '')}"${(o.id || o.org_id) === (cur.id || cur.org_id) ? ' selected' : ''}>${escJs(o.name || o.org_name || '')}</option>`
    ).join('') +
    `</select>`;
  document.getElementById('org-switcher-sel')?.addEventListener('change', function() {
    const orgId = this.value;
    _activeOrg = _currentOrgs.find(o => (o.id || o.org_id) === orgId) || null;
    loadUserTenants();
  });
}

async function portalLogout() {
  _stopAutoRefresh();
  // Call backend to invalidate session + revoke refresh cookie serverside
  await authFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  clearAccessToken();
  document.getElementById('portal-login').style.display = '';
  document.getElementById('user-portal').style.display  = 'none';
  const emailEl = document.getElementById('portal-email');
  const passEl  = document.getElementById('portal-pass');
  if (emailEl) emailEl.value = '';
  if (passEl)  passEl.value  = '';
}

// ── Tenant list ──
// silent=true: background auto-refresh — no loading flash, no entrance animations,
// skips if the user is mid-edit in any env/team input, restores open tabs after render.
export async function loadUserTenants(silent = false) {
  const list  = document.getElementById('user-tenant-list');
  const count = document.getElementById('user-tenant-count');
  if (!list) return;

  if (silent) {
    // Do not disrupt active user input
    const editing = el => el.value.trim() !== '' || el === document.activeElement;
    const busyEnv  = Array.from(document.querySelectorAll('[id^="env-key-"],[id^="env-val-"]')).some(editing);
    const busyTeam = Array.from(document.querySelectorAll('[id^="team-email-"]')).some(editing);
    if (busyEnv || busyTeam) return;
  } else {
    list.innerHTML = '<div style="padding:24px 0;color:var(--muted);font-size:13px;">Loading your instances...</div>';
  }

  try {
    const data = await authFetch('/api/my/tenants');
    if (!data.ok) {
      if (data.error === 'Unauthorized' || data.error === 'Invalid token') { portalLogout(); return; }
      if (!silent) list.innerHTML = '<div style="padding:20px 0;color:var(--red);font-size:13px;">Error loading instances.</div>';
      return;
    }
    const ts = data.tenants || [];
    if (count) count.textContent = ts.length + ' instance' + (ts.length !== 1 ? 's' : '');
    if (!ts.length) {
      list.innerHTML = '<div style="padding:24px 0;color:var(--muted);font-size:13px;">No instances yet. Deploy your first instance above!</div>';
      return;
    }
    list.innerHTML = ts.map((t, i) => {
      const html = renderTenantCard(t, i);
      // Staggered entrance animation only on the initial (non-silent) render
      return silent ? html : html.replace('class="instance-card"', `class="instance-card" style="animation-delay:${i * 0.1}s"`);
    }).join('');
    bindTenantCardEvents(ts);

    // is-viewer body class — applied when ALL tenants are viewer-only
    const allViewer = ts.every(t => (t.org_role || 'owner') === 'viewer');
    document.body.classList.toggle('is-viewer', allViewer);

    // auto-promote polling — for each unverified org, poll until verified
    _startDnsPolling(ts);

    // On silent refresh, restore whichever tab the user had open
    if (silent) _restoreTabState(ts);
  } catch (e) {
    if (!silent) list.innerHTML = '<div style="padding:20px 0;color:var(--red);font-size:13px;">Failed to load instances.</div>';
  }
}

// Role helpers — single source of truth for permission checks in the UI.
// Mirrors the backend hierarchy: owner > admin > member > viewer
const ROLE_RANK = { owner: 4, admin: 3, member: 2, viewer: 1 };
function _atLeast(role, required) {
  return (ROLE_RANK[role] || 0) >= (ROLE_RANK[required] || 99);
}

function renderTenantCard(t, i) {
  const tid       = 'tc' + i;
  const role      = t.org_role || 'owner';            // owner fallback for legacy tenants
  const canOperate = _atLeast(role, 'member');         // deploy, rollback, backup, env, git
  const canRemove  = _atLeast(role, 'admin');          // destructive — admin + owner only
  const canBill    = _atLeast(role, 'admin');          // billing, renew
  const readOnly   = !canOperate;                      // viewer

  const planBadge = t.package === 'starter' ? 'pb-starter' : t.package === 'pro' ? 'pb-pro' : 'pb-enterprise';
  const dotColor  = t.healthy ? 'var(--green)' : 'var(--amber)';
  const ago       = t.provisioned_at ? timeAgo(t.provisioned_at) : '';

  // Show the active URL: platform temp domain while DNS is unverified, custom domain once live
  const hasPlatformDomain = t.platform_domain && !t.is_custom_domain_active;
  const activeHost = hasPlatformDomain ? t.platform_domain : (t.domain || '');
  const url        = activeHost ? 'https://' + activeHost : '';

  // Role badge shown in the card header so the user knows their access level
  const roleBadge = role === 'viewer'
    ? `<span class="plan-badge" style="color:var(--muted);border-color:var(--border);background:transparent;font-size:9px;letter-spacing:1px;">VIEW ONLY</span>`
    : role !== 'owner'
    ? `<span class="plan-badge" style="color:var(--faint);border-color:var(--border);background:transparent;font-size:9px;letter-spacing:1px;">${role.toUpperCase()}</span>`
    : '';

  // ── Plan-aware banners ────────────────────────────────────────────────
  const isOwner    = role === 'owner';
  const isStarter  = (t.package || 'starter') === 'starter';
  const isPro      = t.package === 'pro';
  const isEnterprise = t.package === 'enterprise';

  // Starter: replace DNS banner with "Upgrade to Pro" CTA (no custom domain on Starter)
  const showUpgradeBanner = isStarter && isOwner;
  // Pro/Enterprise: show DNS banner when org domain is pending verification.
  // Shown to owners AND admins (admins can at least see/share the token).
  // Show even when dns_token is missing — surface a contact prompt rather than hiding.
  const showDnsBanner = !isStarter && t.org_id && !t.org_verified && canBill;

  const dnsBanner = showUpgradeBanner ? `
    <div class="dns-verify-banner" id="dns-banner-${tid}">
      <div class="dns-verify-icon" style="font-size:20px;">&#x2B06;</div>
      <div class="dns-verify-body">
        <div class="dns-verify-title">Your instance is on a platform subdomain</div>
        <div class="dns-verify-subtitle">
          Starter plan instances run on <strong>${escJs(activeHost)}</strong>.
          Upgrade to <strong>Pro</strong> to use your own domain (e.g. <code>cms.yourcompany.com</code>),
          invite your team, and get up to 5 instances under one org.
        </div>
        <div style="margin-top:12px;">
          <button class="pact pact-primary" onclick="window.location.hash='pricing'">&#x2B06; Upgrade to Pro</button>
        </div>
      </div>
    </div>`
  : showDnsBanner ? `
    <div class="dns-verify-banner" id="dns-banner-${tid}">
      <div class="dns-verify-icon">&#x1F512;</div>
      <div class="dns-verify-body">
        <div class="dns-verify-title">Custom domain pending DNS verification</div>
        <div class="dns-verify-subtitle">
          Your instance is running at <strong>${escJs(t.platform_domain || t.tenant + '.justbots.tech')}</strong> until you verify ownership of <strong>${escJs(t.root_domain || t.domain)}</strong>.
        </div>
        ${t.dns_token ? `
        <div class="dns-verify-instruction">Add this TXT record to your DNS zone for <code>${escJs(t.root_domain || t.domain)}</code>:</div>
        <div class="dns-verify-token" id="dns-token-${tid}">
          <code>${escJs(t.dns_token)}</code>
          <button class="dns-copy-btn" data-copy="${escJs(t.dns_token)}" title="Copy to clipboard">&#x2398;</button>
        </div>
        <div style="margin-top:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          ${isOwner ? `<button class="pact pact-primary dns-verify-btn" data-orgid="${escJs(t.org_id)}" data-tid="${tid}">Verify DNS</button>` : ''}
          <button class="pact dns-cname-check-btn" data-orgid="${escJs(t.org_id)}" data-domain="${escJs(t.domain || '')}" data-tid="${tid}" title="Check if your CNAME is pointing to our platform">&#x1F50D; Check Propagation</button>
          <span id="dns-verify-msg-${tid}" style="font-size:12px;font-family:'Source Code Pro','SFMono-Regular','DM Mono',monospace;"></span>
        </div>` : `
        <div style="margin-top:8px;font-size:12px;color:var(--amber);font-family:'Source Code Pro','SFMono-Regular','DM Mono',monospace;">
          &#9888; DNS token not generated for this org — contact support to receive your TXT record.
        </div>`}
      </div>
    </div>` : '';

  return `<div class="instance-card" id="card-${tid}" style="--accent-health:${dotColor}">
    <div class="instance-card-header">
      <div class="instance-card-identity">
        <div class="instance-card-name">
          <span class="status-glow-wrap"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dotColor};flex-shrink:0;"></span></span>
          ${escHtml(t.tenant)}
          <span class="plan-badge ${planBadge}">${(t.package || 'STARTER').toUpperCase()}</span>
          ${roleBadge}
        </div>
        <div class="instance-card-meta">
          ${url ? `<a href="${url}" target="_blank" rel="noopener" style="color:${hasPlatformDomain ? 'var(--amber)' : 'var(--accent2)'};font-size:11px;font-family:'Source Code Pro','SFMono-Regular','DM Mono',monospace;">${activeHost}</a>` : ''}
          ${hasPlatformDomain ? `<span style="font-size:10px;color:var(--amber);letter-spacing:0.5px;" title="Custom domain ${escJs(t.domain)} pending DNS verification">&#x29D6; DNS pending</span>` : ''}
          ${ago ? `<span>·</span><span>${ago}</span>` : ''}
          <span id="health-text-${tid}" style="color:${dotColor};">${t.healthy ? 'Healthy' : 'Degraded'}</span>
          <span id="deploy-line-${tid}" style="font-size:11px;color:var(--muted);">${t.last_deploy_at ? 'Deployed ' + timeAgo(t.last_deploy_at) : ''}</span>
        </div>
      </div>
      <div class="instance-card-actions">
        <button class="pact${!canOperate ? ' disabled-ui' : ''}" id="deploy-btn-${tid}" data-tenant="${escJs(t.tenant)}" data-tid="${tid}"${!canOperate ? ' disabled title="Member rank or above required"' : ''}>Deploy</button>
        ${t.previous_image ? `<button class="pact pact-warn${!canOperate ? ' disabled-ui' : ''}" id="rollback-btn-${tid}" data-tenant="${escJs(t.tenant)}" data-tid="${tid}" data-image="${escJs(t.previous_image)}"${!canOperate ? ' disabled title="Member rank or above required"' : ''}>&#x21A9; Rollback</button>` : ''}
        ${canRemove ? `<button class="pact pact-danger" data-action="remove" data-tenant="${escJs(t.tenant)}" data-tid="${tid}">Remove</button>` : ''}
      </div>
    </div>
    ${dnsBanner}

    <div class="instance-tabs" id="tabs-${tid}">
      <button class="itab active" data-tab="overview"     data-tid="${tid}" data-tenant="${escJs(t.tenant)}">Overview</button>
      <button class="itab"        data-tab="monitoring"   data-tid="${tid}" data-tenant="${escJs(t.tenant)}">Monitoring</button>
      <button class="itab" data-tab="deployments" data-tid="${tid}" data-tenant="${escJs(t.tenant)}">Deployments</button>
      <button class="itab" data-tab="git"         data-tid="${tid}" data-tenant="${escJs(t.tenant)}">Git</button>
      <button class="itab" data-tab="env"         data-tid="${tid}" data-tenant="${escJs(t.tenant)}">Environment</button>
      <button class="itab" data-tab="backups"     data-tid="${tid}" data-tenant="${escJs(t.tenant)}">Backups</button>
      ${!isStarter && canBill && t.org_id ? `<button class="itab" data-tab="team" data-tid="${tid}" data-tenant="${escJs(t.tenant)}" data-orgid="${escJs(t.org_id)}">Team</button>` : ''}
      ${isStarter && canBill ? `<button class="itab" data-tab="team" data-tid="${tid}" data-tenant="${escJs(t.tenant)}" style="color:var(--faint);cursor:pointer;" title="Upgrade to Pro to access team management">Team &#x1F512;</button>` : ''}
    </div>
    <div class="itab-panel active" id="panel-overview-${tid}">${renderOverviewPanel(t, tid, canBill)}</div>
    <div class="itab-panel" id="panel-monitoring-${tid}">${renderMonitoringPanel(t, tid)}</div>
    <div class="itab-panel" id="panel-deployments-${tid}"><div id="builds-list-${tid}" class="data-list"></div></div>
    <div class="itab-panel" id="panel-git-${tid}">${renderGitPanel(t, tid, canOperate)}</div>
    <div class="itab-panel" id="panel-env-${tid}">${renderEnvPanel(t, tid, canOperate)}</div>
    <div class="itab-panel" id="panel-backups-${tid}">
      <div id="backups-list-${tid}" class="data-list"></div>
      <div style="padding:24px;border-top:1px solid var(--border);text-align:right;">
        <button class="pact pact-primary${!canOperate ? ' disabled-ui' : ''}" id="backup-btn-${tid}" data-tenant="${escJs(t.tenant)}" data-tid="${tid}"${!canOperate ? ' disabled title="Member rank or above required"' : ''}>Export now</button>
      </div>
    </div>
    ${isStarter && canBill ? `
    <div class="itab-panel" id="panel-team-${tid}">
      <div style="padding:32px 24px;text-align:center;">
        <div style="font-size:32px;margin-bottom:12px;">&#x1F465;</div>
        <div style="font-size:15px;font-weight:500;margin-bottom:8px;">Team management requires Pro</div>
        <div style="font-size:13px;color:var(--muted);max-width:380px;margin:0 auto 20px;">
          Starter is a solo workspace. Upgrade to <strong>Pro</strong> to invite teammates,
          manage roles, and deploy up to 5 instances under a verified corporate domain.
        </div>
        <button class="pact pact-primary" onclick="window.location.hash='pricing'" style="background:var(--accent);border-color:var(--accent);">&#x2B06; Upgrade to Pro</button>
      </div>
    </div>` : ''}
    ${!isStarter && canBill && t.org_id ? `
    <div class="itab-panel" id="panel-team-${tid}">
      <!-- ── Team members ─────────────────────────────────────── -->
      <div style="padding:20px 24px 0;">
        <div style="font-size:13px;font-weight:500;color:var(--text);margin-bottom:4px;">Team members</div>
        <div style="font-size:12px;color:var(--muted);">Everyone with access to this organisation.</div>
      </div>
      <div id="team-list-${tid}" style="margin:12px 0 0;"></div>

      <!-- ── Invite new member ─────────────────────────────────── -->
      <div style="padding:20px 24px;border-top:1px solid var(--border);margin-top:4px;">
        <div style="font-size:13px;font-weight:500;color:var(--text);margin-bottom:4px;">Invite member</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:14px;">Send an invitation by email. They'll be added automatically on sign-up.</div>
        <div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;">
          <input class="env-input" id="team-email-${tid}" type="email" placeholder="colleague@company.com" style="min-width:0;">
          <select class="env-input" id="team-role-${tid}" style="width:110px;">
            <option value="viewer">Viewer</option>
            <option value="member" selected>Member</option>
            <option value="developer">Developer</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </select>
          <button class="pact pact-primary" data-action="invite-member" data-tid="${tid}" data-tenant="${escJs(t.tenant)}" data-orgid="${escJs(t.org_id)}">Invite</button>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:10px;">
          <input type="checkbox" id="team-scope-${tid}" style="width:14px;height:14px;accent-color:var(--accent);cursor:pointer;flex-shrink:0;">
          <label for="team-scope-${tid}" style="font-size:11px;color:var(--muted);cursor:pointer;user-select:none;line-height:1.4;">Restrict to this instance only (hides other instances in this org)</label>
        </div>
        <div id="team-err-${tid}" style="font-size:12px;color:var(--red);min-height:16px;margin-top:8px;"></div>
      </div>

      <!-- ── Transfer ownership ─────────────────────────────────── -->
      ${(t.is_instance_owner || ROLE_RANK[role] >= 3) ? `
      <div style="padding:20px 24px;border-top:1px solid var(--border);">
        <div style="font-size:13px;font-weight:500;color:var(--text);margin-bottom:4px;">Transfer ownership</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:14px;">Hand full control to another org member. You retain your current role after transfer.</div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;">
          <select class="env-input" id="transfer-to-${tid}" style="min-width:0;font-family:'Source Code Pro','SFMono-Regular','DM Mono',monospace;">
            <option value="">— select member —</option>
          </select>
          <button class="pact pact-danger" data-action="transfer-instance" data-tid="${tid}" data-tenant="${escJs(t.tenant)}" data-orgid="${escJs(t.org_id)}">Transfer</button>
        </div>
        <div id="transfer-err-${tid}" style="font-size:12px;color:var(--red);min-height:16px;margin-top:8px;"></div>
      </div>` : ''}
      ${isEnterprise && isOwner ? `
      <div style="padding:20px 24px;border-top:1px solid var(--border);">
        <div style="font-size:10px;color:var(--faint);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Domain Management</div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:12px;">Enterprise orgs can verify multiple root domains under one billing account.</div>
        <div id="extra-domains-list-${tid}" style="margin-bottom:12px;"></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
          <input class="env-input" id="extra-domain-input-${tid}" type="text" placeholder="e.g. successive.digital" style="flex:2;min-width:180px;font-family:'Source Code Pro','SFMono-Regular','DM Mono',monospace;">
          <button class="pact pact-primary" data-action="add-domain" data-tid="${tid}" data-orgid="${escJs(t.org_id)}">Add Domain</button>
        </div>
        <div id="extra-domain-err-${tid}" style="font-size:12px;color:var(--red);min-height:16px;margin-top:8px;font-family:'Source Code Pro','SFMono-Regular','DM Mono',monospace;"></div>
      </div>` : ''}
    </div>` : ''}
  </div>`;
}

function renderOverviewPanel(t, tid, canBill) {
  const url = t.domain ? 'https://' + t.domain : '';

  // Map every possible sub_status → {label, badge class}
  const STATUS_MAP = {
    active:        { label: 'Active',         cls: 'sb-active'   },
    free:          { label: 'Free',           cls: 'sb-active'   },
    expiring_soon: { label: 'Expiring Soon',  cls: 'sb-expiring' },
    expired:       { label: 'Expired',        cls: 'sb-expired'  },
    suspended:     { label: 'Suspended',      cls: 'sb-expired'  },
    inactive:      { label: 'Inactive',       cls: 'sb-pending'  },
    cancelled:     { label: 'Cancelled',      cls: 'sb-expired'  },
    past_due:      { label: 'Past Due',       cls: 'sb-expiring' },
  };
  const s      = STATUS_MAP[t.sub_status] || { label: (t.sub_status || 'Unknown').toUpperCase(), cls: 'sb-pending' };
  const ends   = t.period_end ? t.period_end.substring(0, 10) : null;
  // Free-tier tenants have no expiry — show "No expiry" rather than "—"
  const endsDisplay = ends ? ends
                    : (t.sub_status === 'free') ? 'No expiry'
                    : '—';

  return `<div class="data-list">
    <div class="data-pair">
      <span class="dp-lbl">Admin Console</span>
      <span class="dp-val">
        ${url ? `
          <a href="${url}/admin" target="_blank" style="display:flex;align-items:center;gap:6px;">
            ${url}/admin
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
          <button class="copy-btn-mini" data-action="copy-val" data-value="${url}/admin">copy</button>
        ` : '—'}
      </span>
    </div>
    <div class="data-pair">
      <span class="dp-lbl">API Endpoint</span>
      <span class="dp-val">
        ${url ? `
          <a href="${url}/api" target="_blank" style="display:flex;align-items:center;gap:6px;">
            ${url}/api
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
          <button class="copy-btn-mini" data-action="copy-val" data-value="${url}/api">copy</button>
        ` : '—'}
      </span>
    </div>
    <div class="data-pair">
      <span class="dp-lbl">Infrastructure Cluster</span>
      <span class="dp-val" style="color:var(--muted)">${escHtml(t.cluster_label || t.cluster_id || '—')}</span>
    </div>
    <div class="data-pair">
      <span class="dp-lbl">Your Permissions</span>
      <span class="dp-val">
        <span class="status-badge ${t.is_scoped ? 'sb-scoped' : 'sb-active'}" title="${t.is_scoped ? 'This role applies only to this specific instance' : 'This role applies to all instances in the organization'}">
          ${escHtml(t.org_role).toUpperCase()} ${t.is_scoped ? ' (INSTANCE ONLY)' : ''}
        </span>
      </span>
    </div>
    <div class="data-pair">
      <span class="dp-lbl">Account Status</span>
      <span class="dp-val"><span class="status-badge ${s.cls}">${s.label}</span></span>
    </div>
    <div class="data-pair"><span class="dp-lbl">Subscription Ends</span><span class="dp-val" style="color:var(--muted)">${endsDisplay}</span></div>
    ${canBill && t.sub_status !== 'free' ? `
    <div class="data-pair" style="padding-top:12px;border-top:1px solid var(--border);margin-top:4px;">
      <span class="dp-lbl">Billing</span>
      <span class="dp-val">
        <button class="pact pact-primary" data-action="renew" data-tenant="${escJs(t.tenant)}" data-tid="${tid}" data-plan="${escJs(t.sub_plan || t.package)}">Renew Subscription</button>
      </span>
    </div>` : ''}
  </div>`;
}

function renderMonitoringPanel(t, tid) {
  const dashboardUrl = t.dashboard_url || `https://stats.justbots.tech/d/${escHtml(t.tenant)}`;
  const username = t.monitor_user || t.tenant;
  // Never store the mask as data-secret — keep it empty so the reveal fetch is always triggered
  const password = t.monitor_password || '';
  // dashboardUrl goes into an href — validate it is http(s) only to prevent javascript: URLs
  const safeDashUrl = /^https?:\/\//.test(dashboardUrl) ? escHtml(dashboardUrl) : '#';

  return `<div class="data-list">
    <div class="data-pair">
      <span class="dp-lbl">Grafana Dashboard</span>
      <span class="dp-val"><a href="${safeDashUrl}" target="_blank" rel="noopener noreferrer">${safeDashUrl}</a></span>
    </div>
    <div class="data-pair">
      <span class="dp-lbl">Username</span>
      <span class="dp-val">${escHtml(username)}</span>
    </div>
    <div class="data-pair">
      <span class="dp-lbl">Password</span>
      <span class="dp-val">
        <span id="mon-pass-${tid}" data-secret="${escJs(password)}">••••••••</span>
        <button class="copy-btn" data-action="copy-mon-secret" data-tid="${tid}" data-tenant="${escJs(t.tenant)}">copy</button>
      </span>
    </div>
  </div>`;
}

function renderGitPanel(t, tid, canOperate) {
  const hasGit  = !!(t.git_repo);
  const disAttr = !canOperate ? ' disabled title="Member rank or above required"' : '';
  const disCls  = !canOperate ? ' disabled-ui' : '';
  return `<div id="git-info-${tid}" style="display:${hasGit ? '' : 'none'}; padding:24px;">
    <div class="data-pair"><span class="dp-lbl">Repository</span><span class="dp-val" id="gi-repo-${tid}">${escHtml(t.git_repo || '—')}</span></div>
    <div class="data-pair"><span class="dp-lbl">Branch</span><span class="dp-val" id="gi-branch-${tid}">${escHtml(t.git_branch || 'main')}</span></div>
    <div class="data-pair"><span class="dp-lbl">Node Runtime</span><span class="dp-val" id="gi-node-${tid}">${escHtml(t.node_version || '22')} (LTS)</span></div>
    ${t.last_commit_sha ? `<div class="data-pair"><span class="dp-lbl">Last Sync</span><span class="dp-val">${escHtml(t.last_commit_sha.substring(0,7))} [Pushed]</span></div>` : ''}
    <div class="data-pair">
      <span class="dp-lbl">Webhook URL</span>
      <span class="dp-val">
        <span style="font-family:'Source Code Pro','SFMono-Regular','DM Mono',monospace;font-size:11px;word-break:break-all;">${API_BASE}/api/webhooks/${escHtml(t.tenant)}</span>
        <button class="copy-btn-mini" data-action="copy-val" data-value="${API_BASE}/api/webhooks/${t.tenant}">copy</button>
      </span>
    </div>
    <div class="data-pair">
      <span class="dp-lbl">Webhook Secret</span>
      <span class="dp-val">
        <span id="whs-${tid}" data-secret="${escJs(t.webhook_secret || '')}">••••${(t.webhook_secret || '').slice(-4)}</span>
        <button class="copy-btn" data-action="copy-secret" data-tid="${tid}" data-tenant="${escJs(t.tenant)}">copy</button>
      </span>
    </div>
    <div style="display:flex;gap:12px;margin-top:24px;">
      <button class="pact pact-primary${disCls}" data-action="edit-git" data-tid="${tid}" data-tenant="${escJs(t.tenant)}"${disAttr}>Edit configuration</button>
      <button class="pact pact-warn${disCls}" data-action="rotate-secret" data-tid="${tid}" data-tenant="${escJs(t.tenant)}"${disAttr}>Rotate secret</button>
    </div>
  </div>
  <div id="git-form-${tid}" style="display:${hasGit ? 'none' : ''}; padding:24px;">
    <div class="field"><label>Repository URL</label><input class="env-input" style="width:100%;" id="gf-repo-${tid}" placeholder="https://github.com/org/repo"${disAttr}></div>
    <div class="field"><label>Branch</label><input class="env-input" style="width:100%;" id="gf-branch-${tid}" placeholder="main" value="main"${disAttr}></div>
    <div class="field"><label>Base directory <span style="color:var(--faint);font-weight:400;">optional</span></label><input class="env-input" style="width:100%;" id="gf-basedir-${tid}" placeholder="apps/cms"${disAttr}></div>
    <div class="field"><label>Node version</label><select class="env-input" id="gf-node-${tid}"${disAttr}><option value="22">Node 22 (LTS)</option><option value="20">Node 20</option><option value="18">Node 18</option></select></div>
    <div id="gf-err-${tid}" style="font-size:12px;color:var(--red);min-height:16px;"></div>
    <div style="display:flex;gap:8px;margin-top:10px;">
      <button class="pact pact-primary${disCls}" data-action="save-git" data-tid="${tid}" data-tenant="${escJs(t.tenant)}"${disAttr}>Save</button>
      ${hasGit ? `<button class="pact" data-action="cancel-git" data-tid="${tid}">Cancel</button>` : ''}
    </div>
  </div>`;
}

function renderEnvPanel(t, tid, canOperate) {
  const disAttr = !canOperate ? ' disabled title="Member rank or above required"' : '';
  const disCls  = !canOperate ? ' disabled-ui' : '';
  return `<div style="padding:24px;">
    <div class="data-list" id="env-list-${tid}" style="margin-bottom:32px; border:1px solid var(--border); border-radius:4px; overflow:hidden;"></div>

    <div style="background:var(--bg-lifted); padding:20px; border:1px solid var(--border); border-radius:var(--radius-sharp);">
      <div style="font-family:'Source Code Pro','SFMono-Regular','DM Mono',monospace; font-size:11px; color:var(--faint); margin-bottom:16px; text-transform:uppercase; letter-spacing:1px;">Add Configuration Variable</div>
      <div style="display:flex; gap:12px;">
        <input class="env-input" id="env-key-${tid}" placeholder="VARIABLE_NAME" style="flex:1; font-family:'Source Code Pro','SFMono-Regular','DM Mono',monospace;"${disAttr}>
        <input class="env-input" id="env-val-${tid}" placeholder="value" style="flex:2; font-family:'Source Code Pro','SFMono-Regular','DM Mono',monospace;"${disAttr}>
        <button class="pact pact-primary${disCls}" style="padding:0 24px;" data-action="add-env" data-tid="${tid}" data-tenant="${escJs(t.tenant)}"${disAttr}>Add</button>
      </div>
      <div id="env-err-${tid}" style="font-size:12px; color:var(--red); margin-top:10px; min-height:16px; font-family:'Source Code Pro','SFMono-Regular','DM Mono',monospace;"></div>

      <div style="margin-top:20px; padding-top:20px; border-top:1px dashed var(--border); display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:11px; color:var(--faint); font-family:'Source Code Pro','SFMono-Regular','DM Mono',monospace;">Deployment required to apply new variables</span>
        <button class="pact pact-warn${disCls}" id="env-apply-btn-${tid}" style="display:none;" data-action="apply-env" data-tid="${tid}" data-tenant="${escJs(t.tenant)}"${disAttr}>Apply &amp; Restart</button>
      </div>
    </div>
  </div>`;
}

function bindTenantCardEvents(tenants) {
  const list = document.getElementById('user-tenant-list');
  if (!list) return;

  list.onclick = async e => {
    const btn = e.target.closest('[data-action],[data-tab]');
    if (!btn) return;

    const action = btn.dataset.action;
    const tab    = btn.dataset.tab;
    const tid    = btn.dataset.tid;
    const tenant = btn.dataset.tenant;

    if (tab) {
      const card = btn.closest('.instance-card');
      card?.querySelectorAll('.itab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      card?.querySelectorAll('.itab-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(`panel-${tab}-${tid}`);
      if (panel) panel.classList.add('active');
      const orgId = btn.dataset.orgid;
      if (tab === 'deployments') { const bl = document.getElementById(`builds-list-${tid}`); if (bl && !bl.dataset.loaded) loadBuilds(tenant, tid); }
      if (tab === 'backups')     { const bl = document.getElementById(`backups-list-${tid}`); if (bl && !bl.dataset.loaded) loadBackups(tenant, tid); }
      if (tab === 'env')         { const el = document.getElementById(`env-list-${tid}`); if (el && !el.dataset.loaded) loadEnvVars(tenant, tid); }
      if (tab === 'team')        { if (orgId) { const tl = document.getElementById(`team-list-${tid}`); if (tl && !tl.dataset.loaded) loadOrgMembers(orgId, tid, btn.dataset.tenant); loadExtraDomains(orgId, tid); } }
      _saveTabState(tid, tab, orgId || null, tenant);
      return;
    }

    if (action === 'remove')          { confirmRemove(tenant, tid); return; }
    if (action === 'renew')           { openRenewModal(tenant, btn.dataset.plan); return; }
    if (action === 'add-env')         { addEnvVar(tenant, tid); return; }
    if (action === 'apply-env')       { applyEnv(tenant, tid); return; }
    if (action === 'edit-git')        { showGitForm(tid, tenant); return; }
    if (action === 'cancel-git')      { hideGitForm(tid); return; }
    if (action === 'save-git')        { saveGit(tid, tenant); return; }
    if (action === 'rotate-secret')   { rotateSecret(tid, tenant); return; }
    if (action === 'invite-member')    { inviteMember(btn.dataset.orgid, tid, btn.dataset.tenant); return; }
    if (action === 'transfer-instance') { transferInstanceOwner(btn.dataset.orgid, tid, btn.dataset.tenant); return; }
    if (action === 'add-domain')     { addExtraDomain(btn.dataset.orgid, tid); return; }
    if (action === 'verify-extra-domain') { verifyExtraDomain(btn.dataset.orgid, btn.dataset.domainid, tid); return; }
    if (action === 'copy-secret' || action === 'copy-mon-secret') {
      const isMon = action === 'copy-mon-secret';
      const el    = document.getElementById(isMon ? 'mon-pass-' + tid : 'whs-' + tid);
      if (!el) return;

      // Read cached plaintext — never trust a value that looks like a mask
      const isMasked = s => !s || s.includes('\u2022'); // \u2022 = •
      let secret = el.dataset.secret || '';

      if (isMasked(secret)) {
        // Dedicated reveal endpoints — monitoring and webhook secret are separate.
        const endpoint = isMon
          ? `/api/my/tenants/${tenant}/monitor/reveal`
          : `/api/my/tenants/${tenant}/git/reveal`;
        const originalText = btn.textContent;
        btn.textContent = '…';
        btn.disabled = true;
        try {
          const d = await authFetch(endpoint);
          if (d.ok) {
            const real = isMon ? d.monitor_password : d.webhook_secret;
            if (typeof real === 'string' && real) {
              el.dataset.secret = real;
              secret = real;
            }
          }
        } catch (err) {
          console.error('[Portal] Reveal failed:', err);
        }
        btn.textContent = originalText;
        btn.disabled = false;
      }

      // Only copy if we have a genuine plaintext value (not a mask, not empty)
      if (!isMasked(secret)) copyText(btn, secret);
      else showToast('Could not retrieve secret — try rotating it.', 'error');
      return;
    }
    if (action === 'copy-val') {
      copyText(btn, btn.dataset.value || '');
      return;
    }
  };

  tenants.forEach((t, i) => {
    const tid = 'tc' + i;
    document.getElementById('deploy-btn-' + tid)?.addEventListener('click', () => manualDeploy(t.tenant, tid));
    document.getElementById('rollback-btn-' + tid)?.addEventListener('click', () => confirmRollback(t.tenant, tid, t.previous_image));
    document.getElementById('backup-btn-' + tid)?.addEventListener('click', () => triggerBackup(t.tenant, tid));
    document.getElementById('env-apply-btn-' + tid)?.addEventListener('click', () => applyEnv(t.tenant, tid));

    // DNS verification banner handlers
    const verifyBtn = document.querySelector(`.dns-verify-btn[data-tid="${tid}"]`);
    if (verifyBtn) {
      verifyBtn.addEventListener('click', () => triggerDnsVerify(t.org_id, tid, verifyBtn));
    }
    const cnameCheckBtn = document.querySelector(`.dns-cname-check-btn[data-tid="${tid}"]`);
    if (cnameCheckBtn) {
      cnameCheckBtn.addEventListener('click', async () => {
        const { checkCnamePropagation } = await import('./form.js');
        const msgEl = document.getElementById('dns-verify-msg-' + tid);
        const data = await checkCnamePropagation(t.org_id, cnameCheckBtn.dataset.domain, cnameCheckBtn);
        if (msgEl && data) {
          msgEl.textContent = data.pointed
            ? `✓ ${data.cname_value} — pointed`
            : `✗ Not yet pointed`;
          msgEl.style.color = data.pointed ? 'var(--green)' : 'var(--amber)';
        }
      });
    }
    document.querySelectorAll(`.dns-copy-btn[data-copy]`).forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard?.writeText(btn.dataset.copy).then(() => {
          const orig = btn.textContent;
          btn.textContent = '✓';
          setTimeout(() => { btn.textContent = orig; }, 1500);
        });
      });
    });
  });
}

// ── DNS auto-promote polling ──────────────────────────────────────────────────
// For each tenant whose org is pending DNS verification, poll the org endpoint
// every 30s. When is_verified flips to true, re-render the card in-place.
const _dnsPollers = {};

function _startDnsPolling(tenants) {
  // Clear any previous pollers
  Object.values(_dnsPollers).forEach(clearInterval);
  Object.keys(_dnsPollers).forEach(k => delete _dnsPollers[k]);

  tenants.forEach((t, i) => {
    if (!t.org_id || t.org_verified || !t.dns_token) return;
    const orgId = t.org_id;
    if (_dnsPollers[orgId]) return; // already polling this org
    _dnsPollers[orgId] = setInterval(async () => {
      try {
        // authFetch returns parsed JSON — do NOT call .json() on the result
        const d = await authFetch(`/api/v1/orgs/${orgId}`);
        if (d.ok && d.org && d.org.is_verified) {
          clearInterval(_dnsPollers[orgId]);
          delete _dnsPollers[orgId];
          // Re-render all cards for this org with updated verified state
          loadUserTenants();
        }
      } catch (_) {}
    }, 30000); // poll every 30s
  });
}

// ── Tab state memory ──────────────────────────────────────────────────────────
// Remembers which tab the user has open per card so silent re-renders restore it.
const _tabState = {}; // tid → { tab, orgId, tenant }

function _saveTabState(tid, tab, orgId, tenant) {
  _tabState[tid] = { tab, orgId: orgId || null, tenant };
}

function _restoreTabState(tenants) {
  tenants.forEach((_t, i) => {
    const tid   = 'tc' + i;
    const saved = _tabState[tid];
    if (!saved || saved.tab === 'overview') return; // overview is default — no action needed
    const card = document.getElementById('card-' + tid);
    if (!card) return;
    // Re-activate the tab button
    card.querySelectorAll('.itab').forEach(b => b.classList.remove('active'));
    const tabBtn = card.querySelector(`.itab[data-tab="${saved.tab}"]`);
    if (tabBtn) tabBtn.classList.add('active');
    // Re-activate the panel
    card.querySelectorAll('.itab-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById(`panel-${saved.tab}-${tid}`);
    if (panel) panel.classList.add('active');
    // Reload that tab's data (dataset.loaded was cleared by the re-render)
    if (saved.tab === 'deployments') { const bl = document.getElementById(`builds-list-${tid}`); if (bl && !bl.dataset.loaded) loadBuilds(saved.tenant, tid); }
    if (saved.tab === 'backups')     { const bl = document.getElementById(`backups-list-${tid}`); if (bl && !bl.dataset.loaded) loadBackups(saved.tenant, tid); }
    if (saved.tab === 'env')         { const el = document.getElementById(`env-list-${tid}`); if (el && !el.dataset.loaded) loadEnvVars(saved.tenant, tid); }
    if (saved.tab === 'team' && saved.orgId) {
      const tl = document.getElementById(`team-list-${tid}`);
      if (tl && !tl.dataset.loaded) { loadOrgMembers(saved.orgId, tid, saved.tenant); loadExtraDomains(saved.orgId, tid); }
    }
  });
}

// ── Global auto-refresh ───────────────────────────────────────────────────────
// Every 30s: silent full re-render of the tenant list + tab state restoration.
// Covers all data on the page — health, deploy status, builds, backups, env, team.
let _globalRefreshInterval = null;

function _startAutoRefresh() {
  if (_globalRefreshInterval) clearInterval(_globalRefreshInterval);
  _globalRefreshInterval = setInterval(() => loadUserTenants(true), 30000);
}

function _stopAutoRefresh() {
  if (_globalRefreshInterval) { clearInterval(_globalRefreshInterval); _globalRefreshInterval = null; }
}

async function triggerDnsVerify(orgId, tid, btn) {
  const msgEl = document.getElementById('dns-verify-msg-' + tid);
  btn.disabled = true;
  btn.textContent = 'Checking…';
  if (msgEl) { msgEl.textContent = ''; msgEl.style.color = ''; }
  try {
    const d = await authFetch(`/api/v1/orgs/${orgId}/verify`, { method: 'POST' });

    if (d.ok && d.verified) {
      const banner = document.getElementById('dns-banner-' + tid);
      if (banner) {
        const cnameNote = d.cname_pointed
          ? 'CNAME propagated — SSL cert is being issued now.'
          : 'CNAME not yet propagated — your platform URL stays active while SSL provisions.';
        banner.innerHTML = `
          <div style="padding:16px 20px;font-family:'Source Code Pro','SFMono-Regular','DM Mono',monospace;font-size:12px;">
            <span style="color:var(--green);">&#10003; Domain verified — custom domain is now active.</span><br>
            <span style="color:var(--muted);font-size:11px;">${cnameNote}</span>
          </div>`;
      }
    } else if (d.locked) {
      // Rate-limit hit — show lockout message, disable button for duration
      if (msgEl) {
        msgEl.style.color = 'var(--amber)';
        msgEl.textContent = `Locked — try again in ${d.retry_after_minutes} min`;
      }
      btn.textContent = `Locked (${d.retry_after_minutes}m)`;
      // Re-enable button after lockout expires
      setTimeout(() => {
        btn.disabled    = false;
        btn.textContent = 'Verify DNS';
        if (msgEl) msgEl.textContent = '';
      }, (d.retry_after_minutes || 60) * 60 * 1000);
    } else {
      const attemptsMsg = d.attempts_left > 0
        ? ` (${d.attempts_left} attempt${d.attempts_left === 1 ? '' : 's'} left)`
        : ' — locked for 1 hour';
      if (msgEl) {
        msgEl.style.color = 'var(--red)';
        msgEl.textContent = (d.error || 'TXT record not found yet.') + attemptsMsg;
      }
      btn.disabled    = false;
      btn.textContent = 'Verify DNS';
    }
  } catch (err) {
    if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = 'Request failed.'; }
    btn.disabled    = false;
    btn.textContent = 'Verify DNS';
  }
}

// ── Tenant actions ──
async function confirmRemove(tenant, tid) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.innerHTML = `<div class="modal-box">
    <div class="modal-title">Remove instance</div>
    <div class="modal-sub">Permanently remove <strong>${escJs(tenant)}</strong>? This is irreversible.</div>
    <div class="modal-actions">
      <button class="modal-cancel" id="rm-cancel">Cancel</button>
      <button class="modal-confirm" id="rm-confirm">Remove</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#rm-cancel').addEventListener('click', () => modal.remove());
  modal.querySelector('#rm-confirm').addEventListener('click', async () => {
    modal.querySelector('#rm-confirm').textContent = 'Removing...';
    modal.querySelector('#rm-confirm').disabled = true;
    try {
      const data = await authFetch(`/api/my/tenants/${tenant}/remove`, { method: 'POST' });
      if (!data.ok) { alert(data.error || 'Remove failed'); modal.remove(); return; }
      modal.remove();
      loadUserTenants();
    } catch (e) { alert('Request failed'); modal.remove(); }
  });
}

async function manualDeploy(tenant, tid) {
  const btn = document.getElementById('deploy-btn-' + tid);
  if (btn) { btn.disabled = true; btn.textContent = 'Deploying...'; }
  try {
    const data = await authFetch(`/api/my/tenants/${tenant}/deploy`, { method: 'POST' });
    if (!data.ok) {
      if (btn) { btn.disabled = false; btn.textContent = 'Deploy'; }
      alert(data.error || 'Deploy failed');
      return;
    }
    const bl = document.getElementById('builds-list-' + tid);
    if (bl) bl.dataset.loaded = '';
    _pollBuildJob(data.job_id, tid, tenant, btn);
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Deploy'; }
    alert('Request failed');
  }
}

async function confirmRollback(tenant, tid, prevImage) {
  const short = (prevImage || '').split(':').pop() || prevImage;
  const ok = await confirmDialog(
    'Rollback instance',
    `Roll back <strong>${escJs(tenant)}</strong> to previous deployment?<br><br><code style="font-size:11px;color:var(--muted);">${escJs(short)}</code><br><br>The current version will become the new rollback target.`,
    'Roll back',
    true
  );
  if (!ok) return;
  const btn = document.getElementById('rollback-btn-' + tid);
  if (btn) { btn.disabled = true; btn.textContent = 'Rolling back...'; }
  try {
    const data = await authFetch(`/api/my/tenants/${tenant}/rollback`, { method: 'POST' });
    if (!data.ok) {
      if (btn) { btn.disabled = false; btn.textContent = 'Rollback'; }
      alert(data.error || 'Rollback failed');
      return;
    }
    loadBuilds(tenant, tid);
    _pollBuildJob(data.job_id, tid, tenant, btn, true);
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = '↩ Rollback'; }
    alert('Request failed');
  }
}

// ── Build polling ──
async function loadBuilds(tenant, tid) {
  const list = document.getElementById('builds-list-' + tid);
  if (!list || list.dataset.loaded) return;
  list.innerHTML = '<p style="color:var(--muted);font-size:13px;">Loading...</p>';
  try {
    const data = await authFetch(`/api/my/tenants/${tenant}/builds`);
    if (!data.ok || !data.builds.length) {
      list.innerHTML = '<p style="color:var(--muted);font-size:13px;">No deployments yet.</p>';
      return;
    }
    list.dataset.loaded = '1';
    const hasActive = data.builds.some(b => b.status === 'queued' || b.status === 'running');
    if (hasActive) {
      clearTimeout(list._refreshTimer);
      list._refreshTimer = setTimeout(() => { list.dataset.loaded = ''; loadBuilds(tenant, tid); }, 5000);
    }
    list.innerHTML = data.builds.map(b => {
      const sc    = b.status === 'done' ? 'var(--green)' : b.status === 'error' ? 'var(--red)' : 'var(--amber)';
      const label = b.status === 'done' ? 'Success' : b.status === 'error' ? 'Failed' : 'Building';
      const icon  = b.status === 'done' ? '✓' : b.status === 'error' ? '✕' : '●';
      const ts    = b.started_at ? timeAgo(b.started_at) : '—';
      const type  = (b.type === 'build' ? 'Build' : b.type === 'rollback' ? 'Rollback' : 'Provision').toUpperCase();
      
      return `<div class="data-pair">
        <span class="dp-lbl">${type}</span>
        <span class="dp-val">
          <span style="font-size:12px; color:var(--text);">${ts}</span>
          <span style="color:${sc}; width:80px; text-align:right;">${label}</span>
          <button class="pact" style="font-size:11px; padding:3px 10px;" data-action="view-log" data-tenant="${escJs(tenant)}" data-job="${b.job_id}" data-tid="${tid}">View log</button>
        </span>
      </div>`;
    }).join('');
    list.onclick = async e => {
      const btn = e.target.closest('[data-action="view-log"]');
      if (!btn) return;
      portalBuildLog(btn.dataset.tenant, btn.dataset.job, btn.dataset.tid);
    };
  } catch (e) {
    list.innerHTML = '<p style="color:var(--red);font-size:13px;">Failed to load.</p>';
  }
}

async function portalBuildLog(tenant, jobId, tid) {
  const list    = document.getElementById('builds-list-' + tid);
  const existing = document.getElementById('log-' + jobId);
  if (existing) { existing.remove(); return; }
  try {
    const data = await authFetch(`/api/my/tenants/${tenant}/builds/${jobId}`);
    if (!data.ok) return;
    const logLines = (data.log || []);
    let lines = logLines.map(l => {
      if (l.toLowerCase().includes('success') || l.toLowerCase().includes('done') || l.toLowerCase().includes('ready')) return `✓ ${l}`;
      if (l.startsWith('git') || l.startsWith('npm') || l.startsWith('strapi')) return `$ ${l}`;
      return `→ ${l}`;
    }).join('\n');
    if (data.status !== 'done' && data.status !== 'error') {
      lines += '\n→ Processing... ●';
    }
    const logEl = document.createElement('div');
    logEl.id = 'log-' + jobId;
    logEl.className = 'log-viewer';
    logEl.style.whiteSpace = 'pre-wrap';
    logEl.textContent = lines || '(no log)';
    list?.appendChild(logEl);
    requestAnimationFrame(() => {
      logEl.classList.add('open');
      if (logEl) logEl.scrollTop = logEl.scrollHeight;
    });
  } catch (e) {}
}

function _setBuildingState(tid, building) {
  const dotEl    = document.getElementById('health-dot-' + tid);
  const textEl   = document.getElementById('health-text-' + tid);
  const deployTab = document.querySelector('#tabs-' + tid + ' .itab:nth-child(2)');
  if (building) {
    dotEl?.classList.add('dot-building');
    if (textEl) textEl.textContent = 'Building...';
    deployTab?.classList.add('building-indicator');
  } else {
    dotEl?.classList.remove('dot-building');
    deployTab?.classList.remove('building-indicator');
  }
}

function _pollBuildJob(jobId, tid, tenant, btn, isRollback = false) {
  _setBuildingState(tid, true);
  const interval = setInterval(async () => {
    try {
      const data = await authFetch(`/api/my/tenants/${tenant}/builds/${jobId}`);
      if (!data.ok) { clearInterval(interval); _setBuildingState(tid, false); return; }
      if (data.status === 'done') {
        clearInterval(interval);
        _setBuildingState(tid, false);
        if (btn) { btn.disabled = false; btn.textContent = isRollback ? 'Rollback' : 'Deploy'; }
        _refreshTenantCard(tenant, tid);
        const bld = document.getElementById('builds-list-' + tid);
        if (bld) { bld.dataset.loaded = ''; loadBuilds(tenant, tid); }
      } else if (data.status === 'error') {
        clearInterval(interval);
        _setBuildingState(tid, false);
        const dot  = document.getElementById('health-dot-' + tid);
        const text = document.getElementById('health-text-' + tid);
        if (dot)  dot.style.background = 'var(--red)';
        if (text) text.textContent = 'Deploy failed';
        if (btn) { btn.disabled = false; btn.textContent = isRollback ? 'Rollback' : 'Deploy'; }
        const bld = document.getElementById('builds-list-' + tid);
        if (bld) { bld.dataset.loaded = ''; loadBuilds(tenant, tid); }
      }
      if (data.status === 'running' || data.status === 'queued') {
        const blist = document.getElementById('builds-list-' + tid);
        if (blist) { blist.dataset.loaded = ''; loadBuilds(tenant, tid); }
      }
    } catch (e) { clearInterval(interval); _setBuildingState(tid, false); }
  }, 4000);
}

async function _refreshTenantCard(tenant, tid) {
  try {
    const data = await authFetch('/api/my/tenants');
    if (!data.ok) return;
    const t = (data.tenants || []).find(x => x.tenant === tenant);
    if (!t) return;
    const deployEl = document.getElementById('deploy-line-' + tid);
    if (deployEl) deployEl.innerHTML = t.last_deploy_at ? 'Deployed ' + timeAgo(t.last_deploy_at) : '';
    const dotColor = t.healthy ? 'var(--green)' : 'var(--amber)';
    const dotEl  = document.getElementById('health-dot-' + tid);
    const textEl = document.getElementById('health-text-' + tid);
    if (dotEl)  dotEl.style.background = dotColor;
    if (textEl) textEl.textContent = t.healthy ? 'Healthy' : 'Degraded';
  } catch (e) {}
}

// ── Backups ──
async function loadBackups(tenant, tid) {
  const list = document.getElementById('backups-list-' + tid);
  if (!list || list.dataset.loaded) return;
  list.innerHTML = '<p style="color:var(--muted);font-size:13px;">Loading...</p>';
  try {
    const data = await authFetch(`/api/my/tenants/${tenant}/backups`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (!data.ok) throw new Error(data.error || 'Error');
    list.dataset.loaded = '1';
    if (!data.backups.length) {
      list.innerHTML = '<p style="color:var(--muted);font-size:13px;">No backups yet. Click "Export now" to create one.</p>';
      return;
    }
    list.innerHTML = data.backups.map(b => {
      const sc  = b.status === 'done' ? 'var(--green)' : b.status === 'error' ? 'var(--red)' : 'var(--amber)';
      const dt  = b.created_at ? timeAgo(b.created_at) : '—';
      const sz  = b.size_bytes > 0 ? (b.size_bytes / 1024).toFixed(1) + ' KB' : '—';
      const lbl = (b.type === 'scheduled' ? 'Nightly' : 'Manual').toUpperCase();
      
      return `<div class="data-pair">
        <span class="dp-lbl">${lbl}</span>
        <span class="dp-val">
          <span style="font-size:12px; color:var(--text);">${dt}</span>
          <span style="font-size:12px; color:var(--text); width:70px; text-align:right;">${sz}</span>
          ${b.status === 'done' 
            ? `<button class="pact" style="font-size:11px; padding:3px 10px;" data-action="dl-backup" data-tenant="${escJs(tenant)}" data-backup="${b.id}">Download</button>`
            : `<span style="color:${sc}; font-size:11px; width:80px; text-align:right;">${b.status.toUpperCase()}</span>`}
        </span>
      </div>`;
    }).join('');
    list.onclick = async e => {
      const btn = e.target.closest('[data-action="dl-backup"]');
      if (!btn) return;
      downloadBackup(btn.dataset.tenant, btn.dataset.backup, btn);
    };
  } catch (e) {
    list.innerHTML = `<p style="color:var(--red);font-size:13px;">${escHtml(e.message)}</p>`;
  }
}

async function triggerBackup(tenant, tid) {
  const btn = document.getElementById('backup-btn-' + tid);
  if (btn) { btn.disabled = true; btn.textContent = 'Starting…'; }
  try {
    const data = await authFetch(`/api/my/tenants/${tenant}/backup`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (!data.ok) throw new Error(data.error || 'Failed');
    if (btn) btn.textContent = 'Backup started';
    setTimeout(() => {
      if (btn) { btn.disabled = false; btn.textContent = 'Export now'; }
      const list = document.getElementById('backups-list-' + tid);
      if (list) { list.dataset.loaded = ''; }
      loadBackups(tenant, tid);
    }, 5000);
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Export now'; }
    alert(e.message);
  }
}

async function downloadBackup(tenant, backupId, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Downloading…'; }
  try {
    const token = getAccessToken();
    const res = await fetch(API_BASE + `/api/my/tenants/${tenant}/backups/${backupId}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const cd   = res.headers.get('Content-Disposition') || '';
    const fn   = (cd.match(/filename="([^"]+)"/) || [])[1] || (tenant + '-backup.sql.gz');
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = fn;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e) {
    alert(e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '↓ .sql.gz'; }
  }
}

// ── Git ──
function showGitForm(tid) {
  document.getElementById('git-info-' + tid).style.display = 'none';
  document.getElementById('git-form-' + tid).style.display = '';
  document.getElementById('gf-err-' + tid).textContent = '';
}
function hideGitForm(tid) {
  document.getElementById('git-info-' + tid).style.display = '';
  document.getElementById('git-form-' + tid).style.display = 'none';
}

async function saveGit(tid, tenant) {
  const repo    = document.getElementById('gf-repo-' + tid)?.value.trim();
  const branch  = document.getElementById('gf-branch-' + tid)?.value.trim() || 'main';
  const baseDir = document.getElementById('gf-basedir-' + tid)?.value.trim();
  const nodeVer = document.getElementById('gf-node-' + tid)?.value || '22';
  const errEl   = document.getElementById('gf-err-' + tid);
  if (errEl) errEl.textContent = '';
  if (!repo) { if (errEl) errEl.textContent = 'Repo URL is required.'; return; }
  try {
    const data = await authFetch(`/api/my/tenants/${tenant}/git`, {
      method: 'POST',
      body: JSON.stringify({ repo, branch, base_dir: baseDir, node_version: nodeVer }),
    });
    if (!data.ok) { if (errEl) errEl.textContent = data.error || 'Save failed.'; return; }
    const repoEl   = document.getElementById('gi-repo-' + tid);
    const branchEl = document.getElementById('gi-branch-' + tid);
    const nodeEl   = document.getElementById('gi-node-' + tid);
    if (repoEl)   repoEl.textContent   = data.repo;
    if (branchEl) branchEl.textContent = data.branch;
    if (nodeEl)   nodeEl.textContent   = data.node_version;
    hideGitForm(tid);
  } catch (e) { if (errEl) errEl.textContent = 'Request failed.'; }
}

async function rotateSecret(tid, tenant) {
  const ok = await confirmDialog(
    'Rotate secret',
    'Generate a new deploy secret?<br><br>You must update the secret in your GitHub/GitLab repository settings after rotating.',
    'Rotate',
    false
  );
  if (!ok) return;
  try {
    const repo   = document.getElementById('gi-repo-' + tid)?.textContent   || '';
    const branch = document.getElementById('gi-branch-' + tid)?.textContent || 'main';
    const node   = document.getElementById('gi-node-' + tid)?.textContent?.trim() || '22';
    const data = await authFetch(`/api/my/tenants/${tenant}/git`, {
      method: 'POST',
      body: JSON.stringify({ repo, branch, node_version: node, rotate_secret: true }),
    });
    if (!data.ok) { alert(data.error || 'Failed to rotate secret.'); return; }
    const whsEl = document.getElementById('whs-' + tid);
    if (whsEl) {
      whsEl.dataset.secret = data.webhook_secret;
      whsEl.textContent = '••••' + data.webhook_secret.slice(-4);
    }
    showToast('New secret generated. Update it in your repo webhook settings.', 8000);
  } catch (e) { alert('Request failed.'); }
}

// ── Env vars ──
async function loadEnvVars(tenant, tid) {
  const list = document.getElementById('env-list-' + tid);
  if (!list || list.dataset.loaded) return;
  try {
    const data = await authFetch(`/api/my/tenants/${tenant}/env`);
    if (!data.ok) throw new Error(data.error || 'Error');
    list.dataset.loaded = '1';
    _renderEnvList(tenant, tid, data);
  } catch (e) {
    list.innerHTML = `<p style="color:var(--red);font-size:13px;">${escHtml(e.message)}</p>`;
  }
}

function _renderEnvList(tenant, tid, data) {
  const list    = document.getElementById('env-list-' + tid);
  const applyBtn = document.getElementById('env-apply-btn-' + tid);
  if (!list) return;
  const vars  = data.vars  || [];
  const used  = data.count || 0;
  const limit = data.limit || 10;
  const plan  = data.plan  || 'starter';

  if (!vars.length) {
    list.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:24px;">No variables configured.</p>';
  } else {
    list.innerHTML = `<div style="padding:14px 24px; border-bottom:1px solid var(--border); font-size:10px; color:var(--faint); font-family:'Source Code Pro','SFMono-Regular','DM Mono',monospace; letter-spacing:1px; background:var(--bg-lifted); text-align:right;">
      ${used} / ${limit} VARIABLES CONFIGURED [ ${plan.toUpperCase()} ]
    </div>` +
    `<div class="data-list" style="padding:12px 24px;">${vars.map(v => {
      const isSecret = v.key.includes('SECRET') || v.key.includes('KEY') || v.key.includes('PASS') || v.key.includes('TOKEN') || v.key.includes('ID');
      const displayVal = isSecret ? '••••••••' : v.value;
      return `<div class="data-pair">
        <span class="dp-lbl">${v.key}</span>
        <span class="dp-val">
          <span style="font-family:'Source Code Pro','SFMono-Regular','DM Mono',monospace;font-size:11px;">${displayVal}</span>
          <button class="copy-btn-mini" data-action="copy-val" data-value="${escJs(v.value)}">copy</button>
          <button class="pact pact-danger" style="font-size:10px; padding:2px 8px; margin-left:8px;" data-action="del-env" data-tenant="${escJs(tenant)}" data-tid="${tid}" data-key="${escJs(v.key)}">REMOVE</button>
        </span>
      </div>`;
    }).join('')}</div>`;

    list.querySelectorAll('[data-action="del-env"]').forEach(btn => {
      btn.addEventListener('click', () => deleteEnvVar(btn.dataset.tenant, btn.dataset.tid, btn.dataset.key));
    });
  }
  if (applyBtn) applyBtn.style.display = used > 0 ? '' : 'none';
}

async function addEnvVar(tenant, tid) {
  const keyEl  = document.getElementById('env-key-' + tid);
  const valEl  = document.getElementById('env-val-' + tid);
  const errEl  = document.getElementById('env-err-' + tid);
  const key    = (keyEl?.value || '').trim().toUpperCase();
  const value  = valEl?.value || '';
  if (errEl) errEl.textContent = '';
  if (!key) { if (errEl) errEl.textContent = 'Variable name is required.'; return; }
  try {
    const data = await authFetch(`/api/my/tenants/${tenant}/env`, {
      method: 'POST',
      body: JSON.stringify({ key, value }),
    });
    if (!data.ok) { if (errEl) errEl.textContent = data.error || 'Failed.'; return; }
    if (keyEl) keyEl.value = '';
    if (valEl) valEl.value = '';
    const applyBtn = document.getElementById('env-apply-btn-' + tid);
    if (applyBtn) applyBtn.style.display = '';
    const list = document.getElementById('env-list-' + tid);
    if (list) list.dataset.loaded = '';
    loadEnvVars(tenant, tid);
  } catch (e) { if (errEl) errEl.textContent = 'Request failed.'; }
}

async function deleteEnvVar(tenant, tid, key) {
  const errEl = document.getElementById('env-err-' + tid);
  if (errEl) errEl.textContent = '';
  try {
    const data = await authFetch(`/api/my/tenants/${tenant}/env/${encodeURIComponent(key)}`, { method: 'DELETE' });
    if (!data.ok) { if (errEl) errEl.textContent = data.error || 'Failed.'; return; }
    const list = document.getElementById('env-list-' + tid);
    if (list) list.dataset.loaded = '';
    loadEnvVars(tenant, tid);
  } catch (e) { if (errEl) errEl.textContent = 'Request failed.'; }
}

async function applyEnv(tenant, tid) {
  const btn   = document.getElementById('env-apply-btn-' + tid);
  const errEl = document.getElementById('env-err-' + tid);
  if (btn) { btn.disabled = true; btn.textContent = 'Applying...'; }
  if (errEl) errEl.textContent = '';
  try {
    const data = await authFetch(`/api/my/tenants/${tenant}/env/apply`, { method: 'POST' });
    if (!data.ok) {
      if (errEl) errEl.textContent = data.error || 'Apply failed.';
      if (btn) { btn.disabled = false; btn.textContent = 'Apply & Restart'; }
      return;
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Apply & Restart'; }
    const notice = document.createElement('div');
    notice.className = 'env-notice success';
    notice.textContent = 'Environment variables applied. Your instance is restarting and will be live within 30 seconds.';
    const panel = document.getElementById('env-panel-' + tid);
    if (panel) panel.insertBefore(notice, panel.firstChild);
    setTimeout(() => { if (notice.parentNode) notice.parentNode.removeChild(notice); }, 8000);
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Apply & Restart'; }
    if (errEl) errEl.textContent = 'Request failed.';
  }
}

// ── Team / Org members ──
async function loadOrgMembers(orgId, tid, tenantSlug) {
  const list = document.getElementById('team-list-' + tid);
  if (!list || list.dataset.loaded) return;
  list.innerHTML = '<div style="padding:20px 24px;color:var(--muted);font-size:13px;">Loading…</div>';
  try {
    const data = await authFetch(`/api/v1/orgs/${orgId}/members`);
    if (!data.ok) throw new Error(data.error || 'Error');
    list.dataset.loaded = '1';
    const members = data.members || [];

    // Populate transfer-to dropdown
    const transferSel = document.getElementById('transfer-to-' + tid);
    if (transferSel) {
      transferSel.innerHTML = '<option value="">— select member —</option>' +
        members
          .filter(m => m.role !== 'viewer')
          .map(m => `<option value="${escJs(m.user_id)}">${escJs(m.email || m.user_id)} (${m.role})</option>`)
          .join('');
    }
    if (!members.length) {
      list.innerHTML = '<div style="padding:20px 24px;color:var(--muted);font-size:13px;">No team members yet. Invite someone below.</div>';
      return;
    }
    const ownerCount = members.filter(m => m.role === 'owner').length;

    // ── Single-owner nudge — shown as a card above the member list ──────────
    const nudge = ownerCount < 2 ? `
      <div style="display:flex;align-items:flex-start;gap:12px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.22);padding:12px 16px;margin:0 24px 12px;">
        <span style="font-size:16px;line-height:1.2;flex-shrink:0;">⚠️</span>
        <div style="font-size:12px;line-height:1.6;color:var(--muted);">
          <strong style="color:var(--amber);font-size:13px;">You are the only Owner.</strong><br>
          If you lose access, no one else can manage billing or team members.
          Invite a trusted colleague as <strong style="color:var(--text);">Owner</strong> for account recovery.
        </div>
      </div>` : '';

    const roleColors = { owner: 'var(--green)', admin: 'var(--accent)', developer: 'var(--accent2)', member: 'var(--text)', viewer: 'var(--muted)' };
    const roleBg     = { owner: 'rgba(16,185,129,0.08)', admin: 'rgba(139,92,246,0.08)', developer: 'rgba(16,185,129,0.08)', member: 'var(--bg-lifted)', viewer: 'var(--bg4)' };

    list.innerHTML = nudge + `<div style="display:flex;flex-direction:column;gap:0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);">` +
      members.map(m => {
        const initials   = (m.email || m.user_id || '?').slice(0, 2).toUpperCase();
        const isRestricted = !!m.tenant_id;
        const rc = roleColors[m.role] || 'var(--muted)';
        const rb = roleBg[m.role]    || 'var(--bg-lifted)';
        return `<div style="display:flex;align-items:center;gap:12px;padding:10px 24px;border-bottom:1px solid var(--border);transition:background 0.15s;" onmouseenter="this.style.background='var(--bg-lifted)'" onmouseleave="this.style.background=''">
          <div style="width:32px;height:32px;border-radius:50%;background:${rb};border:1px solid ${rc};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${rc};flex-shrink:0;font-family:'Source Code Pro','SFMono-Regular','DM Mono',monospace;">${escHtml(initials)}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;color:var(--text);font-family:'Source Code Pro','SFMono-Regular','DM Mono',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(m.email || m.user_id)}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
              <span style="font-size:10px;font-weight:600;color:${rc};letter-spacing:0.5px;">${escHtml(m.role)}</span>
              ${isRestricted ? `<span style="font-size:9px;color:var(--faint);background:var(--bg-lifted);border:1px solid var(--border);padding:0 5px;letter-spacing:0.5px;">this instance only</span>` : ''}
            </div>
          </div>
          ${m.role !== 'owner' ? `<button class="pact pact-danger" style="font-size:10px;padding:2px 10px;flex-shrink:0;" data-action="remove-member" data-orgid="${escJs(orgId)}" data-uid="${escJs(m.user_id)}" data-tid="${escJs(tid)}">Remove</button>` : ''}
        </div>`;
      }).join('') + `</div>`;
    list.querySelectorAll('[data-action="remove-member"]').forEach(btn => {
      btn.addEventListener('click', () => removeMember(btn.dataset.orgid, btn.dataset.uid, btn.dataset.tid));
    });
  } catch (e) {
    list.innerHTML = `<div style="padding:16px 24px;color:var(--red);font-size:13px;">${escHtml(e.message)}</div>`;
  }
}

async function inviteMember(orgId, tid, tenantSlug) {
  const emailEl = document.getElementById('team-email-' + tid);
  const roleEl  = document.getElementById('team-role-'  + tid);
  const scopeEl = document.getElementById('team-scope-' + tid);
  const errEl   = document.getElementById('team-err-'   + tid);

  const email   = (emailEl?.value || '').trim().toLowerCase();
  const role    = roleEl?.value || 'member';
  const scoped  = scopeEl?.checked || false;

  if (errEl) errEl.textContent = '';
  if (!email) { if (errEl) errEl.textContent = 'Email is required.'; return; }

  try {
    const data = await authFetch(`/api/v1/orgs/${orgId}/members`, {
      method: 'POST',
      body: JSON.stringify({
        email,
        role,
        tenant_id: scoped ? (tenantSlug || null) : null
      }),
    });
    if (!data.ok) { if (errEl) errEl.textContent = data.error || 'Invite failed.'; return; }
    
    if (emailEl) emailEl.value = '';
    if (scopeEl) scopeEl.checked = false;
    
    if (data.invited) {
      showToast('Invitation email sent to ' + email + (scoped ? ' (Scoped)' : ''));
    } else {
      showToast('Member added: ' + email + (scoped ? ' (Scoped)' : ''));
    }
    
    const list = document.getElementById('team-list-' + tid);
    if (list) list.dataset.loaded = '';
    loadOrgMembers(orgId, tid);
  } catch (e) { if (errEl) errEl.textContent = 'Request failed.'; }
}

async function removeMember(orgId, userId, tid) {
  const ok = await confirmDialog('Remove member', 'Remove this member from the organization?', 'Remove', true);
  if (!ok) return;
  try {
    const data = await authFetch(`/api/v1/orgs/${orgId}/members/${userId}`, { method: 'DELETE' });
    if (!data.ok) { showToast(data.error || 'Remove failed.'); return; }
    showToast('Member removed.');
    const list = document.getElementById('team-list-' + tid);
    if (list) list.dataset.loaded = '';
    loadOrgMembers(orgId, tid);
  } catch (e) { showToast('Request failed.'); }
}

async function transferInstanceOwner(orgId, tid, tenantSlug) {
  const sel    = document.getElementById('transfer-to-' + tid);
  const errEl  = document.getElementById('transfer-err-' + tid);
  const toUser = sel?.value || '';
  if (errEl) errEl.textContent = '';
  if (!toUser) { if (errEl) errEl.textContent = 'Select a member to transfer to.'; return; }
  const toEmail = sel.options[sel.selectedIndex]?.text || toUser;
  const ok = await confirmDialog(
    'Transfer instance ownership',
    `Transfer ownership of this instance to ${toEmail}? This cannot be undone.`,
    'Transfer', true
  );
  if (!ok) return;
  try {
    const data = await authFetch(`/api/v1/orgs/${orgId}/instances/${tenantSlug}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ to_user_id: toUser }),
    });
    if (!data.ok) { if (errEl) errEl.textContent = data.error || 'Transfer failed.'; return; }
    showToast('Instance ownership transferred to ' + toEmail + '.');
    // Reload tenant list so the owner badge updates
    loadUserTenants();
  } catch (e) { if (errEl) errEl.textContent = 'Request failed.'; }
}

// ── Password change ──
function openChangePassword() {
  ['cp-current','cp-new','cp-confirm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const errEl = document.getElementById('cp-err');
  const btn   = document.getElementById('cp-btn');
  if (errEl) errEl.textContent = '';
  if (btn)   { btn.disabled = false; btn.textContent = 'Update password'; }
  document.getElementById('change-pass-modal')?.classList.add('open');
  setTimeout(() => document.getElementById('cp-current')?.focus(), 100);
}

function closeChangePassword() {
  document.getElementById('change-pass-modal')?.classList.remove('open');
}

async function submitChangePassword() {
  const current = document.getElementById('cp-current')?.value;
  const newPass = document.getElementById('cp-new')?.value;
  const confirm = document.getElementById('cp-confirm')?.value;
  const errEl   = document.getElementById('cp-err');
  const btn     = document.getElementById('cp-btn');
  if (errEl) errEl.textContent = '';
  if (!current)           { if (errEl) errEl.textContent = 'Current password is required.'; return; }
  if ((newPass || '').length < 8) { if (errEl) errEl.textContent = 'New password must be at least 8 characters.'; return; }
  if (newPass !== confirm) { if (errEl) errEl.textContent = 'Passwords do not match.'; return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Updating…'; }
  try {
    const data = await authFetch('/api/my/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: current, new_password: newPass }),
    });
    if (!data.ok) {
      if (errEl) errEl.textContent = data.error || 'Something went wrong.';
      if (btn) { btn.disabled = false; btn.textContent = 'Update password'; }
      return;
    }
    closeChangePassword();
    showToast('Password updated successfully.', 3000);
  } catch (e) {
    if (errEl) errEl.textContent = e.message;
    if (btn) { btn.disabled = false; btn.textContent = 'Update password'; }
  }
}

function checkPwMatch() {
  const n  = document.getElementById('cp-new')?.value    || '';
  const c  = document.getElementById('cp-confirm')?.value || '';
  const el = document.getElementById('cp-match');
  if (!el || !c) { if (el) el.textContent = ''; return; }
  if (n === c) { el.textContent = '✓ Passwords match'; el.style.color = 'var(--green)'; }
  else         { el.textContent = '✗ Passwords do not match'; el.style.color = 'var(--red)'; }
}

// ── Forgot/Reset ──
function openForgotModal() {
  const emailEl = document.getElementById('forgot-email');
  if (emailEl) emailEl.value = document.getElementById('portal-email')?.value || '';
  const msgEl = document.getElementById('forgot-msg');
  if (msgEl) { msgEl.textContent = ''; msgEl.style.color = 'var(--red)'; }
  const btn = document.getElementById('forgot-submit-btn');
  if (btn) { btn.textContent = 'Send reset link'; btn.disabled = false; }
  document.getElementById('forgot-modal')?.classList.add('open');
  setTimeout(() => document.getElementById('forgot-email')?.focus(), 100);
}
function closeForgotModal() {
  document.getElementById('forgot-modal')?.classList.remove('open');
}

async function submitForgot() {
  const email = (document.getElementById('forgot-email')?.value || '').trim().toLowerCase();
  const msg   = document.getElementById('forgot-msg');
  const btn   = document.getElementById('forgot-submit-btn');
  if (!email) { if (msg) { msg.style.color = 'var(--red)'; msg.textContent = 'Email required.'; } return; }
  if (btn) { btn.textContent = 'Sending…'; btn.disabled = true; }
  try {
    await apiFetch('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    if (msg) { msg.style.color = 'var(--green)'; msg.textContent = 'If that email exists, a reset link has been sent.'; }
    if (btn) btn.textContent = 'Sent';
  } catch (e) {
    if (msg) { msg.style.color = 'var(--red)'; msg.textContent = 'Request failed. Try again.'; }
    if (btn) { btn.textContent = 'Send reset link'; btn.disabled = false; }
  }
}

export function openResetModal(token) {
  ['reset-pass1','reset-pass2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const msgEl = document.getElementById('reset-msg');
  if (msgEl) { msgEl.textContent = ''; msgEl.style.color = 'var(--red)'; }
  const btn = document.getElementById('reset-submit-btn');
  if (btn) { btn.textContent = 'Set password'; btn.disabled = false; btn.dataset.token = token; }
  document.getElementById('reset-modal')?.classList.add('open');
  setTimeout(() => document.getElementById('reset-pass1')?.focus(), 100);
}

async function submitReset() {
  const p1  = document.getElementById('reset-pass1')?.value;
  const p2  = document.getElementById('reset-pass2')?.value;
  const msg = document.getElementById('reset-msg');
  const btn = document.getElementById('reset-submit-btn');
  if (msg) msg.style.color = 'var(--red)';
  if (!p1 || p1.length < 8) { if (msg) msg.textContent = 'Minimum 8 characters.'; return; }
  if (p1 !== p2)             { if (msg) msg.textContent = 'Passwords do not match.'; return; }
  const token = btn?.dataset.token || '';
  if (!token) { if (msg) msg.textContent = 'Invalid reset link.'; return; }
  if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
  try {
    const data = await apiFetch('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password: p1 }),
    });
    if (!data.ok) throw new Error(data.error || 'Reset failed');
    if (msg) { msg.style.color = 'var(--green)'; msg.textContent = 'Password updated! You can now sign in.'; }
    if (btn) btn.textContent = 'Done';
    history.replaceState(null, '', '/');
    setTimeout(() => {
      document.getElementById('reset-modal')?.classList.remove('open');
      document.getElementById('manage')?.scrollIntoView({ behavior: 'smooth' });
    }, 2000);
  } catch (e) {
    if (msg) msg.textContent = e.message || 'Reset failed. Link may have expired.';
    if (btn) { btn.textContent = 'Set password'; btn.disabled = false; }
  }
}

// ── Enterprise: extra domain management ──────────────────────────────────────

async function loadExtraDomains(orgId, tid) {
  const list = document.getElementById('extra-domains-list-' + tid);
  if (!list) return;
  try {
    const data = await authFetch(`/api/v1/orgs/${orgId}/domains`);
    if (!data.ok || !data.domains?.length) {
      list.innerHTML = '<div style="font-size:12px;color:var(--muted);">No additional domains yet.</div>';
      return;
    }
    list.innerHTML = data.domains.map(d => `
      <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);">
        <code style="font-size:12px;flex:1;">${escHtml(d.domain)}</code>
        ${d.is_verified
          ? `<span style="font-size:10px;color:var(--green);letter-spacing:1px;">&#10003; VERIFIED</span>`
          : `<span style="font-size:10px;color:var(--amber);">PENDING</span>
             <button class="pact" style="font-size:10px;padding:2px 8px;"
               data-action="verify-extra-domain" data-orgid="${escJs(orgId)}" data-domainid="${escJs(d.id)}" data-tid="${escJs(tid)}">
               Verify
             </button>`
        }
      </div>`).join('');
  } catch (e) {
    if (list) list.innerHTML = '<div style="font-size:12px;color:var(--red);">Failed to load domains.</div>';
  }
}

async function addExtraDomain(orgId, tid) {
  const input  = document.getElementById('extra-domain-input-' + tid);
  const errEl  = document.getElementById('extra-domain-err-' + tid);
  const domain = (input?.value || '').trim().toLowerCase();
  if (errEl) errEl.textContent = '';
  if (!domain) { if (errEl) errEl.textContent = 'Enter a domain.'; return; }
  try {
    const data = await authFetch(`/api/v1/orgs/${orgId}/domains`, {
      method: 'POST',
      body: JSON.stringify({ domain }),
    });
    if (!data.ok) {
      if (errEl) errEl.textContent = data.error || 'Failed to add domain.';
      return;
    }
    if (input) input.value = '';
    showToast(`Domain added: ${data.domain}. Add TXT record: ${data.dns_token}`);
    loadExtraDomains(orgId, tid);
  } catch (e) {
    if (errEl) errEl.textContent = 'Request failed.';
  }
}

async function verifyExtraDomain(orgId, domainId, tid) {
  try {
    const data = await authFetch(`/api/v1/orgs/${orgId}/domains/${domainId}/verify`, { method: 'POST' });
    if (data.ok && data.verified) {
      showToast(`${data.domain} verified!`, 'success');
      loadExtraDomains(orgId, tid);
    } else {
      showToast(data.error || 'TXT record not found yet.', 'warn');
    }
  } catch (e) {
    showToast('Verification request failed.', 'error');
  }
}
