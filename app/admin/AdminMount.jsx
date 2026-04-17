'use client';
// ════════════════════════════════════════════
// AdminMount — mounts src/admin.js. admin.js has TWO
// document.addEventListener('DOMContentLoaded', ...) calls at lines 49 + 2911,
// plus an IIFE that runs on module eval. Dispatching a DOMContentLoaded event
// after import ensures both listeners fire, preserving original behaviour.
// ════════════════════════════════════════════
import { useEffect } from 'react';

export default function AdminMount() {
  useEffect(() => {
    let mounted = true;
    import('../../src/admin.js').then(() => {
      if (!mounted) return;
      if (document.readyState !== 'loading') {
        document.dispatchEvent(new Event('DOMContentLoaded'));
      }
    });
    return () => { mounted = false; };
  }, []);
  return null;
}
