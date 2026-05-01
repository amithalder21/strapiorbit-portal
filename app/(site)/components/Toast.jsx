'use client';
// ════════════════════════════════════════════
// app/(site)/components/Toast.jsx
//
// Global toast notification component.
// Replaces: showToast() from utils.js which wrote to #toast directly.
//
// Usage: expose via a React context or a simple imperative ref export.
// The <Toast> element is rendered in the page layout; callers import
// `showToast` from this module and call it imperatively.
// ════════════════════════════════════════════
import { useState, useCallback, useRef } from 'react';

// ── Module-level singleton so any component can call showToast() ─────────────
let _show = null;

export function showToast(msg, duration = 2500) {
  _show?.(msg, duration);
}

export default function Toast() {
  const [state, setState] = useState({ msg: '', visible: false });
  const timerRef = useRef(null);

  // Register the singleton callback once on mount
  const mountRef = useCallback(node => {
    if (!node) { _show = null; return; }
    _show = (msg, duration) => {
      clearTimeout(timerRef.current);
      setState({ msg, visible: true });
      timerRef.current = setTimeout(() => setState(s => ({ ...s, visible: false })), duration);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={`toast${state.visible ? ' show' : ''}`}
      id="toast"
    >
      {state.msg}
    </div>
  );
}
