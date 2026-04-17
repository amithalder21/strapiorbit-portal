// ════════════════════════════════════════════
// api.js — Public data loaders
// ════════════════════════════════════════════
import { apiFetch, authFetch } from '../lib/api-client.js';

export const ALL_REGIONS = [
  { id: 'us-prod', label: 'US', subLabel: 'United States' },
  { id: 'eu-prod', label: 'EU', subLabel: 'Europe' },
  { id: 'ap-prod', label: 'ASIA', subLabel: 'Asia Pacific' },
];

export async function loadLiveInstances() {
  const list = document.getElementById('live-tenant-list');
  const count = document.getElementById('live-instance-count');
  if (!list) return;

  try {
    const data = await apiFetch('/api/tenants/public');

    if (!data.ok || !data.tenants.length) {
      list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-size:13px;font-family:\'DM Mono\',monospace;">no instances yet</div>';
      if (count) count.textContent = '0 active';
      return;
    }

    if (count) count.textContent = (data.total || data.tenants.length) + ' active';
    const recent = data.tenants;

    function mask(str) {
      if (!str || str.length <= 2) return str;
      const chars = str.split('');
      const seed = str.charCodeAt(0) * 31 + str.length;
      return chars.map((c, i) => {
        if (i === 0 || i === chars.length - 1) return c;
        return ((seed * (i + 7)) % 10) < 4 ? c : '*';
      }).join('');
    }

    function maskDomain(domain) {
      if (!domain) return '***';
      return domain.split('.').map(mask).join('.');
    }

    function regionLabel(clusterId) {
      const r = ALL_REGIONS.find(r => r.id === (clusterId || 'us-prod'));
      return r ? r.label : 'US';
    }

    function escHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    list.innerHTML = recent.map(t => {
      const pkg = (t.package || 'STARTER').toUpperCase();
      const badgeCls = pkg === 'STARTER' ? 'b-s' : pkg === 'PRO' ? 'b-p' : 'b-e';
      const dotColor = t.healthy ? 'var(--green)' : 'var(--amber)';
      return `<div class="tenant-item">
        <div>
          <div class="tenant-nm">${escHtml(mask(t.tenant))}</div>
          <div class="tenant-dm">${escHtml(maskDomain(t.domain || t.tenant + '.justbots.tech'))}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="badge ${badgeCls}">${escHtml(pkg)}</span>
          <span class="badge b-r">${escHtml(regionLabel(t.cluster_id))}</span>
          <div class="tenant-status">
            <div class="sdot" style="background:${dotColor};"></div>
            <span style="color:${dotColor};">active</span>
          </div>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-size:13px;font-family:\'DM Mono\',monospace;">unavailable</div>';
    if (count) count.textContent = '—';
  }
}

export async function loadClusters() {
  const wrap = document.getElementById('region-selector');
  if (!wrap) return;

  let liveIds = [];
  let selectedCluster = '';

  try {
    const data = await apiFetch('/api/clusters');
    if (data.ok && data.clusters.length) {
      liveIds = data.clusters.map(c => c.id);
      selectedCluster = data.clusters[0].id;
    }
  } catch (e) {
    liveIds = ['us-prod'];
    selectedCluster = 'us-prod';
  }

  window._selectedCluster = selectedCluster;

  wrap.innerHTML = ALL_REGIONS.map(r => {
    const active = liveIds.includes(r.id);
    if (active) {
      return `<div class="plan-opt${selectedCluster === r.id ? ' selected' : ''}"
               id="cluster-${r.id}"
               data-cluster="${r.id}">
               <span class="plan-opt-name">${r.label}</span>
               <span class="plan-opt-price">${r.subLabel}</span>
             </div>`;
    } else {
      return `<div class="plan-opt disabled">
               <span class="plan-opt-name">${r.label}</span>
               <span class="plan-opt-price">${r.subLabel}</span>
             </div>`;
    }
  }).join('');

  wrap.querySelectorAll('.plan-opt:not(.disabled)').forEach(el => {
    el.addEventListener('click', () => {
      wrap.querySelectorAll('.plan-opt').forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');
      window._selectedCluster = el.dataset.cluster;
    });
  });
}

export async function loadPlatformStats() {
  try {
    const data = await apiFetch('/api/stats');
    if (!data.ok) return;

    const secs = Math.min(data.avg_deploy_seconds || 0, 179);
    const deployEl = document.getElementById('stat-deploy');
    if (deployEl && secs > 0) {
      const mins = Math.floor(secs / 60);
      const s = secs % 60;
      deployEl.innerHTML = mins + ':' + String(s).padStart(2, '0') + '<span style="font-size:18px">min</span>';
    }

    const avgDisp = document.getElementById('avg-deploy-display');
    if (avgDisp && secs > 0) {
      const m2 = Math.floor(secs / 60);
      const s2 = secs % 60;
      avgDisp.textContent = m2 + ':' + String(s2).padStart(2, '0') + ' min';
    }
  } catch (e) { /* non-fatal */ }
}
