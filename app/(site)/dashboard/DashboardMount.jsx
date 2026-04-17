'use client';
// ════════════════════════════════════════════
// DashboardMount — mounts src/dashboard.js after the markup is in the DOM.
// ════════════════════════════════════════════
import { useEffect } from 'react';

export default function DashboardMount() {
  useEffect(() => {
    let mounted = true;
    import('../../../src/dashboard.js').then(() => {
      if (!mounted) return;
      if (document.readyState !== 'loading') {
        document.dispatchEvent(new Event('DOMContentLoaded'));
      }
    });
    return () => { mounted = false; };
  }, []);
  return null;
}
