'use client';
// ════════════════════════════════════════════
// app/(site)/components/LiveInstancesPanel.jsx
//
// Converted from: index.body.html #live-instances panel
// + loadLiveInstances() from api.js (DOM-writing version)
//
// Key changes:
//   - list.innerHTML template literals → JSX map
//   - setInterval 30s poll → useEffect with cleanup
// ════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { fetchLiveInstances } from '@/src/modules/api-react';

export default function LiveInstancesPanel() {
  const [tenants, setTenants] = useState(null); // null = loading

  async function load() {
    const result = await fetchLiveInstances();
    setTenants(result.ok ? result.tenants : []);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="live-instances">
      <div className="li-header">
        <div className="li-title">Live Instances</div>
        <div className="li-count" id="live-instance-count">
          {tenants === null ? '…' : `${tenants.length} active`}
        </div>
      </div>
      <div className="li-list" id="live-tenant-list">
        {tenants === null && (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)', fontSize: '13px', fontFamily: "'DM Mono',monospace" }}>
            loading...
          </div>
        )}
        {tenants !== null && tenants.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)', fontSize: '13px', fontFamily: "'DM Mono',monospace" }}>
            no instances yet
          </div>
        )}
        {tenants?.map((t, i) => {
          const pkg = (t.package || 'STARTER').toUpperCase();
          const badgeCls = pkg === 'STARTER' ? 'b-s' : pkg === 'PRO' ? 'b-p' : 'b-e';
          const dotColor = t.healthy ? 'var(--green)' : 'var(--amber)';
          return (
            <div className="tenant-item" key={i}>
              <div>
                <div className="tenant-nm">{t.maskedTenant}</div>
                <div className="tenant-dm">{t.maskedDomain}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className={`badge ${badgeCls}`}>{pkg}</span>
                <span className="badge b-r">{t.regionLabel}</span>
                <div className="tenant-status">
                  <div className="sdot" style={{ background: dotColor }} />
                  <span style={{ color: dotColor }}>active</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
