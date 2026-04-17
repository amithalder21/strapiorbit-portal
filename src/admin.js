// ════════════════════════════════════════════
// admin.js — Strapi Orbit Admin Panel entry point
// ════════════════════════════════════════════
// All API calls go through _AF() which:
//   - Prefixes API_BASE (VITE_API_URL in production, empty in dev → Vite proxy)
//   - Adds Authorization: Bearer <adminToken>
//   - Returns parsed JSON (or raw Response for binary endpoints)
// ════════════════════════════════════════════
import { API_BASE } from './lib/api-client.js';

// _AF: admin API fetch — adds base URL + auth header automatically
async function _AF(path, opts) {
  opts = opts || {};
  // Don't add Content-Type for FormData (multipart restore)
  const isFormData = opts.body instanceof FormData;
  const headers = Object.assign(
    {},
    isFormData ? {} : { 'Content-Type': 'application/json' },
    adminToken ? { Authorization: 'Bearer ' + adminToken } : {},
    opts.headers || {}
  );
  const { headers: _ignore, ...restOpts } = opts;
  const res = await fetch(API_BASE + path, { ...restOpts, headers });
  
  if (res.status === 401) {
    adminToken = '';
    document.getElementById('unlock-screen').style.display = 'flex';
    document.getElementById('app-shell').style.display     = 'none';
    document.getElementById('unlock-err').textContent      = 'Session expired. Please log in again.';
  }
  
  return res;
}

/* ════════════════════════════════════════════
   THEME
════════════════════════════════════════════ */
function toggleTheme() {
  var html    = document.documentElement;
  var next    = html.getAttribute('data-theme') === 'classic' ? 'light' : 'classic';
  html.setAttribute('data-theme', next);
  localStorage.setItem('so-theme', next);
  document.getElementById('tog-label').textContent = next === 'classic' ? 'Light' : 'Classic';
}
(function initTheme() {
  var saved = localStorage.getItem('so-theme') || 'classic';
  if (saved === 'glass') saved = 'classic'; // migrate anyone on old glass pref
  document.documentElement.setAttribute('data-theme', saved);
  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('tog-label').textContent = saved === 'classic' ? 'Light' : 'Classic';
  });
})();

/* ════════════════════════════════════════════
   SIDEBAR NAVIGATION
════════════════════════════════════════════ */
var _sectionLoaded = {};

function showSection(id) {
  // Deactivate all
  document.querySelectorAll('.s-nav-btn').forEach(function(b) { b.classList.remove('active'); });
  document.querySelectorAll('.content-section').forEach(function(s) { s.classList.remove('active'); });

  // Activate selected
  var navBtn = document.getElementById('nav-' + id);
  var section = document.getElementById('section-' + id);
  if (navBtn)   navBtn.classList.add('active');
  if (section)  section.classList.add('active');

  // Scroll main area back to top on every section switch
  var mainArea = document.querySelector('.main-area');
  if (mainArea) mainArea.scrollTop = 0;

  // Lazy-load on first visit
  if (!_sectionLoaded[id]) {
    _sectionLoaded[id] = true;
    if (id === 'overview')      loadOverview();
    if (id === 'clusters')      loadClusters();
    if (id === 'users')         loadUsers();
    if (id === 'notifications') loadNotifications();
    if (id === 'ratelimits')    loadRateLimits();
    if (id === 'jobs')          loadJobs();
    if (id === 'subscriptions') loadSubscriptions();
    if (id === 'revenue')       loadRevenue();
    if (id === 'auditlog')      loadAuditLog();
    if (id === 'systemstatus')  loadSystemStatus();
    if (id === 'sessions')      loadSessions();
    if (id === 'organizations') loadOrganizations();
  }
}

/* ════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════ */
/** HTML-escape any string before injecting into innerHTML. */
function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function colorLine(line) {
  var safe = _esc(line);
  if (line.includes('\u2713'))
    return '<span style="color:var(--green)">'   + safe + '</span>';
  if (line.includes('\u2717') || line.toLowerCase().includes('error') || line.toLowerCase().includes('failed'))
    return '<span style="color:var(--red)">'     + safe + '</span>';
  if (line.includes('\u2501'))
    return '<span style="color:var(--accent3)">' + safe + '</span>';
  return safe;
}

function timeAgo(iso) {
  var diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)    return diff + 's ago';
  if (diff < 3600)  return Math.floor(diff/60) + 'm ago';
  if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
  return Math.floor(diff/86400) + 'd ago';
}

const ALL_REGIONS = [
  { id: 'us-prod', label: 'US',   subLabel: 'United States' },
  { id: 'eu-prod', label: 'EU',   subLabel: 'Europe'        },
  { id: 'ap-prod', label: 'ASIA', subLabel: 'Asia Pacific'  },
];

/* ════════════════════════════════════════════
   CLIENT-SIDE PAGINATION
   Usage:
     _pagInit('sectionId', allRows, renderFn, 'pg-element-id')
     _pagFilter('sectionId', filteredRows)   — after filter change
     _pagGo('sectionId', pageNumber)         — called by pag-btn onclick
════════════════════════════════════════════ */
var _PAGE_SIZE = 25;
var _pagSt = {};

function _pagInit(id, allRows, renderFn, pagElId) {
  _pagSt[id] = { filtered: allRows, page: 1, renderFn: renderFn, pagEl: pagElId };
  _pagDraw(id);
}

function _pagFilter(id, filteredRows) {
  if (!_pagSt[id]) return;
  _pagSt[id].filtered = filteredRows;
  _pagSt[id].page = 1;
  _pagDraw(id);
}

function _pagGo(id, page) {
  if (!_pagSt[id]) return;
  _pagSt[id].page = page;
  _pagDraw(id);
  var mainArea = document.querySelector('.main-area');
  if (mainArea) mainArea.scrollTop = 0;
}

function _pagDraw(id) {
  var st = _pagSt[id];
  if (!st) return;
  var total = st.filtered.length;
  var totalPages = Math.max(1, Math.ceil(total / _PAGE_SIZE));
  var page = Math.max(1, Math.min(st.page, totalPages));
  st.page = page;
  var slice = st.filtered.slice((page - 1) * _PAGE_SIZE, page * _PAGE_SIZE);
  st.renderFn(slice);
  _drawPagBar(st.pagEl, total, page, id);
  if (window.lucide) lucide.createIcons();
}

function _drawPagBar(elId, total, page, sectionId) {
  var el = document.getElementById(elId);
  if (!el) return;
  var totalPages = Math.ceil(total / _PAGE_SIZE);
  if (total === 0 || totalPages <= 1) { el.innerHTML = ''; return; }
  var start = (page - 1) * _PAGE_SIZE + 1;
  var end   = Math.min(page * _PAGE_SIZE, total);
  var sid   = _esc(sectionId);
  var prev  = page > 1
    ? '<button class="pag-btn" onclick="_pagGo(\'' + sid + '\',' + (page - 1) + ')">&#8249;</button>'
    : '<button class="pag-btn pag-disabled" disabled>&#8249;</button>';
  var next  = page < totalPages
    ? '<button class="pag-btn" onclick="_pagGo(\'' + sid + '\',' + (page + 1) + ')">&#8250;</button>'
    : '<button class="pag-btn pag-disabled" disabled>&#8250;</button>';
  var nums = [];
  var lo = Math.max(1, page - 2), hi = Math.min(totalPages, page + 2);
  if (lo > 1) {
    nums.push('<button class="pag-btn pag-num" onclick="_pagGo(\'' + sid + '\',1)">1</button>');
    if (lo > 2) nums.push('<span class="pag-ellipsis">…</span>');
  }
  for (var p = lo; p <= hi; p++) {
    nums.push('<button class="pag-btn pag-num' + (p === page ? ' pag-active' : '') + '" onclick="_pagGo(\'' + sid + '\',' + p + ')">' + p + '</button>');
  }
  if (hi < totalPages) {
    if (hi < totalPages - 1) nums.push('<span class="pag-ellipsis">…</span>');
    nums.push('<button class="pag-btn pag-num" onclick="_pagGo(\'' + sid + '\',' + totalPages + ')">' + totalPages + '</button>');
  }
  el.innerHTML = '<div class="pag-bar"><span class="pag-info">' + start + '–' + end + ' of ' + total + '</span><div class="pag-btns">' + prev + nums.join('') + next + '</div></div>';
}

function renderGitCell(t) {
  var repo       = t.git_repo      || '';
  var lastDeploy = t.last_deploy_at || '';
  var imageTag   = t.current_image  || '';
  var shortTag   = imageTag ? imageTag.split(':').pop() : '';
  var shortRepo  = repo ? repo.replace('https://github.com/','').replace('https://gitlab.com/','') : '';
  var deployAgo  = lastDeploy ? timeAgo(lastDeploy) : '';

  var tenantJson = _esc(JSON.stringify({git_repo: t.git_repo||'', git_branch: t.git_branch||'main', git_base_dir: t.git_base_dir||'', node_version: t.node_version||'22'}));
  if (repo) {
    return '<div class="git-cell">' +
      '<div style="color:var(--accent);word-break:break-all;" title="' + _esc(repo) + '">\u2387 ' + _esc(shortRepo) + '</div>' +
      (shortTag  ? '<div style="color:var(--muted);font-family:\'DM Mono\',monospace;">' + _esc(shortTag) + '</div>' : '') +
      (deployAgo ? '<div style="color:var(--faint);">deployed ' + _esc(deployAgo) + '</div>' : '') +
      '<button class="btn btn-xs" style="margin-top:4px;opacity:0.6;" onclick="openConnectGit(\'' + _esc(t.tenant) + '\',JSON.parse(this.dataset.r))" data-r="' + tenantJson + '">Edit</button>' +
    '</div>';
  }
  return '<button class="btn btn-accent btn-xs" onclick="openConnectGit(\'' + _esc(t.tenant) + '\',JSON.parse(this.dataset.r))" data-r="' + tenantJson + '">+ Connect Git</button>';
}

/* ════════════════════════════════════════════
   STATS CARDS
════════════════════════════════════════════ */
function _setDelta(id, text, dir) {
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'stat-delta ' + (dir === 'up' ? 'trend-up' : dir === 'down' ? 'trend-down' : 'trend-flat');
}
function updateStatInstances(count, active) {
  document.getElementById('stat-instances').textContent = count;
  var badge = document.getElementById('nb-instances');
  badge.textContent = count;
  badge.classList.toggle('show', count > 0);
  if (active !== undefined) _setDelta('stat-instances-delta', active + ' active', active > 0 ? 'up' : 'flat');
}
function updateStatUsers(count, newThisWeek) {
  document.getElementById('stat-users').textContent = count;
  var badge = document.getElementById('nb-users');
  badge.textContent = count;
  badge.classList.toggle('show', count > 0);
  if (newThisWeek !== undefined) _setDelta('stat-users-delta', '+' + newThisWeek + ' this wk', newThisWeek > 0 ? 'up' : 'flat');
}
function updateStatClusters(up, total) {
  document.getElementById('stat-clusters').textContent = up + '/' + total;
  _setDelta('stat-clusters-delta', up === total ? 'all healthy' : (total - up) + ' down', up === total ? 'up' : 'down');
}
function updateStatPendingEmails(count) {
  document.getElementById('stat-pending-emails').textContent = count;
  var badge = document.getElementById('nb-notifications');
  badge.textContent = count;
  badge.classList.toggle('show', count > 0);
  _setDelta('stat-emails-delta', count > 0 ? 'queued' : 'clear', count > 0 ? 'down' : 'up');
}

/* ════════════════════════════════════════════
   ADMIN UNLOCK + TENANT TABLE
════════════════════════════════════════════ */
var adminToken    = '';   // opaque session token from /api/admin/login
var upgradePoller = null;

/** Return headers object with Authorization for all admin API calls. */
function _adminHeaders(extra) {
  return Object.assign({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken }, extra || {});
}

async function unlockAdmin() {
  var email  = (document.getElementById('admin-email').value || '').trim().toLowerCase();
  var pass   = document.getElementById('admin-pass').value;
  var errEl  = document.getElementById('unlock-err');
  var btn    = document.querySelector('.btn-unlock');
  errEl.textContent = '';
  if (!email || !pass) { errEl.textContent = 'Email and password are required.'; return; }
  if (btn) { btn.textContent = 'Authenticating…'; btn.disabled = true; }
  try {
    var res  = await _AF('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: pass })
    });
    var data = await res.json();
    if (!data.ok) {
      errEl.textContent = 'Invalid credentials';
      document.getElementById('admin-pass').value = '';
      document.getElementById('admin-pass').focus();
      if (btn) { btn.textContent = 'Unlock Admin Panel'; btn.disabled = false; }
      return;
    }
    adminToken = data.token;
    // Token lives in memory only — never in localStorage
    // Clear sensitive fields from DOM
    document.getElementById('admin-pass').value  = '';
    document.getElementById('admin-email').value = '';
    if (btn) { btn.textContent = 'Unlock Admin Panel'; btn.disabled = false; }
    showSection('instances');
    loadTenants();
    loadOverview();
  } catch (e) {
    errEl.textContent = 'Login failed: ' + _esc(e.message);
    if (btn) { btn.textContent = 'Unlock Admin Panel'; btn.disabled = false; }
  }
}

async function loadTenants() {
  var tbody = document.getElementById('tenant-tbody');
  tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:40px;color:var(--muted);">Loading...</td></tr>';

  try {
    var res  = await _AF('/api/tenants', {
      method:  'POST',
      body:    JSON.stringify({})
    });
    var data = await res.json();

    if (!data.ok) {
      document.getElementById('unlock-err').textContent = 'Session expired — please log in again';
      adminToken = '';
      document.getElementById('unlock-screen').style.display = 'flex';
      document.getElementById('app-shell').style.display     = 'none';
      return;
    }

    // Show app shell
    document.getElementById('unlock-screen').style.display = 'none';
    document.getElementById('app-shell').style.display     = 'flex';
    document.getElementById('unlock-err').textContent      = '';

    var count = data.tenants.length;
    document.getElementById('tenant-count').textContent =
      count + ' instance' + (count !== 1 ? 's' : '') + ' active';
    updateStatInstances(count);

    // Pre-load pending email count in background
    _AF('/api/admin/notifications', {
      method: 'POST',
      body: JSON.stringify({status: 'pending', limit: 1})
    }).then(function(r) { return r.json(); }).then(function(d) {
      if (d.ok) updateStatPendingEmails(d.count || 0);
    }).catch(function() {});

    if (count === 0) {
      tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">No instances launched yet.</div></div></td></tr>';
      return;
    }

    _allTenantRows = data.tenants;
    var countEl = document.getElementById('instances-filter-count');
    if (countEl) countEl.textContent = data.tenants.length + ' instances';
    if (_heatmapActive) renderHeatmap(_allTenantRows);
    _pagInit('instances', _allTenantRows, function(rows) {
      if (!rows.length) { tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--muted);">No instances match the filter.</td></tr>'; return; }
      tbody.innerHTML = rows.map(_renderTenantRow).join('');
    }, 'pg-instances');

  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--red);">Error: ' + _esc(e.message) + '</td></tr>';
  }
}

/* ════════════════════════════════════════════
   UPGRADE / DOWNGRADE
════════════════════════════════════════════ */
async function doUpgrade(tenant) {
  var sel    = document.getElementById('sel-' + tenant);
  var btn    = document.getElementById('btn-' + tenant);
  var newPkg = sel.value;

  btn.textContent = '...';
  btn.disabled    = true;
  btn.className   = 'btn btn-sm btn-working';

  var res  = await _AF('/api/upgrade', {
    method:  'POST',
    body:    JSON.stringify({ tenant: tenant, package: newPkg })
  });
  var data = await res.json();

  if (!data.ok) {
    btn.textContent = data.error || 'Error';
    btn.className   = 'btn btn-sm btn-fail';
    setTimeout(function () { btn.textContent = 'Apply'; btn.disabled = false; btn.className = 'btn btn-primary btn-sm'; }, 3000);
    return;
  }

  var drawer = document.getElementById('upgrade-log-drawer');
  var badge  = document.getElementById('upgrade-log-badge');
  drawer.style.display = 'block';
  badge.style.display  = 'inline-block';
  drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  if (upgradePoller) clearInterval(upgradePoller);
  upgradePoller = setInterval(async function () {
    var sr = await _AF('/api/status/' + data.job_id);
    var sd = await sr.json();
    document.getElementById('upgrade-log-body').innerHTML = sd.log.map(colorLine).join('<br>');
    document.getElementById('upgrade-log-body').scrollTop = 9999;

    if (sd.status === 'done') {
      clearInterval(upgradePoller);
      btn.textContent = 'Done';
      btn.className   = 'btn btn-sm btn-done';
      btn.disabled    = false;
      badge.style.display = 'none';
      document.getElementById('upgrade-status-txt').textContent = 'complete';
      document.getElementById('upgrade-status-txt').style.color = 'var(--green)';
      setTimeout(function () { loadTenants(); btn.textContent = 'Apply'; btn.className = 'btn btn-primary btn-sm'; }, 2500);
    } else if (sd.status === 'error') {
      clearInterval(upgradePoller);
      btn.textContent = 'Failed';
      btn.className   = 'btn btn-sm btn-fail';
      btn.disabled    = false;
      badge.style.display = 'none';
      document.getElementById('upgrade-status-txt').textContent = 'failed';
      document.getElementById('upgrade-status-txt').style.color = 'var(--red)';
    }
  }, 2500);
}

/* ════════════════════════════════════════════
   DELETE MODAL
════════════════════════════════════════════ */
var deleteTenantName = '';

function openDeleteModal(tenant) {
  deleteTenantName = tenant;
  document.getElementById('modal-tenant-name').textContent   = tenant;
  document.getElementById('modal-confirm-input').value       = '';
  document.getElementById('modal-confirm-input').placeholder = tenant;
  document.getElementById('modal-confirm-btn').disabled      = true;
  document.getElementById('delete-modal').classList.add('open');
  setTimeout(function () { document.getElementById('modal-confirm-input').focus(); }, 100);
}

function closeDeleteModal() {
  document.getElementById('delete-modal').classList.remove('open');
  document.getElementById('modal-confirm-input').value = '';
  deleteTenantName = '';
}

function checkModalConfirm() {
  var val = document.getElementById('modal-confirm-input').value.trim();
  document.getElementById('modal-confirm-btn').disabled = (val !== deleteTenantName);
}

