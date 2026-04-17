'use client';
// ════════════════════════════════════════════
// MainMount — mounts the original src/main.js once the landing markup
// has been rendered to the DOM. main.js registers a DOMContentLoaded
// listener at module top-level; by the time React effects run, that
// event has already fired, so we dispatch it manually.
// ════════════════════════════════════════════
import { useEffect } from 'react';

export default function MainMount() {
  useEffect(() => {
    let mounted = true;
    import('../../src/main.js').then(() => {
      if (!mounted) return;
      // The module registered a DOMContentLoaded handler. Fire it now
      // since the browser's own event already passed.
      if (document.readyState !== 'loading') {
        document.dispatchEvent(new Event('DOMContentLoaded'));
      }
    });
    return () => { mounted = false; };
  }, []);
  return null;
}
