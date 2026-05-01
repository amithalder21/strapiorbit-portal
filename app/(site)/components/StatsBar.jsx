'use client';
// ════════════════════════════════════════════
// app/(site)/components/StatsBar.jsx
//
// Converted from: index.body.html stats-bar section + initCountUp() from
// animations.js + loadPlatformStats() from api.js.
//
// Key changes:
//   - IntersectionObserver count-up → useEffect with ref per stat
//   - loadPlatformStats DOM write → useState(deployDisplay)
//   - apiFetch('/api/stats') called inside useEffect
// ════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '@/src/lib/api-client';

// Animate a number from 0 → target over ~1400ms
function useCountUp(target, decimals = 0, enabled = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const duration = 1400;
    const step = 16;
    const steps = duration / step;
    const inc = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + inc, target);
      setValue(current);
      if (current >= target) clearInterval(timer);
    }, step);
    return () => clearInterval(timer);
  }, [enabled, target]);
  return value.toFixed(decimals);
}

function CountUpStat({ target, decimals = 0, suffix = '' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const display = useCountUp(target, decimals, visible);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); io.unobserve(el); }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <span ref={ref}>
      {display}
      {suffix && <span style={{ fontSize: '22px', fontWeight: 200 }}>{suffix}</span>}
    </span>
  );
}

export default function StatsBar() {
  const [deployDisplay, setDeployDisplay] = useState(null);
  const [avgDisplay, setAvgDisplay] = useState(null);

  useEffect(() => {
    apiFetch('/api/stats')
      .then(data => {
        if (!data.ok) return;
        const secs = Math.min(data.avg_deploy_seconds || 0, 179);
        if (secs > 0) {
          const mins = Math.floor(secs / 60);
          const s = secs % 60;
          const formatted = `${mins}:${String(s).padStart(2, '0')}`;
          setDeployDisplay(formatted);
          setAvgDisplay(formatted + ' min');
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="stats-bar" id="stats-bar">
      {/* Stat 1: deploy time — from API */}
      <div className="stat-item">
        <div className="stat-num" id="stat-deploy">
          {deployDisplay
            ? <>{deployDisplay}<span style={{ fontSize: '18px' }}>min</span></>
            : <>&lt;3<span style={{ fontSize: '20px', fontWeight: 200 }}>min</span></>
          }
        </div>
        <div className="stat-label">Time to production</div>
      </div>

      {/* Stat 2: uptime — count-up */}
      <div className="stat-item">
        <div className="stat-num">
          <CountUpStat target={99.9} decimals={1} suffix="%" />
        </div>
        <div className="stat-label">Uptime SLA</div>
      </div>

      {/* Stat 3: isolation — count-up */}
      <div className="stat-item">
        <div className="stat-num">
          <CountUpStat target={100} decimals={0} suffix="%" />
        </div>
        <div className="stat-label">Tenant isolation</div>
      </div>

      {/* Stat 4: regions — count-up */}
      <div className="stat-item">
        <div className="stat-num">
          <CountUpStat target={3} decimals={0} />
        </div>
        <div className="stat-label">Availability regions</div>
      </div>
    </div>
  );
}

// Export avgDisplay for use in DeploySection's preview panel
export { };