async function confirmDelete() {
  var btn = document.getElementById('modal-confirm-btn');
  btn.textContent = 'Removing...';
  btn.disabled    = true;

  var res  = await _AF('/api/delete', {
    method:  'POST',
    body:    JSON.stringify({ tenant: deleteTenantName, confirm: deleteTenantName })
  });
  var data = await res.json();
  closeDeleteModal();
  if (!data.ok) { alert('Error: ' + (data.error || 'Unknown error')); return; }

  var drawer = document.getElementById('upgrade-log-drawer');
  var badge  = document.getElementById('upgrade-log-badge');
  drawer.style.display   = 'block';
  badge.style.display    = 'inline-block';
  badge.textContent      = 'removing...';
  badge.style.background = 'rgba(239,68,68,0.12)';
  badge.style.color      = 'var(--red)';
  document.getElementById('upgrade-status-txt').textContent = 'removing';
  document.getElementById('upgrade-status-txt').style.color = 'var(--red)';
  drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  var delBtn = document.getElementById('del-' + deleteTenantName);
  if (delBtn) { delBtn.disabled = true; delBtn.textContent = 'Removing...'; }

  if (upgradePoller) clearInterval(upgradePoller);
  upgradePoller = setInterval(async function () {
    var sr = await _AF('/api/status/' + data.job_id);
    var sd = await sr.json();
    document.getElementById('upgrade-log-body').innerHTML = sd.log.map(colorLine).join('<br>');
    document.getElementById('upgrade-log-body').scrollTop = 9999;

    if (sd.status === 'done') {
      clearInterval(upgradePoller);
      badge.style.display = 'none';
      document.getElementById('upgrade-status-txt').textContent = 'removed';
      document.getElementById('upgrade-status-txt').style.color = 'var(--green)';
      setTimeout(function () { loadTenants(); }, 1500);
    } else if (sd.status === 'error') {
      clearInterval(upgradePoller);
      badge.textContent = 'failed';
      document.getElementById('upgrade-status-txt').textContent = 'failed';
    }
  }, 2500);
}

/* ════════════════════════════════════════════
   CONNECT GIT MODAL
════════════════════════════════════════════ */
var _connectGitTenant    = '';
var _connectGitTenantRow = null;

function openConnectGit(tenant, tenantRow) {
  _connectGitTenant    = tenant;
  _connectGitTenantRow = tenantRow || null;
  document.getElementById('cg-tenant-name').textContent = tenant;
  // Pre-fill with existing values if available
  document.getElementById('cg-repo').value    = (tenantRow && tenantRow.git_repo)     || '';
  document.getElementById('cg-branch').value  = (tenantRow && tenantRow.git_branch)   || 'main';
  document.getElementById('cg-basedir').value = (tenantRow && tenantRow.git_base_dir) || '';
  var nodeEl = document.getElementById('cg-node');
  nodeEl.value = (tenantRow && tenantRow.node_version) || '22';
  document.getElementById('cg-rotate').checked  = false;
  document.getElementById('cg-result').innerHTML = '';
  document.getElementById('connect-git-modal').classList.add('open');
}
function closeConnectGit() {
  document.getElementById('connect-git-modal').classList.remove('open');
}

async function confirmConnectGit() {
  var repo     = document.getElementById('cg-repo').value.trim();
  var branch   = document.getElementById('cg-branch').value.trim() || 'main';
  var baseDir  = document.getElementById('cg-basedir').value.trim();
  var nodeVer  = document.getElementById('cg-node').value || '22';
  var rotate   = document.getElementById('cg-rotate').checked;
  var result   = document.getElementById('cg-result');
  if (!repo) { result.innerHTML = '<span style="color:var(--red);font-size:12px;">Repo URL is required.</span>'; return; }
  result.innerHTML = '<span style="color:var(--accent);font-size:12px;">Saving...</span>';
  try {
    var res  = await _AF('/api/tenants/' + _connectGitTenant + '/git', {
      method: 'POST',
      body: JSON.stringify({repo: repo, branch: branch, base_dir: baseDir, node_version: nodeVer, rotate_secret: rotate})
    });
    var data = await res.json();
    if (!data.ok) { result.innerHTML = '<span style="color:var(--red);font-size:12px;">' + _esc(data.error||'Error') + '</span>'; return; }
    var secretNote = data.secret_rotated
      ? '<div style="margin-top:6px;color:var(--amber);font-size:11px;">⚠ New secret generated — update it in GitHub/GitLab webhook settings.</div>'
      : '<div style="margin-top:6px;color:var(--muted);font-size:11px;">Deploy secret unchanged.</div>';
    result.innerHTML =
      '<div style="font-size:12px;line-height:1.8;background:var(--bg3);padding:12px;border-radius:8px;font-family:\'DM Mono\',monospace;word-break:break-all;">' +
      '<div style="color:var(--green);margin-bottom:6px;">✓ Saved</div>' +
      '<div><span style="color:var(--muted);">Webhook URL</span><br>' + _esc(data.webhook_url) + '</div>' +
      (data.secret_rotated ? '<div style="margin-top:6px;"><span style="color:var(--muted);">New Secret</span><br>' + _esc(data.webhook_secret) + '</div>' : '') +
      secretNote +
      '</div>';
    loadTenants();
  } catch(e) {
    result.innerHTML = '<span style="color:var(--red);font-size:12px;">Error: ' + _esc(e.message) + '</span>';
  }
}

/* ════════════════════════════════════════════
   BUILD LOGS
════════════════════════════════════════════ */
var _buildPollTimer = null;

async function showBuilds(tenant) {
  var drawer    = document.getElementById('build-log-drawer');
  var tenantEl  = document.getElementById('build-log-tenant');
  var historyEl = document.getElementById('build-history-list');
  var logBody   = document.getElementById('build-log-body');
  var statusEl  = document.getElementById('build-log-status');

  tenantEl.textContent = tenant;
  historyEl.innerHTML  = '<span style="font-size:11px;color:var(--muted);">Loading history...</span>';
  logBody.innerHTML    = '';
  statusEl.textContent = '';
  drawer.style.display = 'block';
  drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  if (_buildPollTimer) { clearInterval(_buildPollTimer); _buildPollTimer = null; }

  try {
    var res    = await _AF('/api/tenants/' + tenant + '/builds', {});
    var data   = await res.json();
    var builds = data.builds || [];

    if (!builds.length) {
      historyEl.innerHTML = '<span style="font-size:11px;color:var(--muted);">No deployments yet.</span>';
      return;
    }

    function chipColor(status) {
      if (status === 'done')    return 'var(--green)';
      if (status === 'error')   return 'var(--red)';
      if (status === 'running') return 'var(--amber)';
      return 'var(--muted)';
    }
    function renderChips(activeJobId, freshBuilds) {
      var list = freshBuilds || builds;
      historyEl.innerHTML = list.map(function (b) {
        var typeTag  = b.type ? '[' + b.type + '] ' : '';
        var label    = typeTag + (b.started_at ? b.started_at.slice(0,16).replace('T',' ') : b.job_id);
        var isActive = b.job_id === activeJobId;
        return '<span class="build-chip' + (isActive ? ' active' : '') + '" onclick="loadBuildLog(\'' + tenant + '\',\'' + b.job_id + '\')">' +
          '<span class="build-chip-dot" style="background:' + chipColor(b.status) + ';"></span>' + label +
        '</span>';
      }).join('');
    }

    renderChips(builds[0].job_id);
    loadBuildLog(tenant, builds[0].job_id, renderChips);

  } catch (e) {
    historyEl.innerHTML = '<span style="font-size:11px;color:var(--red);">Error: ' + _esc(e.message) + '</span>';
  }
}

async function loadBuildLog(tenant, jobId, onChipRefresh) {
  var logBody  = document.getElementById('build-log-body');
  var statusEl = document.getElementById('build-log-status');

  if (_buildPollTimer) { clearInterval(_buildPollTimer); _buildPollTimer = null; }

  async function fetch_and_render() {
    var r    = await _AF('/api/status/' + jobId, {});
    var data = await r.json();
    logBody.innerHTML    = (data.log || []).map(colorLine).join('<br>');
    logBody.scrollTop    = logBody.scrollHeight;
    statusEl.textContent = data.status;
    statusEl.style.color = data.status === 'done'  ? 'var(--green)'
                         : data.status === 'error' ? 'var(--red)'
                         : 'var(--accent)';
    if (onChipRefresh) {
      var refreshRes  = await _AF('/api/tenants/' + tenant + '/builds', {});
      var refreshData = await refreshRes.json();
      onChipRefresh(jobId, refreshData.builds);
    }
    return data.status;
  }

  var status = await fetch_and_render();
  if (status === 'running' || status === 'queued') {
    _buildPollTimer = setInterval(async function () {
      var s = await fetch_and_render();
      if (s !== 'running' && s !== 'queued') { clearInterval(_buildPollTimer); _buildPollTimer = null; }
    }, 2000);
  }
}

/* ════════════════════════════════════════════
   CONTAINER LOGS
════════════════════════════════════════════ */
var _logDrawerTenant = null;

function openLogDrawer(tenant) {
  _logDrawerTenant = tenant;
  document.getElementById('container-log-tenant').textContent = tenant;
  var panel = document.getElementById('container-log-panel');
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  fetchContainerLogs(tenant);
}

function closeLogDrawer() {
  document.getElementById('container-log-panel').style.display = 'none';
  _logDrawerTenant = null;
}

function refreshLogDrawer() {
  if (_logDrawerTenant) fetchContainerLogs(_logDrawerTenant);
}

async function fetchContainerLogs(tenant) {
  var body   = document.getElementById('container-log-body');
  var count  = document.getElementById('log-drawer-count');
  var tail   = parseInt(document.getElementById('log-tail-sel').value) || 100;
  var since  = document.getElementById('log-since-sel').value || '1h';

  body.innerHTML = '<span style="color:var(--faint);">Fetching logs…</span>';
  count.textContent = '';

  try {
    var res  = await _AF('/api/admin/tenants/' + encodeURIComponent(tenant) + '/logs', {
      method: 'POST',
      body: JSON.stringify({ tail: tail, since: since })
    });
    var data = await res.json();

    if (!data.ok) {
      body.innerHTML = '<span style="color:var(--red);">Error: ' + _esc(data.error || 'unknown') + '</span>';
      return;
    }

    var lines = data.lines || [];
    count.textContent = lines.length + ' lines';

    if (!lines.length) {
      body.innerHTML = '<span style="color:var(--faint);">No log output in this time range.</span>';
      return;
    }

    body.innerHTML = lines.map(function(line) {
      var ts = '', msg = line;
      // kubectl --timestamps prepends RFC3339 timestamp
      var m = line.match(/^(\S+T\S+Z)\s+(.*)/);
      if (m) { ts = m[1].replace('T', ' ').replace('Z', ''); msg = m[2]; }

      var cls = 'log-line-info';
      if (/error|fatal|exception|panic/i.test(msg))  cls = 'log-line-err';
      else if (/warn/i.test(msg))                     cls = 'log-line-warn';

      return '<div class="' + cls + '">' +
        (ts ? '<span class="log-line-ts">' + _esc(ts) + '</span>' : '') +
        _esc(msg) +
      '</div>';
    }).join('');

    // Auto-scroll to bottom
    body.scrollTop = body.scrollHeight;

  } catch (e) {
    body.innerHTML = '<span style="color:var(--red);">Error: ' + _esc(e.message) + '</span>';
  }
}

/* ════════════════════════════════════════════
   CLUSTERS
════════════════════════════════════════════ */
async function loadClusters() {
  var grid = document.getElementById('cluster-grid');
  grid.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:20px 0;">Loading...</div>';
  try {
    var res  = await _AF('/api/admin/clusters', {
      method: 'POST',
      body: JSON.stringify({})
    });
    var data = await res.json();
    if (!data.ok) { grid.innerHTML = '<div style="color:var(--red);font-size:13px;">Error: ' + _esc(data.error||'unknown') + '</div>'; return; }

    var upCount = data.clusters.filter(function(c) { return c.reachable; }).length;
    updateStatClusters(upCount, data.clusters.length);

    grid.innerHTML = data.clusters.map(function (c) {
      var pingClass = c.reachable == null ? 'pending' : c.reachable ? 'up' : 'down';
      var pingLabel = c.reachable == null ? 'checking' : c.reachable ? ('up ' + (c.latency_ms != null ? c.latency_ms + 'ms' : '')) : 'unreachable';
      var lastDeploy = c.last_deploy ? timeAgo(c.last_deploy) : 'never';
      var grafanaLink = c.grafana
        ? '<a href="' + c.grafana + '" target="_blank">' + c.grafana.replace(/^https?:\/\//,'') + '</a>'
        : '<span style="color:var(--faint);">—</span>';
      var ingressVal = c.ingress || '<span style="color:var(--faint);">—</span>';
      return '<div class="cluster-card">' +
        '<div class="cluster-card-head">' +
          '<span class="cluster-card-name">' + c.id + '</span>' +
          '<span class="cluster-ping ' + pingClass + '">' +
            '<span class="cluster-ping-dot"></span>' + pingLabel +
          '</span>' +
        '</div>' +
        '<div class="cluster-stats">' +
          '<div class="cluster-stat"><div class="cluster-stat-val">' + c.active_tenants + '</div><div class="cluster-stat-lbl">Active instances</div></div>' +
          '<div class="cluster-stat"><div class="cluster-stat-val">' + c.provisioning_tenants + '</div><div class="cluster-stat-lbl">Setting up</div></div>' +
          '<div class="cluster-stat"><div class="cluster-stat-val">' + c.running_jobs + '</div><div class="cluster-stat-lbl">Active tasks</div></div>' +
          '<div class="cluster-stat"><div class="cluster-stat-val" style="font-size:13px;">' + lastDeploy + '</div><div class="cluster-stat-lbl">Last updated</div></div>' +
        '</div>' +
        '<div class="cluster-meta">' +
          '<div class="cluster-meta-row"><span style="color:var(--faint);width:72px;">Type</span>' + (c.provider ? c.provider.toUpperCase() : '—') + '</div>' +
          '<div class="cluster-meta-row"><span style="color:var(--faint);width:72px;">Location</span>' + (c.region || '—') + '</div>' +
          '<div class="cluster-meta-row"><span style="color:var(--faint);width:72px;">Gateway</span><span style="font-family:\'DM Mono\',monospace;font-size:10px;">' + ingressVal + '</span></div>' +
          '<div class="cluster-meta-row"><span style="color:var(--faint);width:72px;">Monitoring</span>' + grafanaLink + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  } catch (e) {
    grid.innerHTML = '<div style="color:var(--red);font-size:13px;">Error: ' + _esc(e.message) + '</div>';
  }
}

/* ════════════════════════════════════════════
   USERS
════════════════════════════════════════════ */
var _resetPassEmail  = '';
var _deleteUserEmail = '';
var _allUserRows     = [];

function _renderUsersTable(rows) {
  var tbody = document.getElementById('users-tbody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-text">No users match.</div></div></td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(function (u) {
    var role      = u.role === 'admin' ? 'admin' : 'user';
    var roleBadge = role === 'admin'
      ? '<span class="badge b-p">admin</span>'
      : '<span class="badge b-r">user</span>';
    var registered = u.created_at ? u.created_at.slice(0,10) : '—';
    var lastSeenParts = [];
    if (u.last_session) lastSeenParts.push('<span style="color:var(--muted);font-size:12px;">' + _esc(timeAgo(u.last_session)) + '</span>');
    if (u.active_sessions > 0) lastSeenParts.push(
      '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--green);">' +
      '<span style="width:5px;height:5px;border-radius:50%;background:var(--green);display:inline-block;"></span>' +
      u.active_sessions + ' active</span>'
    );
    var lastSeenCell = lastSeenParts.length ? lastSeenParts.join('<br>') : '<span style="color:var(--faint);">—</span>';
    var tenants = u.tenants || [];
    var subCell = tenants.length === 0
      ? '<span style="color:var(--faint);font-size:11px;">—</span>'
      : tenants.map(function(t) {
          var sc = (t.sub_status === 'active' || t.sub_status === 'free') ? 'var(--green)'
            : (t.sub_status === 'past_due' || t.sub_status === 'expiring_soon') ? 'var(--amber)'
            : (t.sub_status === 'expired' || t.sub_status === 'suspended' || t.sub_status === 'cancelled' || t.expired) ? 'var(--red)'
            : 'var(--muted)';
          var daysStr = t.days_left !== null && t.days_left !== undefined
            ? ' · <span style="color:' + sc + ';">' + (t.expired ? 'expired' : t.days_left + 'd') + '</span>'
            : (t.sub_status === 'free' ? ' · <span style="color:var(--green);">free</span>' : '');
          return '<div style="font-size:11px;white-space:nowrap;margin-bottom:2px;">' +
            '<span style="font-family:\'Source Code Pro\',monospace;color:var(--text);">' + _esc(t.tenant) + '</span>' +
            ' <span style="color:var(--muted);">' + _esc(t.plan) + '</span>' +
            daysStr + '</div>';
        }).join('');
    var ea = _esc(u.email);
    var actionsCell =
      '<div class="action-cell" style="display:flex;gap:5px;justify-content:center;align-items:center;flex-wrap:wrap;">' +
        '<button class="btn btn-xs" onclick="openGrantPerm(this.dataset.e)" data-e="' + ea + '" title="Grant org permission" style="background:rgba(139,92,246,0.08);border-color:rgba(139,92,246,0.28);color:var(--accent);">' +
          '<i data-lucide="shield-plus" style="width:11px;height:11px;"></i> Grant' +
        '</button>' +
        '<button class="btn btn-ghost btn-xs" onclick="openResetPass(this.dataset.e)" data-e="' + ea + '" title="Reset password">' +
          '<i data-lucide="key" style="width:11px;height:11px;"></i> Reset' +
        '</button>' +
        '<button class="btn btn-danger btn-xs" onclick="openDeleteUser(this.dataset.e)" data-e="' + ea + '" title="Delete user">' +
          '<i data-lucide="trash-2" style="width:11px;height:11px;"></i> Remove' +
        '</button>' +
      '</div>';
    return '<tr data-email="' + ea + '" data-role="' + role + '">' +
      '<td class="cell-mono" title="' + ea + '">' + _esc(u.email) + '</td>' +
      '<td class="cell-mid">' + roleBadge + '</td>' +
      '<td>' + _esc(registered) + '</td>' +
      '<td>' + (u.instance_count || 0) + '</td>' +
      '<td>' + subCell + '</td>' +
      '<td>' + lastSeenCell + '</td>' +
      '<td style="text-align:center;vertical-align:middle;">' + actionsCell + '</td>' +
    '</tr>';
  }).join('');
}

async function loadUsers() {
  var tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--muted);">Loading...</td></tr>';
  try {
    var res  = await _AF('/api/admin/users', { method: 'POST', body: JSON.stringify({}) });
    var data = await res.json();
    if (!data.ok) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--red);">' + _esc(data.error||'Error') + '</td></tr>'; return; }
    var count = data.users.length;
    document.getElementById('users-count').textContent = count + ' user' + (count !== 1 ? 's' : '');
    updateStatUsers(count);
    if (!count) {
      _renderUsersTable([]);
      return;
    }
    _allUserRows = data.users;
    _pagInit('users', _allUserRows, _renderUsersTable, 'pg-users');
    document.getElementById('users-filter-count').textContent = '';
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--red);">' + _esc(e.message) + '</td></tr>';
  }
}

