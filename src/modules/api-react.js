// ════════════════════════════════════════════
// src/modules/api-react.js
//
// Data-only version of api.js for use in React components.
// Unlike api.js, these functions return data instead of writing to the DOM.
// The legacy api.js is kept unchanged for backward compatibility
// until the full migration is complete.
// ════════════════════════════════════════════
import { apiFetch } from '../lib/api-client.js';

export const ALL_REGIONS = [
  { id: 'us-prod', label: 'US',   subLabel: 'United States' },
  { id: 'eu-prod', label: 'EU',   subLabel: 'Europe'        },
  { id: 'ap-prod', label: 'ASIA', subLabel: 'Asia Pacific'  },
];

function maskStr(str) {
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
  return domain.split('.').map(maskStr).join('.');
}

function regionLabel(clusterId) {
  const r = ALL_REGIONS.find(r => r.id === (clusterId || 'us-prod'));
  return r ? r.label : 'US';
}

/**
 * Returns { ok, tenants: [{tenant, domain, package, cluster_id, healthy}], total }
 * or { ok: false } on failure.
 */
export async function fetchLiveInstances() {
  try {
    const data = await apiFetch('/api/tenants/public');
    if (!data.ok || !data.tenants?.length) return { ok: false, tenants: [] };
    return {
      ok: true,
      total: data.total || data.tenants.length,
      tenants: data.tenants.map(t => ({
        ...t,
        maskedTenant: maskStr(t.tenant),
        maskedDomain: maskDomain(t.domain || t.tenant + '.justbots.tech'),
        regionLabel:  regionLabel(t.cluster_id),
      })),
    };
  } catch {
    return { ok: false, tenants: [] };
  }
}

/**
 * Returns { ok, clusters: [{id, label, subLabel}] }
 */
export async function fetchClusters() {
  try {
    const data = await apiFetch('/api/clusters');
    if (data.ok && data.clusters?.length) {
      return { ok: true, clusters: data.clusters };
    }
    return { ok: false, clusters: [{ id: 'us-prod', label: 'US', subLabel: 'United States' }] };
  } catch {
    return { ok: false, clusters: [{ id: 'us-prod', label: 'US', subLabel: 'United States' }] };
  }
}

/**
 * Returns { ok, avg_deploy_seconds, formatted }
 */
export async function fetchPlatformStats() {
  try {
    const data = await apiFetch('/api/stats');
    if (!data.ok) return { ok: false };
    const secs = Math.min(data.avg_deploy_seconds || 0, 179);
    const mins = Math.floor(secs / 60);
    const s    = secs % 60;
    return {
      ok: true,
      avg_deploy_seconds: secs,
      formatted: secs > 0 ? `${mins}:${String(s).padStart(2, '0')} min` : null,
    };
  } catch {
    return { ok: false };
  }
}