function filterUsers() {
  var search = (document.getElementById('user-search').value || '').toLowerCase();
  var role   = (document.getElementById('user-role-filter').value || '').toLowerCase();
  var visible = _allUserRows.filter(function(u) {
    var email = (u.email || '').toLowerCase();
    var r     = u.role === 'admin' ? 'admin' : 'user';
    return (!search || email.includes(search)) && (!role || r === role);
  });
  var countEl = document.getElementById('users-filter-count');
  if (countEl) countEl.textContent = visible.length < _allUserRows.length ? visible.length + ' / ' + _allUserRows.length + ' shown' : '';
  _pagFilter('users', visible);
}

/* ════════════════════════════════════════════
   RATE LIMITS
════════════════════════════════════════════ */
async function loadRateLimits() {
  var tbody = document.getElementById('rate-limits-tbody');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--muted);">Loading...</td></tr>';
  try {
    var res  = await _AF('/api/admin/rate-limits', {
      method: 'POST',
      body: JSON.stringify({})
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Error');
    var rows = data.rate_limits || [];
    document.getElementById('rate-limits-sub').textContent =
      rows.length + ' IP(s) tracked — window: ' + (data.window_sec/60|0) + ' min, max: ' + data.max_hits + ' hits';

    function _renderRLPage(slice) {
      if (!slice.length) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">🛡</div><div class="empty-state-text">No rate-limited IPs.</div></div></td></tr>';
        return;
      }
      tbody.innerHTML = slice.map(function(r) {
        var statusBadge = r.blocked ? '<span class="badge b-blocked">blocked</span>' : '<span class="badge b-ok">ok</span>';
        var lastHit = r.last_hit ? new Date(r.last_hit * 1000).toLocaleString() : '—';
        var unblockBtn = r.blocked
          ? '<button class="btn btn-accent btn-xs" onclick="unblockIp(\'' + _esc(r.ip) + '\')" title="Unblock">' +
              '<i data-lucide="shield-check" style="width:11px;height:11px;"></i> Unblock' +
            '</button>'
          : '';
        return '<tr>' +
          '<td class="cell-mono cell-trunc">' + _esc(r.ip) + '</td>' +
          '<td style="text-align:center;vertical-align:middle;" class="cell-mono">' + r.hits + '</td>' +
          '<td class="cell-dim">' + _esc(lastHit) + '</td>' +
          '<td style="text-align:center;vertical-align:middle;">' + statusBadge + '</td>' +
          '<td style="text-align:center;vertical-align:middle;">' + unblockBtn + '</td>' +
        '</tr>';
      }).join('');
    }
    _pagInit('ratelimits', rows, _renderRLPage, 'pg-ratelimits');
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--red);">' + _esc(e.message) + '</td></tr>';
  }
}

/* ════════════════════════════════════════════
   NOTIFICATIONS
════════════════════════════════════════════ */
var _allNotifRows = [];

function _renderNotifPage(rows) {
  var tbody = document.getElementById('notif-tbody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">📬</div><div class="empty-state-text">No notifications.</div></div></td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(function(n) {
    var badgeCls = n.status === 'sent' ? 'b-sent' : n.status === 'failed' ? 'b-failed' : 'b-pending';
    var created  = n.created_at ? n.created_at.toString().substring(0,16).replace('T',' ') : '—';
    var err = n.last_error
      ? '<span style="color:var(--red);font-size:11px;font-family:\'Source Code Pro\',monospace;" title="'+_esc(n.last_error)+'">'+_esc(n.last_error.substring(0,60))+(n.last_error.length>60?'…':'')+'</span>'
      : '<span style="color:var(--faint);">—</span>';
    var resendBtn = (n.status === 'failed' || n.status === 'pending')
      ? '<button class="btn btn-accent btn-xs" onclick="resendNotification(\''+n.id+'\')" title="Resend">' +
          '<i data-lucide="send" style="width:11px;height:11px;"></i> Resend' +
        '</button>'
      : '';
    var ea = _esc(n.email||'');
    return '<tr data-email="'+ea+'">' +
      '<td class="cell-mono" style="color:var(--accent);font-size:11px;">'+_esc(n.type)+'</td>' +
      '<td class="cell-dim cell-trunc" title="'+ea+'">'+ea+'</td>' +
      '<td style="text-align:center;vertical-align:middle;"><span class="badge '+badgeCls+'">'+_esc(n.status)+'</span></td>' +
      '<td style="text-align:center;vertical-align:middle;" class="cell-dim">'+n.attempts+'</td>' +
      '<td class="cell-mono cell-dim">'+_esc(created)+'</td>' +
      '<td>'+err+'</td>' +
      '<td style="text-align:center;vertical-align:middle;">'+resendBtn+'</td>' +
    '</tr>';
  }).join('');
}

async function loadNotifications() {
  var tbody  = document.getElementById('notif-tbody');
  var sub    = document.getElementById('notif-sub');
  var filter = document.getElementById('notif-filter').value;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--muted);">Loading...</td></tr>';
  try {
    var res  = await _AF('/api/admin/notifications', { method: 'POST', body: JSON.stringify({status: filter, limit: 200}) });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Error');
    sub.textContent = data.count + ' notification(s)' + (filter ? ' · ' + filter : '');
    if (filter === 'pending' || !filter) updateStatPendingEmails(
      filter === 'pending' ? data.count : (data.notifications||[]).filter(function(n){return n.status==='pending';}).length
    );
    _allNotifRows = data.notifications || [];
    _pagInit('notifications', _allNotifRows, _renderNotifPage, 'pg-notifications');
    document.getElementById('notif-filter-count').textContent = '';
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--red);">'+_esc(e.message)+'</td></tr>';
  }
}

function filterNotifRows() {
  var search  = (document.getElementById('notif-email-search').value || '').toLowerCase();
  var visible = !search ? _allNotifRows : _allNotifRows.filter(function(n) {
    return (n.email || '').toLowerCase().includes(search);
  });
  var countEl = document.getElementById('notif-filter-count');
  if (countEl) countEl.textContent = search && visible.length < _allNotifRows.length ? visible.length + ' / ' + _allNotifRows.length + ' shown' : '';
  _pagFilter('notifications', visible);
}

/* ════════════════════════════════════════════
   UNBLOCK IP
════════════════════════════════════════════ */
async function unblockIp(ip) {
  try {
    var res  = await _AF('/api/admin/rate-limits/unblock', {
      method: 'POST',
      body: JSON.stringify({ip: ip})
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Error');
    showToast('Unblocked ' + ip);
    loadRateLimits();
  } catch(e) { showToast('Error: ' + e.message); }
}

/* ════════════════════════════════════════════
   USER MODALS
════════════════════════════════════════════ */
function openResetPass(email) {
  _resetPassEmail = email;
  document.getElementById('rp-email-label').textContent = email;
  document.getElementById('rp-new-pass').value = '';
  document.getElementById('rp-err').textContent = '';
  document.getElementById('reset-pass-modal').classList.add('open');
  setTimeout(function () { document.getElementById('rp-new-pass').focus(); }, 100);
}
function closeResetPass() {
  document.getElementById('reset-pass-modal').classList.remove('open');
  _resetPassEmail = '';
}
async function confirmResetPass() {
  var pass = document.getElementById('rp-new-pass').value.trim();
  var errEl = document.getElementById('rp-err');
  if (pass.length < 8) { errEl.textContent = 'Minimum 8 characters.'; return; }
  try {
    var res  = await _AF('/api/admin/users/' + encodeURIComponent(_resetPassEmail) + '/reset-password', {
      method: 'POST',
      body: JSON.stringify({new_password: pass})
    });
    var data = await res.json();
    if (!data.ok) { errEl.textContent = data.error || 'Error'; return; }
    closeResetPass();
    showToast('Password reset for ' + _resetPassEmail);
  } catch (e) { errEl.textContent = e.message; }
}

function openDeleteUser(email) {
  _deleteUserEmail = email;
  document.getElementById('du-email-label').textContent = email;
  document.getElementById('delete-user-modal').classList.add('open');
}
function closeDeleteUser() {
  document.getElementById('delete-user-modal').classList.remove('open');
  _deleteUserEmail = '';
}
async function confirmDeleteUser() {
  try {
    var res  = await _AF('/api/admin/users/' + encodeURIComponent(_deleteUserEmail), {
      method: 'DELETE',
      body: JSON.stringify({})
    });
    var data = await res.json();
    if (!data.ok) { alert('Error: ' + (data.error||'unknown')); return; }
    closeDeleteUser();
    showToast('User deleted');
    loadUsers();
  } catch (e) { alert('Error: ' + e.message); }
}

/* ════════════════════════════════════════════
   GRANT PERMISSION
════════════════════════════════════════════ */
var _grantPermEmail = '';

var _GP_ROLE_HINTS = {
  viewer: 'View instances, build logs, backup list, and subscription status. No write access.',
  member: 'Deploy, trigger builds, manage env vars, and create backups.',
  admin:  'Manage billing, invoices, git config, rollback, restore backups, and add/remove members.',
  owner:  'Full control — verify DNS, transfer org ownership, promote/demote any member, delete org.'
};

function openGrantPerm(email) {
  _grantPermEmail = email;
  document.getElementById('gp-email-label').textContent = email;
  document.getElementById('gp-err').textContent = '';

  var btn = document.getElementById('gp-confirm-btn');
  btn.textContent = 'Grant Access';
  btn.disabled = false;

  // Set initial role hint
  var roleSel = document.getElementById('gp-role-select');
  roleSel.value = 'member';
  document.getElementById('gp-role-hint').textContent = _GP_ROLE_HINTS['member'];
  roleSel.onchange = function () {
    document.getElementById('gp-role-hint').textContent = _GP_ROLE_HINTS[roleSel.value] || '';
  };

  // Load orgs
  var orgSel = document.getElementById('gp-org-select');
  orgSel.innerHTML = '<option value="">Loading organisations…</option>';

  _AF('/api/admin/organizations', { method: 'POST', body: JSON.stringify({}) })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d.ok || !d.organizations) {
        orgSel.innerHTML = '<option value="">Failed to load organisations</option>';
        return;
      }
      if (!d.organizations.length) {
        orgSel.innerHTML = '<option value="">No organisations found</option>';
        return;
      }
      orgSel.innerHTML = d.organizations.map(function (o) {
        var label = _esc(o.name) + (o.root_domain ? ' — ' + _esc(o.root_domain) : '');
        return '<option value="' + _esc(o.id) + '">' + label + '</option>';
      }).join('');
    })
    .catch(function () {
      orgSel.innerHTML = '<option value="">Error loading organisations</option>';
    });

  document.getElementById('grant-perm-modal').classList.add('open');
}

function closeGrantPerm() {
  document.getElementById('grant-perm-modal').classList.remove('open');
  _grantPermEmail = '';
}

async function confirmGrantPerm() {
  var orgId = document.getElementById('gp-org-select').value;
  var role  = document.getElementById('gp-role-select').value;
  var errEl = document.getElementById('gp-err');
  var btn   = document.getElementById('gp-confirm-btn');

  errEl.textContent = '';
  if (!orgId)           { errEl.textContent = 'Select an organisation.'; return; }
  if (!_grantPermEmail) { return; }

  btn.textContent = 'Granting…';
  btn.disabled = true;

  try {
    var res  = await _AF(
      '/api/admin/organizations/' + encodeURIComponent(orgId) + '/members',
      { method: 'POST', body: JSON.stringify({ email: _grantPermEmail, role: role }) }
    );
    var data = await res.json();
    if (!data.ok) {
      errEl.textContent = data.error || 'Failed to grant permission.';
      btn.textContent = 'Grant Access';
      btn.disabled = false;
      return;
    }
    closeGrantPerm();
    showToast(_grantPermEmail + ' granted ' + role + ' access');
  } catch (e) {
    errEl.textContent = e.message;
    btn.textContent = 'Grant Access';
    btn.disabled = false;
  }
}

/* ════════════════════════════════════════════
   TOAST
════════════════════════════════════════════ */
function showToast(msg) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(function () { el.classList.remove('show'); }, 2800);
}

/* ════════════════════════════════════════════
   INSTANCE SEARCH / FILTER
════════════════════════════════════════════ */
var _allTenantRows = [];   // cache from last loadTenants() call

function filterTenants() {
  var q      = (document.getElementById('instance-search').value || '').toLowerCase();
  var plan   = (document.getElementById('instance-plan-filter').value || '').toUpperCase();
  var region = (document.getElementById('instance-region-filter').value || '').toUpperCase();
  var tbody  = document.getElementById('tenant-tbody');

  var visible = _allTenantRows.filter(function(t) {
    var matchQ = !q || t.tenant.toLowerCase().includes(q) || (t.domain||'').toLowerCase().includes(q);
    var matchP = !plan   || (t.package||'').toUpperCase() === plan;
    var matchR = !region || _tenantRegionLabel(t) === region;
    return matchQ && matchP && matchR;
  });

  var countEl = document.getElementById('instances-filter-count');
  if (countEl) countEl.textContent = visible.length + ' of ' + _allTenantRows.length;
  _pagFilter('instances', visible);
}

function _tenantRegionLabel(t) {
  var region = ALL_REGIONS.find(function(r) { return r.id === (t.cluster_id || 'us-prod'); });
  return region ? region.label : (t.cluster_id || 'US').split('-')[0].toUpperCase();
}

function _renderTenantRow(t) {
  var pkg      = (t.package || 'unknown').toUpperCase();
  var badgeCls = pkg === 'STARTER' ? 'b-s' : pkg === 'PRO' ? 'b-p' : pkg === 'ENTERPRISE' ? 'b-e' : 'b-s';
  var healthOk = t.healthy === true;
  var healthUnk = t.healthy === null || t.healthy === undefined;
  var dotColor = healthOk ? 'var(--green)' : healthUnk ? 'var(--faint)' : 'var(--amber)';
  var prevTitle = t.previous_package ? ' title="was: ' + _esc(t.previous_package.toLowerCase()) + '"' : '';
  var regionLbl = _esc(_tenantRegionLabel(t));
  var tid = _esc(t.tenant);
  var ta  = _esc(t.tenant);
  var pkgLower = pkg.charAt(0) + pkg.slice(1).toLowerCase();

  // Upgrade cell: select + apply button side by side
  var upgradeCell =
    '<div class="upgrade-cell">' +
      '<select class="pkg-select" id="sel-' + ta + '">' +
        '<option value="starter"    ' + (pkg==='STARTER'?'selected':'') + '>Starter</option>' +
        '<option value="pro"        ' + (pkg==='PRO'?'selected':'')     + '>Pro</option>' +
        '<option value="enterprise" ' + (pkg==='ENTERPRISE'?'selected':'') + '>Enterprise</option>' +
      '</select>' +
      '<button class="btn btn-primary btn-xs" id="btn-' + ta + '" onclick="doUpgrade(this.dataset.t)" data-t="' + ta + '" title="Apply plan change">' +
        '<i data-lucide="check" style="width:11px;height:11px;"></i> Apply' +
      '</button>' +
    '</div>';

  // Actions cell: History | Logs | Remove as Lucide Icon + Text
  var actionsCell =
    '<div class="action-cell" style="display:flex;gap:8px;justify-content:center;align-items:center;">' +
      '<button class="btn btn-ghost btn-xs" onclick="showBuilds(\'' + ta + '\')" title="Deploy history"><i data-lucide="clock" style="width:11px;height:11px;"></i> History</button>' +
      '<button class="btn btn-accent btn-xs" onclick="openLogDrawer(\'' + ta + '\')" title="Container logs"><i data-lucide="terminal" style="width:11px;height:11px;"></i> Logs</button>' +
      '<button class="btn btn-danger btn-xs" id="del-' + ta + '" onclick="openDeleteModal(\'' + ta + '\')" title="Remove instance"><i data-lucide="trash-2" style="width:11px;height:11px;"></i> Remove</button>' +
    '</div>';

  return '<tr id="row-' + ta + '">' +
    '<td style="text-align:center;"><input type="checkbox" class="bulk-cb" data-t="' + ta + '" onchange="updateBulkBar()" style="cursor:pointer;accent-color:var(--accent);"></td>' +
    '<td><span style="font-family:\'DM Mono\',monospace;font-size:12px;cursor:pointer;color:var(--accent);" onclick="openTenant360(this.dataset.t)" data-t="' + ta + '" title="View 360°">' + tid + '</span></td>' +
    '<td><span style="font-size:11px;color:var(--muted);font-family:\'DM Mono\',monospace;">' + _esc(t.domain || '—') + '</span></td>' +
    '<td><span class="badge ' + badgeCls + '"' + prevTitle + '>' + pkgLower + '</span></td>' +
    '<td><span style="font-size:11px;color:var(--muted);">' + regionLbl + '</span></td>' +
    '<td><div class="health-pill"><div class="health-dot" style="background:' + dotColor + ';box-shadow:0 0 5px ' + dotColor + ';"></div><span style="color:' + dotColor + ';font-size:11px;font-family:\'DM Mono\',monospace;">' + _esc(t.pods || '?') + '</span></div></td>' +
    '<td>' + renderGitCell(t) + '</td>' +
    '<td>' + upgradeCell + '</td>' +
    '<td>' + actionsCell + '</td>' +
  '</tr>';
}

/* ════════════════════════════════════════════
   JOBS QUEUE
════════════════════════════════════════════ */
async function loadJobs() {
  var tbody   = document.getElementById('jobs-tbody');
  var sub     = document.getElementById('jobs-sub');
  var typeF   = document.getElementById('jobs-type-filter').value;
  var statusF = document.getElementById('jobs-status-filter').value;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--muted);">Loading...</td></tr>';
  try {
    var res  = await _AF('/api/admin/jobs', {
      method: 'POST',
      body: JSON.stringify({type: typeF, status: statusF, limit: 100})
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Error');
    sub.textContent = data.count + ' job(s)';

    // Update sidebar badge for running/queued jobs
    var active = (data.jobs || []).filter(function(j) { return j.status === 'running' || j.status === 'queued'; }).length;
    var nbJobs = document.getElementById('nb-jobs');
    nbJobs.textContent = active;
    nbJobs.classList.toggle('show', active > 0);

    if (!data.jobs.length) {
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">No jobs found.</div></div></td></tr>';
      return;
    }
    _allJobRows = data.jobs;
    function _renderJobPage(rows) {
      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">No jobs found.</div></div></td></tr>';
        return;
      }
      tbody.innerHTML = rows.map(function(j) {
        var sc = j.status==='done'?'b-done':j.status==='error'?'b-error':j.status==='running'?'b-running':'b-queued';
        var tc = j.type==='provision'?'b-s':j.type==='upgrade'?'b-p':j.type==='delete'?'b-blocked':'b-r';
        var typeLabel   = {provision:'Setup',upgrade:'Upgrade',delete:'Remove',build:'Deploy'}[j.type] || j.type;
        var statusLabel = {queued:'Scheduled',running:'In progress',done:'Completed',error:'Failed'}[j.status] || j.status;
        var pkg = j.package ? j.package.toLowerCase() : '—';
        var pc  = pkg==='starter'?'b-s':pkg==='pro'?'b-p':pkg==='enterprise'?'b-e':'b-r';
        var planRegion = '<span class="badge '+pc+'" style="font-size:10px;">'+_esc(pkg)+'</span>' +
          (j.cluster_id ? '<br><span class="cell-faint">'+_esc(j.cluster_id)+'</span>' : '');
        var queued   = j.queued_at   ? j.queued_at.toString().slice(0,16).replace('T',' ')   : null;
        var finished = j.finished_at ? j.finished_at.toString().slice(0,16).replace('T',' ') : null;
        var timing = '<span class="cell-faint">'+_esc(queued||'—')+'</span>';
        if (finished) timing += '<br><span class="cell-faint">→ '+_esc(finished)+'</span>';
        var errMsg = j.result && j.result.error ? String(j.result.error) : '';
        var result = errMsg
          ? '<span style="color:var(--red);font-size:11px;" title="'+_esc(errMsg)+'">'+_esc(errMsg.slice(0,50))+'</span>'
          : '<span style="color:var(--faint);font-size:11px;">—</span>';
        var retryBtn = (j.status==='error')
          ? '<button class="btn btn-accent btn-xs" onclick="retryJob(this.dataset.j)" data-j="'+_esc(j.job_id)+'" title="Retry job">' +
              '<i data-lucide="refresh-cw" style="width:11px;height:11px;"></i> Retry' +
            '</button>'
          : '';
        return '<tr data-tenant="'+_esc(j.tenant)+'">' +
          '<td class="cell-mid"><span class="badge '+tc+'">'+_esc(typeLabel)+'</span></td>' +
          '<td class="cell-mid"><span class="badge '+sc+'">'+_esc(statusLabel)+'</span></td>' +
          '<td class="cell-mono">'+_esc(j.tenant)+'</td>' +
          '<td>'+planRegion+'</td>' +
          '<td>'+timing+'</td>' +
          '<td>'+result+'</td>' +
          '<td style="text-align:center;vertical-align:middle;">'+retryBtn+'</td>' +
        '</tr>';
      }).join('');
    }
    _pagInit('jobs', _allJobRows, _renderJobPage, 'pg-jobs');
    filterJobRows();
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--red);">'+_esc(e.message)+'</td></tr>';
  }
}

var _allJobRows = [];
function filterJobRows() {
  var search  = (document.getElementById('jobs-tenant-search').value || '').toLowerCase();
  var visible = !search ? _allJobRows : _allJobRows.filter(function(j) { return (j.tenant||'').toLowerCase().includes(search); });
  var countEl = document.getElementById('jobs-filter-count');
  if (countEl) countEl.textContent = search && visible.length < _allJobRows.length ? visible.length + ' / ' + _allJobRows.length + ' shown' : '';
  if (_allJobRows.length) _pagFilter('jobs', visible);
}

async function retryJob(jobId) {
  try {
    var res  = await _AF('/api/admin/jobs/'+jobId+'/retry', {
      method: 'POST',
      body: JSON.stringify({})
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error||'Error');
    showToast('Retried — new job: ' + data.new_job_id.slice(0,8));
    setTimeout(loadJobs, 500);
  } catch(e) { showToast('Error: '+e.message); }
}

/* ════════════════════════════════════════════
   SUBSCRIPTIONS
════════════════════════════════════════════ */
var _extendTenant = '';

async function loadSubscriptions() {
  var tbody  = document.getElementById('subs-tbody');
  var sub    = document.getElementById('subs-sub');
  var statusF = document.getElementById('subs-status-filter').value;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--muted);">Loading...</td></tr>';
  try {
    var res  = await _AF('/api/admin/subscriptions', {
      method: 'POST',
      body: JSON.stringify({status: statusF, limit: 100})
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error||'Error');
    sub.textContent = data.count + ' subscription(s)';
    _allSubRows = data.subscriptions || [];
    _pagInit('subscriptions', _allSubRows, _renderSubPage, 'pg-subscriptions');
    filterSubscriptions();
    document.getElementById('subs-filter-count').textContent = '';
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--red);">'+_esc(e.message)+'</td></tr>';
  }
}

var _allSubRows = [];
function _renderSubPage(rows) {
  var tbody = document.getElementById('subs-tbody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">💳</div><div class="empty-state-text">No subscriptions found.</div></div></td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(function(s) {
    var sc = s.status==='active'?'b-ok':s.status==='past_due'?'b-pending':s.status==='trialing'?'b-s':'b-r';
    var pc = s.plan==='starter'?'b-s':s.plan==='pro'?'b-p':s.plan==='enterprise'?'b-e':'b-r';
    var updated = s.updated_at ? timeAgo(s.updated_at) : '—';
    var pe = s.current_period_end ? s.current_period_end.toString().slice(0,10) : null;
    var dc = s.days_left === null ? 'var(--faint)' : s.expired ? 'var(--red)' : s.days_left <= 7 ? 'var(--amber)' : 'var(--green)';
    var daysStr = s.days_left === null ? '' : s.expired ? 'expired' : s.days_left + 'd left';
    var billingCell = (pe ? '<span class="cell-mono cell-dim">'+_esc(pe)+'</span>' : '<span style="color:var(--faint);">—</span>') +
      (daysStr ? '<br><span style="font-size:11px;color:'+dc+';">'+_esc(daysStr)+'</span>' : '');
    var gw  = s.gateway ? ' <span style="font-size:10px;color:var(--faint);">'+_esc(s.gateway)+'</span>' : '';
    var ta  = _esc(s.tenant);
    var ea  = _esc(s.email || '');
    return '<tr data-tenant="'+ta+'" data-email="'+ea+'">' +
      '<td class="cell-mono">'+ta+'</td>' +
      '<td class="cell-dim cell-trunc" title="'+ea+'">'+_esc(s.email||'—')+'</td>' +
      '<td class="cell-mid"><span class="badge '+pc+'">'+_esc(s.plan)+'</span>'+gw+'</td>' +
      '<td class="cell-mid"><span class="badge '+sc+'">'+_esc(s.status)+'</span></td>' +
      '<td>'+billingCell+'</td>' +
      '<td class="cell-dim">'+_esc(updated)+'</td>' +
      '<td style="text-align:center;vertical-align:middle;">' +
        '<button class="btn btn-accent btn-xs" onclick="openExtend(this.dataset.t)" data-t="'+ta+'" title="Extend subscription">' +
          '<i data-lucide="calendar" style="width:11px;height:11px;"></i> Extend' +
        '</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

function filterSubscriptions() {
  var search  = (document.getElementById('subs-search').value || '').toLowerCase();
  var visible = !search ? _allSubRows : _allSubRows.filter(function(s) {
    return (s.tenant||'').toLowerCase().includes(search) || (s.email||'').toLowerCase().includes(search);
  });
  var countEl = document.getElementById('subs-filter-count');
  if (countEl) countEl.textContent = search && visible.length < _allSubRows.length ? visible.length + ' / ' + _allSubRows.length + ' shown' : '';
  if (_allSubRows.length) _pagFilter('subscriptions', visible);
}

function openExtend(tenant) {
  _extendTenant = tenant;
  document.getElementById('extend-tenant-label').textContent = tenant;
  document.getElementById('extend-days').value = 30;
  document.getElementById('extend-err').textContent = '';
  document.getElementById('extend-modal').classList.add('open');
  setTimeout(function() { document.getElementById('extend-days').focus(); }, 100);
}
function closeExtend() {
  document.getElementById('extend-modal').classList.remove('open');
  _extendTenant = '';
}
async function confirmExtend() {
  var days = parseInt(document.getElementById('extend-days').value);
  var errEl = document.getElementById('extend-err');
  if (!days || days < 1 || days > 365) { errEl.textContent = 'Enter 1–365 days.'; return; }
  try {
    var res  = await _AF('/api/admin/tenants/'+_extendTenant+'/subscription/extend', {
      method: 'POST',
      body: JSON.stringify({days: days})
    });
    var data = await res.json();
    if (!data.ok) { errEl.textContent = data.error||'Error'; return; }
    closeExtend();
    showToast('Extended '+_extendTenant+' by '+days+' days');
    if (_sectionLoaded['subscriptions']) loadSubscriptions();
  } catch(e) { errEl.textContent = e.message; }
}

/* ════════════════════════════════════════════
   REVENUE
════════════════════════════════════════════ */
function _fmtMoney(cents) {
  if (cents >= 100000) return '$' + (cents/100000).toFixed(1) + 'k';
  return '$' + (cents/100).toFixed(0);
}

async function loadRevenue() {
  document.getElementById('rev-mrr').textContent   = '…';
  document.getElementById('rev-month').textContent = '…';
  document.getElementById('rev-total').textContent = '…';
  try {
    var res  = await _AF('/api/admin/revenue', {
      method: 'POST',
      body: JSON.stringify({})
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error||'Error');

    document.getElementById('rev-mrr').textContent   = _fmtMoney(data.mrr_cents);
    document.getElementById('rev-month').textContent = _fmtMoney(data.month_payments.total_cents);
    document.getElementById('rev-month-sub').textContent = data.month_payments.count + ' payment(s) this month';
    document.getElementById('rev-total').textContent = _fmtMoney(data.total_payments.total_cents);
    document.getElementById('rev-total-sub').textContent = data.total_payments.count + ' total payments';

    // Plan breakdown
    var bd = data.plan_breakdown || {};
    var total = Object.values(bd).reduce(function(a,b){return a+b;},0) || 1;
    var planColors = {starter:'var(--accent)',pro:'var(--accent3)',enterprise:'var(--accent2)'};
    document.getElementById('plan-breakdown').innerHTML = ['starter','pro','enterprise'].map(function(p) {
      var cnt = bd[p] || 0;
      var pct = Math.round(cnt/total*100);
      return '<div class="plan-bar-row">' +
        '<div class="plan-bar-label">'+p+'</div>' +
        '<div class="plan-bar-track"><div class="plan-bar-fill" style="width:'+pct+'%;background:'+planColors[p]+';"></div></div>' +
        '<div class="plan-bar-count">'+cnt+'</div>' +
      '</div>';
    }).join('') || '<div style="color:var(--muted);font-size:13px;">No active subscriptions.</div>';

    // Monthly bar chart
    var monthly = data.monthly_chart || [];
    if (monthly.length) {
      var maxCents = Math.max.apply(null, monthly.map(function(m){return m.total_cents;})) || 1;
      document.getElementById('monthly-chart').innerHTML =
        '<div class="monthly-chart">' +
        monthly.map(function(m) {
          var pct = Math.round(m.total_cents / maxCents * 100);
          var lbl = m.month ? m.month.slice(0,7) : '';
          return '<div class="monthly-bar-wrap">' +
            '<div class="monthly-bar" style="height:'+pct+'%;" title="'+_fmtMoney(m.total_cents)+' · '+m.count+' payments"></div>' +
            '<div class="monthly-lbl">'+lbl+'</div>' +
          '</div>';
        }).join('') +
        '</div>';
    } else {
      document.getElementById('monthly-chart').innerHTML = '<div style="color:var(--muted);font-size:13px;padding:16px 0;">No payment data.</div>';
    }
  } catch(e) {
    document.getElementById('rev-mrr').textContent = 'Error';
    showToast('Revenue load failed: '+e.message);
  }
}

/* ════════════════════════════════════════════
   AUDIT LOG
════════════════════════════════════════════ */
async function loadAuditLog() {
  var tbody  = document.getElementById('audit-tbody');
  var sub    = document.getElementById('audit-sub');
  var actor  = document.getElementById('audit-actor').value.trim();
  var action = document.getElementById('audit-action').value.trim();
  var target = document.getElementById('audit-target').value.trim();
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted);">Loading...</td></tr>';
  try {
    var url  = (actor || action || target) ? '/api/admin/audit-log/filter' : '/api/admin/audit-log';
    var res  = await _AF(url, {
      method: 'POST',
      body: JSON.stringify({actor: actor, action: action, target: target, limit: 100})
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error||'Error');
    var entries = data.entries || [];
    sub.textContent = entries.length + ' entries';
    _pagInit('auditlog', entries, function(rows) {
      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">📄</div><div class="empty-state-text">No audit entries found.</div></div></td></tr>';
        return;
      }
      tbody.innerHTML = rows.map(function(e) {
        var ts = e.created_at ? e.created_at.toString().slice(0,19).replace('T',' ') : '—';
        var metaStr = e.meta && Object.keys(e.meta).length ? JSON.stringify(e.meta) : '';
        var meta = metaStr
          ? '<span class="audit-meta" title="'+_esc(metaStr)+'">'+_esc(metaStr.slice(0,60))+'</span>'
          : '<span style="color:var(--faint);">—</span>';
        return '<tr>' +
          '<td class="cell-faint">'+_esc(ts)+'</td>' +
          '<td class="cell-mono" style="color:var(--accent);">'+_esc(e.actor)+'</td>' +
          '<td class="cell-mono">'+_esc(e.action)+'</td>' +
          '<td class="cell-dim">'+_esc(e.target)+'</td>' +
          '<td class="cell-faint">'+_esc(e.ip||'—')+'</td>' +
          '<td>'+meta+'</td>' +
        '</tr>';
      }).join('');
    }, 'pg-auditlog');
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--red);">'+_esc(e.message)+'</td></tr>';
  }
}

/* ════════════════════════════════════════════
   SYSTEM STATUS
════════════════════════════════════════════ */
async function loadSystemStatus() {
  document.getElementById('sys-workers').innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);">Loading...</div>';
  document.getElementById('sys-queues').innerHTML  = '<div style="text-align:center;padding:24px;color:var(--muted);">Loading...</div>';
  try {
    var res  = await _AF('/api/admin/system-status', {
      method: 'POST',
      body: JSON.stringify({})
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error||'Error');

    var workerLabels = {'notif-worker':'Notification Service','job-watchdog':'Deployment Monitor','subs-expiry':'Subscription Manager'};
    document.getElementById('sys-workers').innerHTML =
      (data.workers||[]).map(function(w) {
        var dotCls = !w.alive ? 'dead' : w.idle_sec === null ? 'warn' : w.idle_sec < 120 ? 'ok' : 'warn';
        var idleTxt = w.idle_sec !== null ? w.idle_sec+'s ago' : 'Starting up';
        return '<div class="sys-row">' +
          '<div><div class="sys-name">'+(workerLabels[w.name]||w.name)+'</div>' +
          '<div class="sys-meta">'+w.name+' · '+idleTxt+'</div></div>' +
          '<div class="sys-dot '+dotCls+'"></div>' +
        '</div>';
      }).join('') +
      '<div class="sys-row" style="margin-top:4px;">' +
        '<div><div class="sys-name">Database</div><div class="sys-meta">Primary Data Store</div></div>' +
        '<div class="sys-dot '+(data.db?'ok':'dead')+'"></div>' +
      '</div>';

    document.getElementById('sys-queues').innerHTML =
      '<div class="sys-row"><div><div class="sys-name">Active Tasks</div><div class="sys-meta">Scheduled & in progress</div></div>' +
        '<span style="font-family:\'DM Mono\',monospace;font-size:18px;font-weight:500;color:'+(data.pending_jobs>0?'var(--amber)':'var(--green)')+';">'+data.pending_jobs+'</span></div>' +
      '<div class="sys-row"><div><div class="sys-name">Pending Notifications</div><div class="sys-meta">Outbound messages</div></div>' +
        '<span style="font-family:\'DM Mono\',monospace;font-size:18px;font-weight:500;color:'+(data.pending_notifs>0?'var(--amber)':'var(--green)')+';">'+data.pending_notifs+'</span></div>' +
      '<div class="sys-row"><div><div class="sys-name">Failed Operations (24h)</div><div class="sys-meta">Recent failures</div></div>' +
        '<span style="font-family:\'DM Mono\',monospace;font-size:18px;font-weight:500;color:'+(data.recent_job_errors>0?'var(--red)':'var(--green)')+';">'+data.recent_job_errors+'</span></div>' +
      '<div class="sys-row" style="border-bottom:none;"><div><div class="sys-name">Server time</div><div class="sys-meta">UTC</div></div>' +
        '<span style="font-size:11px;color:var(--muted);font-family:\'DM Mono\',monospace;">'+data.server_time.slice(0,19).replace('T',' ')+'</span></div>';

    _renderStorageSync(data.storage_sync || {});
  } catch(e) {
    document.getElementById('sys-workers').innerHTML = '<div style="color:var(--red);padding:20px;font-size:13px;">'+_esc(e.message)+'</div>';
    document.getElementById('sys-queues').innerHTML  = '';
  }
}

function _renderStorageSync(s) {
  var lastSyncTxt = s.last_sync
    ? s.last_sync.slice(0,19).replace('T',' ') + ' UTC'
    : 'Never';
  var statusDot = s.running
    ? '<span style="color:var(--amber);font-size:11px;">syncing…</span>'
    : s.error
      ? '<span style="color:var(--red);font-size:11px;">Error</span>'
      : s.last_sync
        ? '<span style="color:var(--green);font-size:11px;">OK</span>'
        : '<span style="color:var(--muted);font-size:11px;">Not yet run</span>';
  var errRow = s.error
    ? '<div class="sys-row" style="border-bottom:none;">' +
        '<div><div class="sys-name" style="color:var(--red);">Last Error</div>' +
        '<div class="sys-meta" style="color:var(--red);word-break:break-all;">'+_esc(s.error)+'</div></div></div>'
    : '';
  document.getElementById('storage-sync-body').innerHTML =
    '<div class="sys-row"><div><div class="sys-name">Last Sync</div><div class="sys-meta">Most recent completed run</div></div>' +
      '<span style="font-size:11px;color:var(--muted);font-family:\'DM Mono\',monospace;">'+_esc(lastSyncTxt)+'</span></div>' +
    '<div class="sys-row"><div><div class="sys-name">Status</div><div class="sys-meta">Current state</div></div>' +
      statusDot+'</div>' +
    '<div class="sys-row"><div><div class="sys-name">Last Run Pulled</div><div class="sys-meta">storage → local</div></div>' +
      '<span style="font-family:\'DM Mono\',monospace;font-size:14px;color:var(--accent);">'+(s.pulled||0)+'</span></div>' +
    '<div class="sys-row" style="border-bottom:none;">' +
      '<div><div class="sys-name">Last Run Pushed</div><div class="sys-meta">local → storage</div></div>' +
      '<span style="font-family:\'DM Mono\',monospace;font-size:14px;color:var(--accent);">'+(s.pushed||0)+'</span></div>' +
    errRow;
  var btn = document.getElementById('storage-sync-btn');
  if (btn) btn.disabled = !!s.running;
}

async function triggerStorageSync() {
  var btn = document.getElementById('storage-sync-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Syncing…'; }
  try {
    var res  = await _AF('/api/admin/storage/sync', {
      method: 'POST', body: JSON.stringify({})
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error||'Error');
    // Poll status after 3s to show progress
    setTimeout(loadSystemStatus, 3000);
  } catch(e) {
    alert('Sync failed: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Sync Now'; }
  }
}

async function previewEmail() {
  var type = document.getElementById('preview-type').value;
  try {
    var res  = await _AF('/api/admin/email-preview', {
      method: 'POST',
      body: JSON.stringify({type: type})
    });
    var data = await res.json();
    if (!data.ok) { showToast('Preview error: '+(data.error||'unknown')); return; }
    var wrap = document.getElementById('email-preview-wrap');
    var frame = document.getElementById('email-preview-frame');
    document.getElementById('email-preview-subject').textContent = 'Subject: ' + data.subject;
    wrap.style.display = 'block';
    frame.srcdoc = data.html;
  } catch(e) { showToast('Error: '+e.message); }
}

/* ════════════════════════════════════════════
   NOTIFICATIONS — RESEND
════════════════════════════════════════════ */
async function resendNotification(id) {
  try {
    var res  = await _AF('/api/admin/notifications/'+id+'/resend', {
      method: 'POST',
      body: JSON.stringify({})
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error||'Error');
    showToast('Resend scheduled');
    loadNotifications();
  } catch(e) { showToast('Error: '+e.message); }
}

/* ════════════════════════════════════════════
   BROADCAST
════════════════════════════════════════════ */
function openBroadcast() {
  document.getElementById('bc-subject').value   = '';
  document.getElementById('bc-body').value      = '';
  document.getElementById('bc-result').textContent = '';
  document.getElementById('broadcast-modal').classList.add('open');
  setTimeout(function() { document.getElementById('bc-subject').focus(); }, 100);
}
function closeBroadcast() {
  document.getElementById('broadcast-modal').classList.remove('open');
}
async function confirmBroadcast() {
  var subject = document.getElementById('bc-subject').value.trim();
  var body    = document.getElementById('bc-body').value.trim();
  var target  = document.getElementById('bc-target').value;
  var resultEl = document.getElementById('bc-result');
  if (!subject || !body) { resultEl.innerHTML = '<span style="color:var(--red);">Subject and message are required.</span>'; return; }
  resultEl.innerHTML = '<span style="color:var(--accent);">Sending…</span>';
  try {
    var res  = await _AF('/api/admin/broadcast', {
      method: 'POST',
      body: JSON.stringify({subject: subject, body: body, target: target})
    });
    var data = await res.json();
    if (!data.ok) { resultEl.innerHTML = '<span style="color:var(--red);">'+_esc(data.error||'Error')+'</span>'; return; }
    resultEl.innerHTML = '<span style="color:var(--green);">Queued for '+_esc(String(data.queued))+' recipient(s).</span>';
    setTimeout(closeBroadcast, 1800);
  } catch(e) { resultEl.innerHTML = '<span style="color:var(--red);">'+_esc(e.message)+'</span>'; }
}

/* ════════════════════════════════════════════
   BACKUP & RESTORE
════════════════════════════════════════════ */
async function downloadBackup() {
  var btn = document.getElementById('backup-btn');
  var statusEl = document.getElementById('backup-status');
  btn.disabled = true;
  btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Generating…';
  statusEl.textContent = 'Generating backup…';
  try {
    var res = await _AF('/api/admin/backup', {});
    if (!res.ok) {
      var d = await res.json().catch(function(){return {};});
      statusEl.innerHTML = '<span style="color:var(--red);">' + _esc(d.error || 'Backup failed') + '</span>';
      return;
    }
    var blob = await res.blob();
    var cd   = res.headers.get('Content-Disposition') || '';
    var match = cd.match(/filename=([^\s;]+)/);
    var fname = match ? match[1] : 'strapiorbit-backup.zip';
    var url   = URL.createObjectURL(blob);
    var a     = document.createElement('a');
    a.href = url; a.download = fname; a.click();
    URL.revokeObjectURL(url);
    statusEl.innerHTML = '<span style="color:var(--green);">✓ Downloaded ' + _esc(fname) + ' at ' + new Date().toLocaleTimeString() + '</span>';
  } catch(e) {
    statusEl.innerHTML = '<span style="color:var(--red);">Error: ' + _esc(e.message) + '</span>';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download Backup';
  }
}

async function restoreBackup() {
  var fileEl  = document.getElementById('restore-file');
  var btn     = document.getElementById('restore-btn');
  var statusEl = document.getElementById('restore-status');
  if (!fileEl.files.length) { showToast('Select a .zip backup file first.'); return; }
  var file = fileEl.files[0];
  if (!confirm('Restore from "' + file.name + '"?\n\nThe database will be updated and all tenant asset files will be overwritten. This cannot be undone.')) return;
  btn.disabled = true;
  btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Restoring…';
  statusEl.style.display = 'block';
  statusEl.innerHTML = '<span style="color:var(--muted);">Uploading and restoring…</span>';
  try {
    var fd = new FormData();
    fd.append('file', file);
    var headers = _adminHeaders();
    delete headers['Content-Type'];   // let browser set multipart boundary
    var res = await _AF('/api/admin/restore', { method: 'POST', headers: headers, body: fd });
    var d   = await res.json();
    if (!d.ok) {
      statusEl.innerHTML = '<span style="color:var(--red);">Restore failed: ' + _esc(d.error || 'unknown') + '</span>';
      return;
    }
    var r = d.results;
    var dbColor = (r.db === 'restored') ? 'var(--green)' : 'var(--yellow)';
    statusEl.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:4px;">' +
        '<div>DB: <span style="color:' + dbColor + ';font-family:\'DM Mono\',monospace;">' + _esc(r.db) + '</span></div>' +
        '<div>Assets: <span style="color:var(--green);font-family:\'DM Mono\',monospace;">' + r.assets_restored + ' file(s) restored</span></div>' +
        (r.assets_errors && r.assets_errors.length
          ? '<div style="color:var(--red);">Errors: ' + r.assets_errors.map(_esc).join(', ') + '</div>'
          : '') +
      '</div>';
  } catch(e) {
    statusEl.innerHTML = '<span style="color:var(--red);">Error: ' + _esc(e.message) + '</span>';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3"/></svg> Restore';
  }
}

/* ════════════════════════════════════════════
   EXPORT CSV
════════════════════════════════════════════ */
async function exportCSV(kind) {
  try {
    var res = await _AF('/api/admin/export/'+kind, {
      method: 'POST',
      body: JSON.stringify({})
    });
    if (!res.ok) { var d = await res.json(); showToast('Export error: '+(d.error||'unknown')); return; }
    var blob = await res.blob();
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = kind+'.csv'; a.click();
    URL.revokeObjectURL(url);
  } catch(e) { showToast('Export error: '+e.message); }
}

/* ════════════════════════════════════════════
   OVERVIEW DASHBOARD
════════════════════════════════════════════ */
async function loadOverview() {
  try {
    var res  = await _AF('/api/admin/overview', {
      method: 'POST', body: JSON.stringify({})
    });
    var d = await res.json();
    if (!d.ok) return;
    var fmt = function(cents) { return '$' + (cents / 100).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}); };

    // KPI values
    document.getElementById('ov-active').textContent      = d.active_instances ?? '—';
    document.getElementById('ov-users').textContent       = d.total_users ?? '—';
    document.getElementById('ov-mrr').textContent         = d.mrr_cents != null ? fmt(d.mrr_cents) : '—';
    document.getElementById('ov-jobs').textContent        = d.active_jobs ?? '—';

    // KPI sub-lines
    var prov = d.provisioning || 0;
    document.getElementById('ov-provisioning').textContent = prov ? prov + ' provisioning' : 'all stable';
    document.getElementById('ov-active-subs').textContent  = (d.active_subs || 0) + ' active subscriptions';
    document.getElementById('ov-month-rev').textContent    = d.month_revenue_cents != null ? fmt(d.month_revenue_cents) + ' this month' : '';
    var errs = d.job_errors_24h || 0;
    document.getElementById('ov-job-errors').textContent   = errs ? errs + ' errors in 24h' : 'no errors in 24h';

    // Provisioning badge (show count when > 0)
    var provBadge = document.getElementById('ov-provisioning-badge');
    if (prov > 0) { provBadge.textContent = prov; provBadge.style.display = ''; }
    else { provBadge.style.display = 'none'; }

    // Job errors badge (show count when > 0)
    var errBadge = document.getElementById('ov-job-errors-badge');
    if (errs > 0) { errBadge.textContent = errs; errBadge.style.display = ''; }
    else { errBadge.style.display = 'none'; }

    // Recent activity panel subtitle — pending notifications count
    var notifs = d.pending_notifs || 0;
    document.getElementById('ov-notifs-sub').textContent = notifs ? notifs + ' pending notification' + (notifs !== 1 ? 's' : '') : '';

    // Recent instances table — tenant names clickable
    var tbody = document.getElementById('ov-recent-tbody');
    var rows  = (d.recent_instances || []);
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--muted);">No instances yet</td></tr>';
    } else {
      tbody.innerHTML = rows.map(function(t) {
        var pkg = (t.package||'').toUpperCase();
        var bc  = pkg==='PRO'?'b-p':pkg==='ENTERPRISE'?'b-e':'b-s';
        var age = t.created_at ? timeAgo(t.created_at) : '—';
        var sc  = t.status==='active'?'b-ok':t.status==='provisioning'?'b-pending':'b-blocked';
        return '<tr>' +
          '<td><a class="t-link" onclick="openTenant360(' + JSON.stringify(t.tenant) + ');return false;" href="#" style="font-family:\'DM Mono\',monospace;font-size:12px;color:var(--accent);text-decoration:none;">' + _esc(t.tenant) + '</a></td>' +
          '<td><span class="badge ' + bc + '">' + _esc(pkg||'—') + '</span></td>' +
          '<td><span class="badge ' + sc + '">' + _esc(t.status||'—') + '</span></td>' +
          '<td style="color:var(--muted);font-size:12px;">' + _esc(age) + '</td></tr>';
      }).join('');
    }

    // Recent activity feed — CSS classes
    var feed = document.getElementById('ov-activity-feed');
    var acts = (d.recent_activity || []);
    if (!acts.length) {
      feed.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-size:12px;">No recent activity</div>';
    } else {
      feed.innerHTML = acts.map(function(a) {
        return '<div class="activity-item">' +
          '<div class="activity-dot"></div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div class="activity-action">' + _esc(a.action) + ' <span class="activity-target">' + _esc(a.target||'') + '</span></div>' +
            '<div class="activity-meta">' + _esc(a.actor||'system') + ' · ' + (a.created_at ? timeAgo(a.created_at) : '') + '</div>' +
          '</div></div>';
      }).join('');
    }

  } catch(e) { /* silently ignore on overview */ }
}

/* ════════════════════════════════════════════
   TENANT 360 DRAWER
════════════════════════════════════════════ */
function openTenant360(tenant) {
  document.getElementById('drawer-360-title').textContent = tenant;
  document.getElementById('drawer-360-sub').textContent   = 'Loading full profile…';
  document.getElementById('drawer-360-body').innerHTML    = '<div style="text-align:center;padding:40px;color:var(--muted);font-size:13px;">Loading…</div>';
  document.getElementById('drawer-360').classList.add('open');
  _load360(tenant);
}

function closeTenant360() {
  document.getElementById('drawer-360').classList.remove('open');
}

/* ════════════════════════════════════════════
   TRANSFER TENANT OWNER MODAL
════════════════════════════════════════════ */
function openTransferTenantOwner(tenant) {
  document.getElementById('tto-tenant').value          = tenant;
  document.getElementById('tto-tenant-name').textContent = tenant;
  document.getElementById('tto-email').value           = '';
  document.getElementById('tto-reason').value          = '';
  document.getElementById('tto-result').innerHTML      = '';
  var btn = document.getElementById('tto-btn');
  if (btn) { btn.textContent = 'Transfer'; btn.disabled = false; }
  document.getElementById('transfer-tenant-owner-modal').classList.add('open');
  setTimeout(function(){ document.getElementById('tto-email').focus(); }, 80);
}

function closeTransferTenantOwner() {
  document.getElementById('transfer-tenant-owner-modal').classList.remove('open');
}

async function confirmTransferTenantOwner() {
  var tenant = document.getElementById('tto-tenant').value.trim();
  var email  = (document.getElementById('tto-email').value || '').trim().toLowerCase();
  var reason = (document.getElementById('tto-reason').value || '').trim();
  var res_el = document.getElementById('tto-result');
  var btn    = document.getElementById('tto-btn');

  if (!email) {
    res_el.innerHTML = '<span style="color:var(--red);">New owner email is required.</span>';
    document.getElementById('tto-email').focus();
    return;
  }

  btn.textContent = 'Transferring…';
  btn.disabled    = true;
  res_el.innerHTML = '';

  try {
    var r = await _AF('/api/admin/tenants/' + encodeURIComponent(tenant) + '/transfer-owner', {
      method: 'POST',
      body:   JSON.stringify({ email: email, reason: reason }),
    });
    var d = await r.json();
    if (!d.ok) throw new Error(d.error || 'Transfer failed');

    res_el.innerHTML = '<span style="color:var(--green);">Transferred to ' + _esc(email) + '. Both parties notified.</span>';
    btn.textContent = 'Done';
    // Refresh the 360 drawer so the new owner email is visible
    setTimeout(function(){ _load360(tenant); }, 1500);
    // Refresh tenant table in background
    if (typeof loadTenants === 'function') setTimeout(loadTenants, 2000);
  } catch(e) {
    res_el.innerHTML = '<span style="color:var(--red);">' + _esc(e.message) + '</span>';
    btn.textContent = 'Transfer';
    btn.disabled    = false;
  }
}

async function adminTriggerBackup(tenant) {
  var btn = event.target;
  btn.disabled = true; btn.textContent = 'Starting…';
  try {
    var r = await _AF('/api/admin/tenants/' + encodeURIComponent(tenant) + '/backup', {
      method: 'POST', body: JSON.stringify({})
    });
    var d = await r.json();
    if (!d.ok) throw new Error(d.error || 'Failed');
    btn.textContent = 'Backup started';
    setTimeout(function(){ btn.disabled = false; btn.textContent = 'Export Now'; _load360(tenant); }, 4000);
  } catch(e) {
    btn.textContent = 'Error';
    setTimeout(function(){ btn.disabled = false; btn.textContent = 'Export Now'; }, 3000);
    showToast(e.message, 'error');
  }
}

async function adminDownloadBackup(tenant, backupId) {
  var btn = event.target;
  btn.disabled = true; btn.textContent = 'Downloading…';
  try {
    var r = await _AF('/api/admin/tenants/' + encodeURIComponent(tenant) + '/backups/' + encodeURIComponent(backupId) + '/download', {
      method: 'POST', body: JSON.stringify({})
    });
    if (!r.ok) throw new Error('Download failed');
    var blob = await r.blob();
    var cd   = r.headers.get('Content-Disposition') || '';
    var fn   = (cd.match(/filename="([^"]+)"/) || [])[1] || (tenant + '-backup.sql.gz');
    var a    = document.createElement('a');
    a.href   = URL.createObjectURL(blob);
    a.download = fn;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch(e) {
    showToast(e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '↓ Download';
  }
}

async function _load360(tenant) {
  try {
    var [res, backupRes] = await Promise.all([
      _AF('/api/admin/tenants/' + encodeURIComponent(tenant) + '/360', {
        method: 'POST', body: JSON.stringify({})
      }),
      _AF('/api/admin/tenants/' + encodeURIComponent(tenant) + '/backups', {
        method: 'POST', body: JSON.stringify({})
      })
    ]);
    var d  = await res.json();
    if (!d.ok) throw new Error(d.error || 'Error');
    try {
      var bd = backupRes.ok ? await backupRes.json() : {};
      d.backups = bd.ok ? bd.backups : [];
    } catch(e) { d.backups = []; }

    var t = d.tenant || {};
    document.getElementById('drawer-360-sub').textContent = (t.email || '') + ' · ' + (t.package || 'unknown') + ' · ' + (t.status || '');

    function kvRow(k, v) {
      return '<div class="data-pair"><span class="dp-lbl">' + _esc(k) + '</span><span class="dp-val">' + _esc(String(v||'—')) + '</span></div>';
    }
    function miniRows(rows, cols) {
      if (!rows || !rows.length) return '<div style="padding:8px;color:var(--faint);font-size:12px;">None</div>';
      return '<table class="d-mini-table"><thead><tr>' + cols.map(function(c){return '<th>'+_esc(c.label)+'</th>';}).join('') + '</tr></thead><tbody>' +
        rows.map(function(r) {
          return '<tr>' + cols.map(function(c) { return '<td>' + _esc(String(r[c.key]||'—')) + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody></table>';
    }

    var pkg = (t.package||'').toUpperCase();
    var bc  = pkg==='PRO'?'b-p':pkg==='ENTERPRISE'?'b-e':'b-s';
    var sc  = t.status==='active'?'b-ok':t.status==='provisioning'?'b-pending':'b-blocked';

    var html = '';

    // Identity
    html += '<div class="panel"><div class="panel-header"><div class="panel-header-left"><div class="panel-title">Identity</div><div class="panel-sub">Internal profile metadata for ' + _esc(t.tenant) + '</div></div></div>' +
      '<div class="data-list">' +
      kvRow('Tenant', t.tenant) + kvRow('Email', t.email) + kvRow('Domain', t.domain) +
      '<div class="data-pair"><span class="dp-lbl">Plan</span><span class="dp-val"><span class="badge ' + bc + '">' + _esc(pkg) + '</span></span></div>' +
      '<div class="data-pair"><span class="dp-lbl">Status</span><span class="dp-val"><span class="badge ' + sc + '">' + _esc(t.status||'—') + '</span></span></div>' +
      kvRow('Cluster', t.cluster_id) + kvRow('Ingress', t.ingress) +
      kvRow('Provisioned', t.provisioned_at ? t.provisioned_at.toString().slice(0,16).replace('T',' ') : '—') +
      kvRow('Created', t.created_at ? t.created_at.toString().slice(0,16).replace('T',' ') : '—') +
      '</div></div>';

    // Git / CI-CD
    if (t.git_repo) {
      html += '<div class="panel"><div class="panel-header"><div class="panel-header-left"><div class="panel-title">Git & CI/CD</div><div class="panel-sub">Repository synchronization details</div></div></div>' +
        '<div class="data-list">' +
        kvRow('Repo',         t.git_repo) +
        kvRow('Branch',       t.git_branch || 'main') +
        (t.git_base_dir ? kvRow('Base Directory', t.git_base_dir) : '') +
        kvRow('Node Version', t.node_version || '22') +
        kvRow('Last Commit',  t.last_commit_sha || '—') +
        kvRow('Last Deploy',  t.last_deploy_at ? t.last_deploy_at.toString().slice(0,16).replace('T',' ') : '—') +
        '</div></div>';
    }

    // Subscription
    var sub = d.subscription;
    if (sub) {
      html += '<div class="panel"><div class="panel-header"><div class="panel-header-left"><div class="panel-title">Subscription</div><div class="panel-sub">Payment and plan status</div></div></div>' +
        '<div class="data-list">' +
        kvRow('Plan', sub.plan) + kvRow('Status', sub.status) +
        kvRow('Period end', sub.current_period_end ? sub.current_period_end.toString().slice(0,10) : '—') +
        kvRow('Gateway', sub.gateway) + kvRow('Sub ID', sub.gateway_sub_id) +
        '</div></div>';
    }

    // Active sessions
    html += '<div class="panel"><div class="panel-header"><div class="panel-header-left"><div class="panel-title">Owner Sessions (' + (d.sessions||[]).length + ')</div><div class="panel-sub">Recent authenticated activity</div></div></div>' +
      '<div class="data-list" style="margin:0; border:none; box-shadow:none;">' +
      miniRows(d.sessions || [], [
        {key:'token_short', label:'Token'}, {key:'ip', label:'IP'},
        {key:'expires_at_short', label:'Expires'}
      ]) + '</div></div>';

    // Recent jobs
    html += '<div class="panel"><div class="panel-header"><div class="panel-header-left"><div class="panel-title">Recent Jobs</div><div class="panel-sub">Deployment and maintenance history</div></div></div>' +
      '<div class="data-list" style="margin:0; border:none; box-shadow:none;">' +
      miniRows(d.jobs || [], [
        {key:'type', label:'Type'}, {key:'status', label:'Status'},
        {key:'started_at_short', label:'Started'}
      ]) + '</div></div>';

    // Recent payments
    html += '<div class="panel"><div class="panel-header"><div class="panel-header-left"><div class="panel-title">Payments</div><div class="panel-sub">Recent transaction history</div></div></div>' +
      '<div class="data-list" style="margin:0; border:none; box-shadow:none;">' +
      miniRows(d.payments || [], [
        {key:'plan', label:'Plan'}, {key:'amount_fmt', label:'Amount'},
        {key:'status', label:'Status'}, {key:'created_at_short', label:'Date'}
      ]) + '</div></div>';

    // Invoices
    html += '<div class="panel"><div class="panel-header"><div class="panel-header-left"><div class="panel-title">Invoices</div><div class="panel-sub">Billing documentation</div></div></div>' +
      '<div class="data-list" style="margin:0; border:none; box-shadow:none;">' +
      miniRows(d.invoices || [], [
        {key:'invoice_number', label:'#'}, {key:'plan', label:'Plan'},
        {key:'amount_fmt', label:'Amount'}, {key:'status', label:'Status'}
      ]) + '</div></div>';

    // Audit
    html += '<div class="panel"><div class="panel-header"><div class="panel-header-left"><div class="panel-title">Recent Audit</div><div class="panel-sub">Administrative act history</div></div></div>' +
      '<div class="data-list" style="margin:0; border:none; box-shadow:none;">' +
      miniRows(d.audit || [], [
        {key:'action', label:'Action'}, {key:'actor', label:'Actor'},
        {key:'created_at_short', label:'When'}
      ]) + '</div></div>';

    // DB Backups
    html += '<div class="panel"><div class="panel-header"><div class="panel-header-left"><div class="panel-title">DB Backups</div><div class="panel-sub">Snapshot and disaster recovery metadata</div></div>' +
      '<div class="panel-header-right"><button class="btn btn-ghost btn-sm" onclick="adminTriggerBackup(\'' + _esc(t.tenant) + '\')">Export Now</button></div>' +
      '</div><div class="data-list" style="margin:0; border:none; box-shadow:none;" id="backup-list-' + _esc(t.tenant) + '">';
    var backups = d.backups || [];
    if (!backups.length) {
      html += '<div style="color:var(--muted);font-size:12px;padding:24px;text-align:center;">No backups yet</div>';
    } else {
      html += backups.map(function(b) {
        var dt  = b.created_at ? b.created_at.slice(0,16).replace('T',' ') : '—';
        var sz  = b.size_bytes > 0 ? (b.size_bytes / 1024).toFixed(1) + ' KB' : '—';
        var lbl = (b.type === 'scheduled' ? 'NIGHTLY' : 'MANUAL');
        var sc  = b.status === 'done' ? 'var(--green)' : b.status === 'error' ? 'var(--red)' : 'var(--amber)';
        
        return '<div class="data-pair">' +
          '<span class="dp-lbl">' + lbl + '</span>' +
          '<span class="dp-val">' +
            '<span style="font-size:12px; color:var(--muted);">' + dt + '</span>' +
            '<span style="font-size:12px; color:var(--muted); width:70px; text-align:right;">' + sz + '</span>' +
            (b.status === 'done' 
              ? '<button class="btn btn-xs btn-ghost" onclick="adminDownloadBackup(\'' + _esc(t.tenant) + '\',\'' + _esc(b.id) + '\')">Download</button>'
              : '<span style="color:' + sc + '; font-size:11px; width:80px; text-align:right;">' + b.status.toUpperCase() + '</span>') +
          '</span>' +
        '</div>';
      }).join('');
    }
    html += '</div></div>';

    document.getElementById('drawer-360-body').innerHTML = html;
  } catch(e) {
    document.getElementById('drawer-360-body').innerHTML = '<div style="padding:24px;color:var(--red);font-size:13px;">Error: ' + _esc(e.message) + '</div>';
  }
}

/* ════════════════════════════════════════════
   HEATMAP
════════════════════════════════════════════ */
var _heatmapActive = false;

function toggleHeatmap() {
  _heatmapActive = !_heatmapActive;
  document.getElementById('heatmap-view').style.display = _heatmapActive ? 'flex' : 'none';
  document.getElementById('table-view').style.display   = _heatmapActive ? 'none' : 'block';
  document.getElementById('btn-heatmap-toggle').classList.toggle('btn-primary', _heatmapActive);
  document.getElementById('btn-heatmap-toggle').classList.toggle('btn-ghost', !_heatmapActive);
  if (_heatmapActive) renderHeatmap(_allTenantRows);
}

function renderHeatmap(tenants) {
  var grid = document.getElementById('heatmap-view');
  if (!tenants || !tenants.length) {
    grid.innerHTML = '<div style="padding:24px;color:var(--muted);font-size:13px;">No instances</div>';
    return;
  }
  grid.innerHTML = tenants.map(function(t) {
    var cls = t.healthy  ? 'hm-green'
            : t.pods === '0' ? 'hm-red'
            : t.status === 'provisioning' ? 'hm-grey'
            : 'hm-amber';
    var pkg = (t.package||'?').slice(0,1).toUpperCase();
    return '<div class="hm-cell ' + cls + '" onclick="openTenant360(this.dataset.t)" data-t="' + _esc(t.tenant) + '" title="' + _esc(t.tenant) + ' · ' + _esc(t.package||'') + '">' +
      '<div class="hm-dot"></div>' +
      '<div class="hm-label">' + _esc(t.tenant) + '</div>' +
      '<div style="font-size:8px;opacity:0.6;">' + _esc(pkg) + '</div>' +
    '</div>';
  }).join('');
}

/* ════════════════════════════════════════════
   BULK ACTIONS
════════════════════════════════════════════ */
function toggleSelectAll(el) {
  document.querySelectorAll('.bulk-cb').forEach(function(cb) { cb.checked = el.checked; });
  updateBulkBar();
}

function updateBulkBar() {
  var selected = document.querySelectorAll('.bulk-cb:checked');
  var bar      = document.getElementById('bulk-bar');
  var label    = document.getElementById('bulk-count-label');
  var n        = selected.length;
  bar.classList.toggle('show', n > 0);
  label.textContent = n + ' selected';
}

function clearBulkSelection() {
  document.querySelectorAll('.bulk-cb').forEach(function(cb) { cb.checked = false; });
  var allChk = document.getElementById('bulk-check-all');
  if (allChk) allChk.checked = false;
  updateBulkBar();
}

function _getSelectedTenants() {
  return Array.from(document.querySelectorAll('.bulk-cb:checked')).map(function(cb) { return cb.dataset.t; });
}

function bulkEmail() {
  var tenants = _getSelectedTenants();
  if (!tenants.length) return;
  document.getElementById('bc-target').value = 'all';
  document.getElementById('bc-subject').value = '';
  document.getElementById('bc-body').value = '';
  document.getElementById('bc-result').textContent = '';
  // pre-fill a note about selected tenants
  document.getElementById('bc-body').placeholder = 'Message for: ' + tenants.join(', ');
  document.getElementById('broadcast-modal').classList.add('open');
}

async function bulkUpgrade() {
  var tenants = _getSelectedTenants();
  if (!tenants.length) return;
  if (!confirm('Upgrade ' + tenants.length + ' instance(s) to Pro?')) return;
  showToast('Queueing upgrades…');
  var errors = 0;
  for (var i = 0; i < tenants.length; i++) {
    try {
      var res  = await _AF('/api/upgrade', {
        method: 'POST',
        body: JSON.stringify({tenant: tenants[i], package: 'pro'})
      });
      var d = await res.json();
      if (!d.ok) errors++;
    } catch(e) { errors++; }
  }
  showToast(errors ? (errors + ' error(s) during bulk upgrade') : 'All upgrades queued');
  clearBulkSelection();
  setTimeout(loadTenants, 1500);
}

async function bulkDelete() {
  var tenants = _getSelectedTenants();
  if (!tenants.length) return;
  if (!confirm('Permanently remove ' + tenants.length + ' instance(s)? This cannot be undone.')) return;
  showToast('Queueing removals…');
  var errors = 0;
  for (var i = 0; i < tenants.length; i++) {
    try {
      var res  = await _AF('/api/delete', {
        method: 'POST',
        body: JSON.stringify({tenant: tenants[i], confirm: tenants[i]})
      });
      var d = await res.json();
      if (!d.ok) errors++;
    } catch(e) { errors++; }
  }
  showToast(errors ? (errors + ' error(s) during bulk remove') : 'All removals queued');
  clearBulkSelection();
  setTimeout(loadTenants, 2000);
}

/* ════════════════════════════════════════════
   SESSIONS
════════════════════════════════════════════ */
var _allSessions = [];

async function loadSessions() {
  var tbody = document.getElementById('sessions-tbody');
  var sub   = document.getElementById('sessions-sub');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted);">Loading…</td></tr>';
  try {
    var res  = await _AF('/api/admin/sessions', {
      method: 'POST', body: JSON.stringify({})
    });
    var d = await res.json();
    if (!d.ok) throw new Error(d.error || 'Error');
    _allSessions = d.sessions || [];
    sub.textContent = _allSessions.length + ' active session(s)';
    var nb = document.getElementById('nb-sessions');
    nb.textContent = _allSessions.length;
    nb.classList.toggle('show', _allSessions.length > 0);
    _pagInit('sessions', _allSessions, _renderSessions, 'pg-sessions');
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--red);">Error: ' + _esc(e.message) + '</td></tr>';
  }
}

function filterSessions() {
  var q = (document.getElementById('sessions-search').value || '').toLowerCase();
  if (!q) { _pagFilter('sessions', _allSessions); return; }
  _pagFilter('sessions', _allSessions.filter(function(s) {
    return (s.email||'').toLowerCase().includes(q) || (s.ip||'').toLowerCase().includes(q);
  }));
}

function _renderSessions(sessions) {
  var tbody = document.getElementById('sessions-tbody');
  if (!sessions.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">🔐</div><div class="empty-state-text">No active sessions.</div></div></td></tr>';
    return;
  }
  tbody.innerHTML = sessions.map(function(s) {
    var exp  = s.expires_at ? s.expires_at.toString().slice(0,16).replace('T',' ') : '—';
    var cre  = s.created_at ? s.created_at.toString().slice(0,16).replace('T',' ') : '—';
    var role = s.role === 'admin' ? '<span class="badge b-e">admin</span>' : '<span class="badge b-s">user</span>';
    var ua   = (s.user_agent || '').slice(0, 44) + ((s.user_agent||'').length > 44 ? '…' : '');
    // Connection: token short + IP
    var connCell = '<span style="font-family:\'DM Mono\',monospace;font-size:11px;color:var(--muted);">' + _esc(s.token_short||'—') + '</span>' +
      (s.ip ? '<br><span style="font-family:\'DM Mono\',monospace;font-size:11px;color:var(--faint);">' + _esc(s.ip) + '</span>' : '');
    // Session window: created + expires
    var windowCell = '<span style="font-size:11px;color:var(--muted);font-family:\'DM Mono\',monospace;">' + _esc(cre) + '</span>' +
      '<br><span style="font-size:11px;color:var(--faint);font-family:\'DM Mono\',monospace;">→ ' + _esc(exp) + '</span>';
    return '<tr>' +
      '<td style="font-size:12px;">' + _esc(s.email) + '</td>' +
      '<td>' + role + '</td>' +
      '<td>' + connCell + '</td>' +
      '<td style="font-size:11px;color:var(--muted);" title="' + _esc(s.user_agent||'') + '">' + _esc(ua) + '</td>' +
      '<td>' + windowCell + '</td>' +
      '<td style="text-align:center;vertical-align:middle;">' +
        '<button class="btn btn-danger btn-xs" onclick="revokeSession(this.dataset.tok)" data-tok="' + _esc(s.token) + '" title="Revoke session">' +
          '<i data-lucide="user-x" style="width:11px;height:11px;"></i> Revoke' +
        '</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

async function revokeSession(token) {
  if (!confirm('Revoke this session?')) return;
  try {
    var res  = await _AF('/api/admin/sessions/revoke', {
      method: 'POST',
      body: JSON.stringify({token: token})
    });
    var d = await res.json();
    if (!d.ok) throw new Error(d.error || 'Error');
    showToast('Session revoked');
    loadSessions();
  } catch(e) { showToast('Error: ' + e.message); }
}

/* ════════════════════════════════════════════
   INVOICES
════════════════════════════════════════════ */
async function loadInvoices() {
  var tbody  = document.getElementById('inv-tbody');
  var sub    = document.getElementById('inv-sub');
  var tenantF = (document.getElementById('inv-tenant-filter').value || '').trim();
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted);">Loading…</td></tr>';
  try {
    var res  = await _AF('/api/admin/invoices', {
      method: 'POST',
      body: JSON.stringify({tenant: tenantF || undefined, limit: 200})
    });
    var d = await res.json();
    if (!d.ok) throw new Error(d.error || 'Error');
    var invoices = d.invoices || [];
    sub.textContent = invoices.length + ' invoice(s)' + (tenantF ? ' for ' + tenantF : '');
    _pagInit('invoices', invoices, function(rows) {
      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">🧾</div><div class="empty-state-text">No invoices found.</div></div></td></tr>';
        return;
      }
      tbody.innerHTML = rows.map(function(inv) {
        var sc = inv.status==='paid'?'b-ok':inv.status==='void'?'b-r':inv.status==='draft'?'b-pending':'b-blocked';
        var amt = '$' + ((inv.amount_cents||0)/100).toFixed(2);
        var dt  = (inv.issued_at||'').toString().slice(0,10);
        var canVoid = inv.status !== 'void' && inv.status !== 'uncollectible';
        var tenantCell = '<span class="cell-mono" style="font-size:12px;">'+_esc(inv.tenant)+'</span>' +
          (inv.email ? '<br><span style="font-size:11px;color:var(--muted);">'+_esc(inv.email)+'</span>' : '');
        return '<tr>' +
          '<td class="cell-mono" style="font-size:12px;">'+_esc(inv.invoice_number)+'</td>' +
          '<td>'+tenantCell+'</td>' +
          '<td style="font-size:12px;">'+_esc(inv.plan||'—')+'</td>' +
          '<td class="cell-mono" style="font-size:12px;">'+_esc(amt)+'</td>' +
          '<td><span class="badge '+sc+'">'+_esc(inv.status)+'</span></td>' +
          '<td style="font-size:12px;color:var(--muted);">'+_esc(dt)+'</td>' +
          '<td style="text-align:center;">' +
            (canVoid ? '<button class="btn btn-danger btn-xs" onclick="voidInvoice(this.dataset.id)" data-id="'+_esc(String(inv.id))+'" title="Void invoice">' +
              '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' : '') +
          '</td></tr>';
      }).join('');
    }, 'pg-invoices');
    document.getElementById('inv-filter-count').textContent = '';
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--red);">Error: '+_esc(e.message)+'</td></tr>';
  }
}

async function createInvoice() {
  var tenant = (document.getElementById('inv-create-tenant').value || '').trim();
  var amount = parseInt(document.getElementById('inv-create-amount').value || '0', 10);
  var plan   = (document.getElementById('inv-create-plan').value || '').trim() || 'manual';
  var result = document.getElementById('inv-create-result');
  if (!tenant || !amount || amount < 1) {
    result.innerHTML = '<span style="color:var(--red);">Tenant and amount are required.</span>';
    return;
  }
  result.innerHTML = '<span style="color:var(--accent);">Creating…</span>';
  try {
    var res  = await _AF('/api/admin/invoices/create', {
      method: 'POST',
      body: JSON.stringify({tenant: tenant, amount_cents: amount, plan: plan})
    });
    var d = await res.json();
    if (!d.ok) throw new Error(d.error || 'Error');
    result.innerHTML = '<span style="color:var(--green);">Created ' + _esc(d.invoice_number||'') + '</span>';
    document.getElementById('inv-create-tenant').value = '';
    document.getElementById('inv-create-amount').value = '';
    loadInvoices();
  } catch(e) {
    result.innerHTML = '<span style="color:var(--red);">' + _esc(e.message) + '</span>';
  }
}

async function voidInvoice(id) {
  if (!confirm('Void this invoice? This cannot be undone.')) return;
  try {
    var res  = await _AF('/api/admin/invoices/' + encodeURIComponent(id) + '/void', {
      method: 'POST', body: JSON.stringify({})
    });
    var d = await res.json();
    if (!d.ok) throw new Error(d.error || 'Error');
    showToast('Invoice voided');
    loadInvoices();
  } catch(e) { showToast('Error: ' + e.message); }
}

/* ════════════════════════════════════════════
   COPY HELPER — "Copied!" feedback on button
════════════════════════════════════════════ */
function copyText(btn, text) {
  navigator.clipboard.writeText(text).then(function() {
    var orig = btn.textContent;
    btn.textContent = 'Copied!';
    btn.disabled = true;
    setTimeout(function() {
      btn.textContent = orig;
      btn.disabled = false;
    }, 1500);
  }).catch(function() {
    showToast('Copy failed');
  });
}

/* ════════════════════════════════════════════
   ORGANIZATIONS
════════════════════════════════════════════ */
var _allOrgs = [];

async function loadOrganizations() {
  var tbody = document.getElementById('orgs-tbody');
  var sub   = document.getElementById('orgs-sub');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--muted);">Loading…</td></tr>';
  try {
    var res = await _AF('/api/admin/organizations', { method: 'POST', body: JSON.stringify({}) });
    var d   = await res.json();
    if (!d.ok) throw new Error(d.error || 'Error');
    _allOrgs = d.organizations || [];
    if (sub) sub.textContent = _allOrgs.length + ' organization(s)';
    _pagInit('organizations', _allOrgs, _renderOrgsTable, 'pg-organizations');
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--red);">Error: ' + _esc(e.message) + '</td></tr>';
  }
}

function filterOrgs() {
  var q = (document.getElementById('orgs-search')?.value || '').toLowerCase();
  if (!q) { _pagFilter('organizations', _allOrgs); return; }
  _pagFilter('organizations', _allOrgs.filter(function(o) {
    return (o.name||'').toLowerCase().includes(q)
        || (o.root_domain||'').toLowerCase().includes(q)
        || (o.slug||'').toLowerCase().includes(q)
        || (o.owner_email||'').toLowerCase().includes(q);
  }));
}

function _renderOrgsTable(orgs) {
  var tbody = document.getElementById('orgs-tbody');
  if (!tbody) return;
  if (!orgs.length) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">🏢</div><div class="empty-state-text">No organizations found.</div></div></td></tr>';
    return;
  }
  tbody.innerHTML = orgs.map(function(o) {
    var created = (o.created_at||'').toString().slice(0,10);

    // Name cell: display name + unique slug as sub-line so duplicates are distinguishable
    var nameCell =
      '<div style="font-size:13px;font-weight:500;line-height:1.3;">' + _esc(o.name) + '</div>' +
      '<div style="font-family:\'DM Mono\',monospace;font-size:10px;color:var(--muted);margin-top:2px;">' + _esc(o.slug) + '</div>';

    // Root domain cell: show actual domain if set, otherwise indicate platform-only
    var domainCell = o.root_domain
      ? '<span style="font-family:\'DM Mono\',monospace;font-size:11px;color:var(--accent2);">' + _esc(o.root_domain) + '</span>'
      : '<span style="font-size:10px;color:var(--faint);">—</span>';

    // Verification status badge
    var statusCell;
    if (!o.root_domain) {
      statusCell = '<span style="font-size:10px;color:var(--muted);letter-spacing:0.5px;">PLATFORM</span>';
    } else if (o.is_verified) {
      statusCell = '<span style="font-size:10px;font-weight:600;color:var(--green);letter-spacing:0.5px;">&#10003; ACTIVE</span>';
    } else {
      statusCell = '<span style="font-size:10px;font-weight:600;color:var(--amber);letter-spacing:0.5px;">&#9675; PENDING</span>';
    }

    return '<tr>' +
      '<td>' + nameCell + '</td>' +
      '<td>' + domainCell + '</td>' +
      '<td style="text-align:center;">' + statusCell + '</td>' +
      '<td style="font-size:12px;color:var(--muted);">' + _esc(o.owner_email || '—') + '</td>' +
      '<td style="text-align:center;font-size:13px;">' + _esc(String(o.member_count || 0)) + '</td>' +
      '<td style="text-align:center;font-size:13px;">' +
        (o.instance_count > 0
          ? '<a href="#" style="color:var(--accent2);text-decoration:none;font-weight:600;" onclick="filterToOrgTenants(' + "'" + _esc(o.slug) + "'" + ');return false;">' + _esc(String(o.instance_count)) + '</a>'
          : '0') +
      '</td>' +
      '<td style="font-size:11px;color:var(--muted);">' + _esc(created) + '</td>' +
      '<td style="text-align:center;white-space:nowrap;">' +
        '<button class="btn btn-xs" onclick="openOrgDetail(\'' + _esc(o.id) + '\')" style="margin-right:4px;">Manage</button>' +
        '<button class="btn btn-xs btn-danger" onclick="adminDeleteOrg(\'' + _esc(o.id) + '\',\'' + _esc(o.slug) + '\')">Delete</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

async function openOrgDetail(orgId) {
  var modal = document.getElementById('org-detail-modal');
  if (!modal) return;
  document.getElementById('odm-body').innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted);">Loading…</div>';
  modal.classList.add('open');

  // Log admin access event for compliance audit trail (fire-and-forget)
  _AF('/api/admin/organizations/' + encodeURIComponent(orgId) + '/access-log', {
    method: 'POST', body: JSON.stringify({ reason: 'Admin panel org detail view' })
  }).catch(function() {});

  try {
    var res = await _AF('/api/admin/organizations/' + encodeURIComponent(orgId), {
      method: 'POST', body: JSON.stringify({})
    });
    var d = await res.json();
    if (!d.ok) throw new Error(d.error || 'Error');
    var org     = d.org     || {};
    var members = d.members || [];
    var tenants = d.tenants || [];
    var billing = d.billing || {};

    // Billing summary block
    var totalDollars = billing.total_revenue_cents ? '$' + (billing.total_revenue_cents / 100).toFixed(2) : '$0.00';
    var paidDollars  = billing.paid_cents          ? '$' + (billing.paid_cents          / 100).toFixed(2) : '$0.00';
    var billingSummary =
      '<div style="margin-bottom:20px;border:1px solid var(--border);background:var(--bg3);border-radius:var(--radius-sm);overflow:hidden;">' +
        '<div style="padding:8px 16px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--faint);border-bottom:1px solid var(--border);">Billing Summary</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;">' +
          '<div style="padding:12px 16px;border-right:1px solid var(--border);">' +
            '<div style="font-size:9px;color:var(--faint);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Total Revenue</div>' +
            '<div style="font-size:18px;font-weight:500;color:var(--green);">' + _esc(totalDollars) + '</div>' +
          '</div>' +
          '<div style="padding:12px 16px;border-right:1px solid var(--border);">' +
            '<div style="font-size:9px;color:var(--faint);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Paid</div>' +
            '<div style="font-size:18px;font-weight:500;color:var(--accent2);">' + _esc(paidDollars) + '</div>' +
          '</div>' +
          '<div style="padding:12px 16px;">' +
            '<div style="font-size:9px;color:var(--faint);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Invoices</div>' +
            '<div style="font-size:18px;font-weight:500;color:var(--text);">' + _esc(String(billing.invoice_count || 0)) + '</div>' +
          '</div>' +
        '</div>' +
        (billing.last_invoice_at ? '<div style="padding:6px 16px 10px;font-size:10px;color:var(--faint);">Last invoice: ' + _esc(String(billing.last_invoice_at).slice(0,10)) + '</div>' : '') +
      '</div>';

    var membersHtml = members.length ? (
      '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
        '<thead><tr>' +
          '<th style="text-align:left;padding:6px 10px;font-size:10px;color:var(--faint);font-weight:500;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid var(--border);">Email</th>' +
          '<th style="text-align:left;padding:6px 10px;font-size:10px;color:var(--faint);font-weight:500;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid var(--border);">Role</th>' +
          '<th style="padding:6px 10px;border-bottom:1px solid var(--border);"></th>' +
        '</tr></thead>' +
        '<tbody>' +
        members.map(function(m) {
          var uid   = m.user_id || '';
          var selId = 'role-sel-' + uid;
          var roleColor = m.role === 'owner' ? 'var(--accent2)' : m.role === 'admin' ? 'var(--accent3)' : 'var(--muted)';
          return '<tr>' +
            '<td style="padding:8px 10px;color:var(--text);font-family:\'DM Mono\',monospace;font-size:12px;">' +
              '<div style="font-weight:500;">' + _esc(m.email || uid) + '</div>' +
              '<div style="display:flex;align-items:center;gap:6px;margin-top:2px;">' +
                '<span style="font-size:9px;color:'+roleColor+';text-transform:uppercase;letter-spacing:0.5px;">Current: ' + _esc(m.role||'member') + '</span>' +
                (m.tenant_id ? '<span class="status-badge sb-scoped" title="Restricted to instance: ' + _esc(m.tenant_id) + '">SCOPED</span>' : '') +
              '</div>' +
            '</td>' +
            '<td style="padding:8px 10px;text-align:right;">' +
              '<select id="' + selId + '" style="font-size:11px;background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:var(--radius-xs);padding:4px 8px;margin-right:8px;vertical-align:middle;">' +
                ['owner','admin','member','viewer'].map(function(r) {
                  return '<option value="' + r + '"' + (r === m.role ? ' selected' : '') + '>' + r.toUpperCase() + '</option>';
                }).join('') +
              '</select>' +
              '<button class="btn btn-xs btn-accent" style="min-width:50px;" onclick="adminSetMemberRole(\'' + _esc(orgId) + '\',\'' + _esc(uid) + '\',\'' + selId + '\',this)">SET</button>' +
              '<button class="btn btn-xs btn-danger" style="margin-left:4px;" onclick="adminRemoveOrgMember(\'' + _esc(orgId) + '\',\'' + _esc(uid) + '\',\'' + _esc(m.email) + '\')">&times;</button>' +
            '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table>'
    ) : '<div style="color:var(--muted);font-size:13px;padding:8px 0;">No members.</div>';

    // Domain verification panel
    var domainPanel = '';
    if (org.root_domain) {
      var verifyStatus = org.is_verified
        ? '<span style="color:var(--green);font-weight:500;">&#10003; Verified — custom domain active</span>'
        : '<span style="color:var(--amber);font-weight:500;">&#9675; Pending verification</span>';
      var verifyActions = org.is_verified ? '' :
        '<div style="margin-top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
          '<button class="btn btn-xs btn-accent" id="adm-verify-btn-' + _esc(orgId) + '" onclick="adminVerifyOrgDomain(\'' + _esc(orgId) + '\',false)">Check DNS</button>' +
          '<button class="btn btn-xs" style="border-color:var(--green);color:var(--green);" onclick="adminVerifyOrgDomain(\'' + _esc(orgId) + '\',true)">Force Verify</button>' +
          '<span id="adm-verify-msg-' + _esc(orgId) + '" style="font-size:11px;font-family:\'DM Mono\',monospace;color:var(--muted);"></span>' +
        '</div>';
      var tokenRow = !org.is_verified && org.dns_token
        ? '<div class="data-pair" style="padding:10px 16px;">' +
            '<span class="dp-lbl">DNS TOKEN:</span>' +
            '<span class="dp-val" style="font-family:\'DM Mono\',monospace;font-size:10px;color:var(--accent2);word-break:break-all;">' + _esc(org.dns_token) + '</span>' +
          '</div>'
        : '';
      domainPanel =
        '<div style="margin-bottom:20px;border:1px solid var(--border);background:var(--bg3);border-radius:var(--radius-sm);overflow:hidden;">' +
          '<div style="padding:8px 16px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--faint);border-bottom:1px solid var(--border);">Domain Identity</div>' +
          '<div class="data-pair" style="padding:10px 16px;"><span class="dp-lbl">ROOT DOMAIN:</span><span class="dp-val" style="color:var(--accent2);font-family:\'DM Mono\',monospace;">' + _esc(org.root_domain) + '</span></div>' +
          '<div class="data-pair" style="padding:10px 16px;">' +
            '<span class="dp-lbl">STATUS:</span>' +
            '<span class="dp-val">' + verifyStatus + '</span>' +
          '</div>' +
          tokenRow +
          (verifyActions ? '<div style="padding:0 16px 14px;">' + verifyActions + '</div>' : '') +
        '</div>';
    }

    // Tenants table with domain/platform_domain columns
    var tenantsHtml = tenants.length ? (
      '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
        '<thead><tr>' +
          '<th style="text-align:left;padding:6px 10px;font-size:10px;color:var(--faint);font-weight:500;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid var(--border);">Instance</th>' +
          '<th style="text-align:left;padding:6px 10px;font-size:10px;color:var(--faint);font-weight:500;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid var(--border);">Active URL</th>' +
          '<th style="text-align:left;padding:6px 10px;font-size:10px;color:var(--faint);font-weight:500;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid var(--border);">Plan</th>' +
          '<th style="text-align:right;padding:6px 10px;font-size:10px;color:var(--faint);font-weight:500;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid var(--border);">Status</th>' +
          '<th style="padding:6px 10px;border-bottom:1px solid var(--border);"></th>' +
        '</tr></thead>' +
        '<tbody>' +
        tenants.map(function(t) {
          var sc = (t.status === 'running' || t.status === 'active') ? 'var(--accent2)' : t.status === 'suspended' ? 'var(--amber)' : 'var(--muted)';
          var pkg = (t.package||'starter').toUpperCase();
          var activeUrl = (t.is_custom_domain_active && t.domain) ? t.domain
                        : (t.platform_domain || t.domain || '—');
          var urlColor = t.is_custom_domain_active ? 'var(--accent2)' : 'var(--amber)';
          var ownerLabel = t.owner_email
            ? '<div style="font-size:10px;color:var(--muted);margin-top:2px;">Owner: ' + _esc(t.owner_email) + '</div>'
            : '';
          return '<tr>' +
            '<td style="padding:8px 10px;font-family:\'DM Mono\',monospace;font-size:12px;">' +
               '<a href="/admin.html#tenants?search=' + encodeURIComponent(t.tenant) + '" style="color:var(--text);border-bottom:1px solid var(--border);text-decoration:none;">' + _esc(t.tenant) + '</a>' +
               ownerLabel +
            '</td>' +
            '<td style="padding:8px 10px;font-family:\'DM Mono\',monospace;font-size:11px;color:' + urlColor + ';">' + _esc(activeUrl) + '</td>' +
            '<td style="padding:8px 10px;font-size:10px;color:var(--faint);letter-spacing:0.5px;">' + _esc(pkg) + '</td>' +
            '<td style="padding:8px 10px;text-align:right;"><span style="color:' + sc + ';font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:500;">' + _esc(t.status||'—') + '</span></td>' +
            '<td style="padding:8px 10px;text-align:right;white-space:nowrap;">' +
              '<button class="btn btn-xs btn-accent" style="margin-right:4px;" ' +
                'onclick="openAdminReassign(\'' + _esc(orgId) + '\',\'' + _esc(t.tenant) + '\',' + JSON.stringify(members) + ')">Transfer</button>' +
              '<button class="btn btn-xs btn-danger" onclick="adminUnlinkOrgInstance(\'' + _esc(orgId) + '\',\'' + _esc(t.tenant) + '\')">&times;</button>' +
            '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table>'
    ) : '<div style="color:var(--muted);font-size:13px;padding:8px 0;">No instances.</div>';

    document.getElementById('odm-title').textContent = org.name || 'Organization Details';
    document.getElementById('odm-body').innerHTML =
      billingSummary +
      '<div style="margin-bottom:20px;border:1px solid var(--border);background:var(--bg3);border-radius:var(--radius-sm);overflow:hidden;">' +
        '<div class="data-pair" style="padding:10px 16px;"><span class="dp-lbl">OWNER:</span><span class="dp-val">' + _esc(org.owner_email||'—') + '</span></div>' +
        '<div class="data-pair" style="padding:10px 16px;"><span class="dp-lbl">BILLING:</span><span class="dp-val">' + _esc(org.billing_email||'—') + '</span></div>' +
        '<div class="data-pair" style="padding:10px 16px;border-bottom:none;"><span class="dp-lbl">CREATED:</span><span class="dp-val" style="color:var(--muted);">' + _esc((org.created_at||'').toString().slice(0,10)) + '</span></div>' +
      '</div>' +
      domainPanel +

      // Member Management UI
      '<div style="margin-bottom:24px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
          '<div style="font-size:9px;color:var(--faint);letter-spacing:1px;text-transform:uppercase;">Members (' + members.length + ')</div>' +
          '<div style="display:flex;gap:4px;">' +
            '<input type="email" id="adm-org-add-email" autocomplete="off" placeholder="user@example.com" style="font-size:11px;background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:var(--radius-xs);padding:4px 8px;width:160px;outline:none;" role="presentation">' +
            '<button class="btn btn-xs btn-primary" onclick="adminAddOrgMember(\''+orgId+'\')">+ Add</button>' +
          '</div>' +
        '</div>' +
        '<div style="border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;">' + membersHtml + '</div>' +
      '</div>' +

      // Instance Management UI
      '<div style="margin-bottom:24px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
          '<div style="font-size:9px;color:var(--faint);letter-spacing:1px;text-transform:uppercase;">Instances (' + tenants.length + ')</div>' +
          '<div style="display:flex;gap:4px;">' +
            '<input type="text" id="adm-org-add-tenant" autocomplete="off" placeholder="tenant-name" style="font-size:11px;background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:var(--radius-xs);padding:4px 8px;width:120px;outline:none;">' +
            '<button class="btn btn-xs btn-primary" onclick="adminLinkOrgInstance(\''+orgId+'\')">+ Link</button>' +
          '</div>' +
        '</div>' +
        '<div style="border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;">' + tenantsHtml + '</div>' +
      '</div>' +

      '<div class="modal-btns" style="border-top:1px solid var(--border);padding-top:20px;margin-top:20px;">' +
        '<button class="btn btn-sm" onclick="openAdminTransferOwner(\'' + _esc(orgId) + '\',\'' + _esc(org.name||'') + '\')">TRANSFER OWNERSHIP</button>' +
        '<button class="btn btn-sm" style="border:1px solid var(--border2);color:var(--text);" onclick="closeOrgDetail()">CLOSE</button>' +
      '</div>';
  } catch(e) {
    document.getElementById('odm-body').innerHTML = '<div style="padding:24px;color:var(--red);">Error: ' + _esc(e.message) + '</div>';
  }
}

async function adminAddOrgMember(orgId) {
  const emailInput = document.getElementById('adm-org-add-email');
  if (!emailInput) return;
  const email = (emailInput.value || '').trim().toLowerCase();
  if (!email) return;
  try {
    const res = await _AF('/api/admin/organizations/' + encodeURIComponent(orgId) + '/members/add', {
      method: 'POST',
      body: JSON.stringify({ email: email, role: 'member' })
    });
    const d = await res.json();
    if (!d.ok) throw new Error(d.error || 'Failed to add member');
    showToast('Member added');
    openOrgDetail(orgId); // Refresh modal
  } catch(e) { showToast(e.message, 'error'); }
}
window.adminAddOrgMember = adminAddOrgMember;

async function adminRemoveOrgMember(orgId, userId, email) {
  if (!confirm('Remove member ' + (email||userId) + ' from this organization?')) return;
  try {
    const res = await _AF('/api/admin/organizations/' + encodeURIComponent(orgId) + '/members/' + encodeURIComponent(userId) + '/remove', {
      method: 'POST'
    });
    const d = await res.json();
    if (!d.ok) throw new Error(d.error || 'Failed to remove member');
    showToast('Member removed');
    openOrgDetail(orgId); // Refresh modal
  } catch(e) { showToast(e.message, 'error'); }
}
window.adminRemoveOrgMember = adminRemoveOrgMember;

async function adminLinkOrgInstance(orgId) {
  const tenantInput = document.getElementById('adm-org-add-tenant');
  if (!tenantInput) return;
  const tenant = (tenantInput.value || '').trim().toLowerCase();
  if (!tenant) return;
  try {
    const res = await _AF('/api/admin/organizations/' + encodeURIComponent(orgId) + '/tenants/add', {
      method: 'POST',
      body: JSON.stringify({ tenant: tenant })
    });
    const d = await res.json();
    if (!d.ok) throw new Error(d.error || 'Failed to link tenant');
    showToast('Tenant linked');
    openOrgDetail(orgId); // Refresh modal
  } catch(e) { showToast(e.message, 'error'); }
}
window.adminLinkOrgInstance = adminLinkOrgInstance;

async function adminUnlinkOrgInstance(orgId, tenant) {
  if (!confirm('Unlink tenant ' + tenant + ' from this organization? It will become ownerless.')) return;
  try {
    const res = await _AF('/api/admin/organizations/' + encodeURIComponent(orgId) + '/tenants/' + encodeURIComponent(tenant) + '/remove', {
      method: 'POST'
    });
    const d = await res.json();
    if (!d.ok) throw new Error(d.error || 'Failed to unlink tenant');
    showToast('Tenant unlinked');
    openOrgDetail(orgId); // Refresh modal
  } catch(e) { showToast(e.message, 'error'); }
}
window.adminUnlinkOrgInstance = adminUnlinkOrgInstance;


function closeOrgDetail() {
  document.getElementById('org-detail-modal')?.classList.remove('open');
}

function filterToOrgTenants(orgName) {
  // Switch to Tenants tab and pre-filter by org name
  document.querySelector('[data-section="tenants"]')?.click();
  const search = document.getElementById('tenant-search');
  if (search) {
    search.value = orgName;
    search.dispatchEvent(new Event('input'));
  }
}
window.filterToOrgTenants = filterToOrgTenants;

async function adminSetMemberRole(orgId, userId, selId, btn) {
  var role = document.getElementById(selId)?.value;
  if (!role) return;
  var orig = btn.textContent;
  btn.textContent = '...';
  btn.disabled = true;
  try {
    var res = await _AF('/api/admin/organizations/' + encodeURIComponent(orgId) + '/members/' + encodeURIComponent(userId) + '/role', {
      method: 'POST',
      body: JSON.stringify({ role: role }),
    });
    var d = await res.json();
    if (!d.ok) throw new Error(d.error || 'Error');
    btn.textContent = 'Done';
    btn.style.background = 'var(--green)';
    setTimeout(function() { btn.textContent = orig; btn.style.background = ''; btn.disabled = false; }, 2000);
  } catch(e) {
    btn.textContent = orig;
    btn.disabled = false;
    alert('Failed: ' + e.message);
  }
}
window.adminSetMemberRole = adminSetMemberRole;

async function adminVerifyOrgDomain(orgId, force) {
  var endpoint = force
    ? '/api/admin/organizations/' + encodeURIComponent(orgId) + '/force-verify'
    : '/api/admin/organizations/' + encodeURIComponent(orgId) + '/verify';
  var msgEl = document.getElementById('adm-verify-msg-' + orgId);
  var btn   = document.getElementById('adm-verify-btn-' + orgId);
  if (msgEl) { msgEl.textContent = force ? 'Forcing…' : 'Checking DNS…'; msgEl.style.color = 'var(--muted)'; }
  try {
    var res = await _AF(endpoint, { method: 'POST', body: JSON.stringify({}) });
    var d   = await res.json();
    if (d.ok && d.verified) {
      if (msgEl) { msgEl.textContent = '✓ ' + (d.message || 'Verified'); msgEl.style.color = 'var(--green)'; }
      // Reload org detail to reflect new status
      setTimeout(function() { openOrgDetail(orgId); }, 1000);
    } else {
      if (msgEl) { msgEl.textContent = d.error || 'Not found yet'; msgEl.style.color = 'var(--red)'; }
    }
  } catch(e) {
    if (msgEl) { msgEl.textContent = 'Request failed'; msgEl.style.color = 'var(--red)'; }
  }
}
window.adminVerifyOrgDomain = adminVerifyOrgDomain;

function openAdminTransferOwner(orgId, orgName) {
  closeOrgDetail();
  document.getElementById('ato-org-name').textContent = orgName;
  document.getElementById('ato-new-email').value = '';
  document.getElementById('ato-result').innerHTML = '';
  document.getElementById('ato-org-id').value = orgId;
  document.getElementById('admin-transfer-owner-modal').classList.add('open');
}

async function confirmAdminTransferOwner() {
  var orgId = document.getElementById('ato-org-id').value;
  var emailEl = document.getElementById('ato-new-email');
  var email   = (emailEl.value || '').trim().toLowerCase();
  var result  = document.getElementById('ato-result');
  if (!email) {
    result.innerHTML = '<span style="color:var(--red);">Email is required.</span>';
    emailEl.focus();
    return;
  }
  result.innerHTML = '<span style="color:var(--accent);">Transferring…</span>';
  try {
    var res = await _AF('/api/admin/organizations/' + encodeURIComponent(orgId) + '/transfer-owner', {
      method: 'POST', body: JSON.stringify({ email: email })
    });
    var d = await res.json();
    if (!d.ok) throw new Error(d.error || 'Error');
    result.innerHTML = '<span style="color:var(--green);">Ownership transferred to ' + _esc(email) + '</span>';
    setTimeout(function() {
      document.getElementById('admin-transfer-owner-modal').classList.remove('open');
      loadOrganizations();
    }, 1500);
  } catch(e) {
    result.innerHTML = '<span style="color:var(--red);">' + _esc(e.message) + '</span>';
  }
}

function closeAdminTransferOwner() {
  document.getElementById('admin-transfer-owner-modal')?.classList.remove('open');
}

function openAdminCreateOrg() {
  document.getElementById('aco-name').value = '';
  document.getElementById('aco-slug').value = '';
  document.getElementById('aco-owner-email').value = '';
  document.getElementById('aco-result').innerHTML = '';
  document.getElementById('admin-create-org-modal').classList.add('open');
  setTimeout(function() { document.getElementById('aco-name').focus(); }, 100);
}

async function confirmAdminCreateOrg() {
  var name  = (document.getElementById('aco-name').value || '').trim();
  var slug  = (document.getElementById('aco-slug').value || '').trim().toLowerCase();
  var email = (document.getElementById('aco-owner-email').value || '').trim().toLowerCase();
  var result = document.getElementById('aco-result');
  if (!name) { result.innerHTML = '<span style="color:var(--red);">Name is required.</span>'; return; }
  result.innerHTML = '<span style="color:var(--accent);">Creating…</span>';
  try {
    var body = { name: name };
    if (slug)  body.slug         = slug;
    if (email) body.owner_email  = email;
    var res = await _AF('/api/admin/organizations/create', {
      method: 'POST', body: JSON.stringify(body)
    });
    var d = await res.json();
    if (!d.ok) throw new Error(d.error || 'Error');
    result.innerHTML = '<span style="color:var(--green);">Created ' + _esc((d.org||{}).name||name) + '</span>';
    setTimeout(function() {
      document.getElementById('admin-create-org-modal').classList.remove('open');
      _sectionLoaded['organizations'] = false;
      loadOrganizations();
    }, 1200);
  } catch(e) {
    result.innerHTML = '<span style="color:var(--red);">' + _esc(e.message) + '</span>';
  }
}

function closeAdminCreateOrg() {
  document.getElementById('admin-create-org-modal')?.classList.remove('open');
}

function adminDeleteOrg(orgId, orgName) {
  document.getElementById('ado-org-id').value = orgId;
  document.getElementById('ado-slug-label').textContent = orgName;
  document.getElementById('ado-confirm-input').value = '';
  document.getElementById('ado-err').textContent = '';
  document.getElementById('admin-delete-org-modal').classList.add('open');
  setTimeout(function() { document.getElementById('ado-confirm-input').focus(); }, 50);
}

function closeAdminDeleteOrg() {
  document.getElementById('admin-delete-org-modal').classList.remove('open');
}

async function confirmAdminDeleteOrg() {
  var orgId = document.getElementById('ado-org-id').value;
  var expected = document.getElementById('ado-slug-label').textContent;
  var typed = document.getElementById('ado-confirm-input').value.trim();
  if (typed !== expected) {
    document.getElementById('ado-err').textContent = 'Slug does not match. Expected: ' + expected;
    return;
  }
  var btn = document.getElementById('ado-confirm-btn');
  btn.disabled = true;
  btn.textContent = 'Deleting…';
  try {
    var res = await _AF('/api/admin/organizations/' + encodeURIComponent(orgId) + '/delete', {
      method: 'POST', body: JSON.stringify({ confirm: expected })
    });
    var d = await res.json();
    if (!d.ok) throw new Error(d.error || 'Error');
    closeAdminDeleteOrg();
    showToast('Organization deleted');
    _sectionLoaded['organizations'] = false;
    loadOrganizations();
  } catch(e) {
    document.getElementById('ado-err').textContent = 'Error: ' + e.message;
    btn.disabled = false;
    btn.textContent = 'Delete Organization';
  }
}

/* ════════════════════════════════════════════
   ESC KEY — close any open modal / drawer
════════════════════════════════════════════ */
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('.modal-overlay.open, .drawer-overlay.open').forEach(function(el) {
    el.classList.remove('open');
  });
});

/* ════════════════════════════════════════════
   INIT
════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('delete-modal').addEventListener('click', function (e) {
    if (e.target === this) closeDeleteModal();
  });
  document.getElementById('admin-email').focus();
});

// GLOBALS FOR INLINE HTML
window._AF = _AF;
window._adminHeaders = _adminHeaders;
window._esc = _esc;
window._fmtMoney = _fmtMoney;
window._getSelectedTenants = _getSelectedTenants;
window._load360 = _load360;
window._renderSessions = _renderSessions;
window._renderStorageSync = _renderStorageSync;
window._renderTenantRow = _renderTenantRow;
window._setDelta = _setDelta;
window._tenantRegionLabel = _tenantRegionLabel;
window.adminDownloadBackup = adminDownloadBackup;
window.adminTriggerBackup = adminTriggerBackup;
window.bulkDelete = bulkDelete;
window.bulkEmail = bulkEmail;
window.bulkUpgrade = bulkUpgrade;
window.checkModalConfirm = checkModalConfirm;
window.clearBulkSelection = clearBulkSelection;
window.closeBroadcast = closeBroadcast;
window.closeConnectGit = closeConnectGit;
window.closeDeleteModal = closeDeleteModal;
window.closeDeleteUser = closeDeleteUser;
window.closeExtend = closeExtend;
window.closeLogDrawer = closeLogDrawer;
window.closeResetPass = closeResetPass;
window.closeTenant360 = closeTenant360;
window.colorLine = colorLine;
window.confirmBroadcast = confirmBroadcast;
window.confirmConnectGit = confirmConnectGit;
window.confirmDelete = confirmDelete;
window.confirmDeleteUser = confirmDeleteUser;
window.confirmExtend = confirmExtend;
window.confirmResetPass = confirmResetPass;
window.copyText = copyText;
window.createInvoice = createInvoice;
window.doUpgrade = doUpgrade;
window.downloadBackup = downloadBackup;
window.exportCSV = exportCSV;
window.fetchContainerLogs = fetchContainerLogs;
window.filterJobRows = filterJobRows;
window.filterNotifRows = filterNotifRows;
window.filterSessions = filterSessions;
window.filterSubscriptions = filterSubscriptions;
window.filterTenants = filterTenants;
window.filterUsers = filterUsers;
window.loadAuditLog = loadAuditLog;
window.loadBuildLog = loadBuildLog;
window.loadClusters = loadClusters;
window.loadInvoices = loadInvoices;
window.loadJobs = loadJobs;
window.loadNotifications = loadNotifications;
window.loadOverview = loadOverview;
window.loadRateLimits = loadRateLimits;
window.loadRevenue = loadRevenue;
window.loadSessions = loadSessions;
window.loadSubscriptions = loadSubscriptions;
window.loadSystemStatus = loadSystemStatus;
window.loadTenants = loadTenants;
window.loadUsers = loadUsers;
window.openBroadcast = openBroadcast;
window.openConnectGit = openConnectGit;
window.openDeleteModal = openDeleteModal;
window.openDeleteUser = openDeleteUser;
window.openGrantPerm = openGrantPerm;
window.closeGrantPerm = closeGrantPerm;
window.confirmGrantPerm = confirmGrantPerm;
window.openExtend = openExtend;
window.openLogDrawer = openLogDrawer;
window.openResetPass = openResetPass;
window.openTenant360 = openTenant360;
window.openTransferTenantOwner = openTransferTenantOwner;
window.closeTransferTenantOwner = closeTransferTenantOwner;
window.confirmTransferTenantOwner = confirmTransferTenantOwner;
window.previewEmail = previewEmail;
window.refreshLogDrawer = refreshLogDrawer;
window.renderGitCell = renderGitCell;
window.renderHeatmap = renderHeatmap;
window.resendNotification = resendNotification;
window.restoreBackup = restoreBackup;
window.retryJob = retryJob;
window.revokeSession = revokeSession;
window.showBuilds = showBuilds;
window.showSection = showSection;
window.showToast = showToast;
window.timeAgo = timeAgo;
window.toggleHeatmap = toggleHeatmap;
window.toggleSelectAll = toggleSelectAll;
window.toggleTheme = toggleTheme;
window.triggerStorageSync = triggerStorageSync;
window.unblockIp = unblockIp;
window.unlockAdmin = unlockAdmin;
window.updateBulkBar = updateBulkBar;
window.updateStatClusters = updateStatClusters;
window.updateStatInstances = updateStatInstances;
window.updateStatPendingEmails = updateStatPendingEmails;
window.updateStatUsers = updateStatUsers;
window.loadOrganizations = loadOrganizations;
window.filterOrgs = filterOrgs;
window.openOrgDetail = openOrgDetail;
window.closeOrgDetail = closeOrgDetail;
window.openAdminTransferOwner = openAdminTransferOwner;
window.confirmAdminTransferOwner = confirmAdminTransferOwner;
window.closeAdminTransferOwner = closeAdminTransferOwner;
window.openAdminCreateOrg = openAdminCreateOrg;
window.confirmAdminCreateOrg = confirmAdminCreateOrg;
window.closeAdminCreateOrg = closeAdminCreateOrg;
window.adminDeleteOrg = adminDeleteOrg;
window.closeAdminDeleteOrg = closeAdminDeleteOrg;
window.confirmAdminDeleteOrg = confirmAdminDeleteOrg;

function openAdminReassign(orgId, tenant, members) {
  document.getElementById('arm-org-id').value  = orgId;
  document.getElementById('arm-tenant').value   = tenant;
  document.getElementById('arm-tenant-label').textContent = tenant;
  document.getElementById('arm-err').textContent = '';
  var sel = document.getElementById('arm-user-select');
  sel.innerHTML = '<option value="">— select member —</option>';
  (members || []).forEach(function(m) {
    if (!m.user_id) return;
    var opt = document.createElement('option');
    opt.value = m.user_id;
    opt.textContent = (m.email || m.user_id) + ' (' + (m.role||'member') + ')';
    sel.appendChild(opt);
  });
  document.getElementById('arm-confirm-btn').disabled = false;
  document.getElementById('arm-confirm-btn').textContent = 'Transfer Ownership';
  document.getElementById('admin-reassign-modal').classList.add('open');
}
window.openAdminReassign = openAdminReassign;

function closeAdminReassign() {
  document.getElementById('admin-reassign-modal').classList.remove('open');
}
window.closeAdminReassign = closeAdminReassign;

async function confirmAdminReassign() {
  var orgId    = document.getElementById('arm-org-id').value;
  var tenant   = document.getElementById('arm-tenant').value;
  var toUserId = document.getElementById('arm-user-select').value;
  var errEl    = document.getElementById('arm-err');
  if (!toUserId) { errEl.textContent = 'Please select a member.'; return; }
  var btn = document.getElementById('arm-confirm-btn');
  btn.disabled = true; btn.textContent = 'Transferring…';
  try {
    var res = await _AF('/api/admin/organizations/' + encodeURIComponent(orgId) + '/instances/' + encodeURIComponent(tenant) + '/reassign', {
      method: 'POST', body: JSON.stringify({ to_user_id: toUserId })
    });
    var d = await res.json();
    if (!d.ok) throw new Error(d.error || 'Error');
    closeAdminReassign();
    showToast('Ownership transferred');
    openOrgDetail(orgId);
  } catch(e) {
    errEl.textContent = e.message;
    btn.disabled = false; btn.textContent = 'Transfer Ownership';
  }
}
window.confirmAdminReassign = confirmAdminReassign;
window.adminAddOrgMember = adminAddOrgMember;
window.adminRemoveOrgMember = adminRemoveOrgMember;
window.adminLinkOrgInstance = adminLinkOrgInstance;
window.adminUnlinkOrgInstance = adminUnlinkOrgInstance;
window.voidInvoice = voidInvoice;

// ── Admin session: no localStorage restore ──
// Admin tokens are server-side session tokens (DB-backed, 8-hour sliding TTL).
// Since we cannot safely restore a session without first verifying it server-side,
// and since the user agent no longer persists the raw token in localStorage,
// we do NOT attempt auto-restore. The unlock screen is always shown on page load.
// This is secure-by-default: an attacker with physical access to the machine
// cannot reuse a stale token from browser storage.
(function initAdmin() {
  // Clear any previously-stored admin tokens (migration cleanup).
  localStorage.removeItem('so-admin-token');
})();