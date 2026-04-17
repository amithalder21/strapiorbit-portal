// ════════════════════════════════════════════
// src/lib/api-client.js  (secure v2)
//
// Security model:
//   - Access token lives in JS module memory ONLY (never localStorage/sessionStorage)
//   - Refresh token is HttpOnly cookie — never readable by JS
//   - On 401: silently call /api/auth/refresh to rotate refresh cookie
//             and get a new access_token, then replay the failed request
//   - On refresh failure: fire 'auth:logout' event so the page can redirect
//
// In production, NEXT_PUBLIC_API_URL = "https://api.strapiorbit.cloud"
// In dev,        NEXT_PUBLIC_API_URL = ""  → proxied by next.config.mjs → localhost:5000
// ════════════════════════════════════════════

// Env var is injected by Next.js at build time. Must be prefixed NEXT_PUBLIC_ to be
// available in the browser bundle.
const BASE = ((typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_URL) || '').replace(/\/$/, '');

// ── In-memory access token store ─────────────────────────────────────────────
let _accessToken = '';
let _isRefreshing = false;
let _refreshQueue = [];  // Pending requests while refresh is in progress

export function setAccessToken(token) {
  _accessToken = token || '';
}

export function getAccessToken() {
  return _accessToken;
}

export function clearAccessToken() {
  _accessToken = '';
}

// ── Token refresh ─────────────────────────────────────────────────────────────
/**
 * Call POST /api/auth/refresh using the HttpOnly cookie.
 * On success: updates in-memory access token, returns true.
 * On failure: fires 'auth:logout' event, returns false.
 */
export async function refreshAccessToken() {
  try {
    const res = await fetch(BASE + '/api/auth/refresh', {
      method:      'POST',
      credentials: 'include',    // Send the HttpOnly cookie
      headers:     { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (data.ok && data.access_token) {
      setAccessToken(data.access_token);
      // Notify app of refreshed user info
      document.dispatchEvent(new CustomEvent('auth:refreshed', { detail: data }));
      return true;
    }
  } catch (e) {
    // Network failure — don't log out on transient errors
    console.warn('[api-client] refresh network error:', e.message);
    return false;
  }
  // Refresh really failed (401/403) — clear token + notify
  clearAccessToken();
  document.dispatchEvent(new CustomEvent('auth:logout'));
  return false;
}

/**
 * Attempt to restore session on page load by calling /api/auth/refresh.
 * Returns the user data object if successful, null otherwise.
 */
export async function tryRestoreSession() {
  try {
    const res = await fetch(BASE + '/api/auth/refresh', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (data.ok && data.access_token) {
      setAccessToken(data.access_token);
      return data;
    }
  } catch (_) { /* ignore — user is just logged out */ }
  return null;
}


// ── Core fetch helpers ────────────────────────────────────────────────────────

/**
 * Public (unauthenticated) fetch — only adds base URL + JSON headers.
 */
export async function apiFetch(path, opts = {}) {
  const url = BASE + path;
  const res = await fetch(url, {
    ...opts,
    credentials: 'include',   // Always include cookies (for future public cookie auth)
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (opts._returnRaw) return res;
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { throw new Error(`Non-JSON response from ${path}: ${text.slice(0, 200)}`); }
}

/**
 * Authenticated fetch — adds Bearer token from memory.
 * On 401: silently refreshes the access token and retries once.
 * On 403: dispatches 'api:forbidden' CustomEvent.
 */
export async function authFetch(path, opts = {}, _isRetry = false) {
  const token = _accessToken;

  const res = await fetch(BASE + path, {
    ...opts,
    credentials: 'include',  // Always include cookies
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  // Silent 401 → refresh → retry once
  if (res.status === 401 && !_isRetry) {
    if (_isRefreshing) {
      // Another request is already refreshing — queue this one
      return new Promise((resolve, reject) => {
        _refreshQueue.push({ resolve, reject, path, opts });
      });
    }
    _isRefreshing = true;
    const ok = await refreshAccessToken();
    _isRefreshing = false;

    // Drain queue
    for (const queued of _refreshQueue) {
      authFetch(queued.path, queued.opts, true)
        .then(queued.resolve)
        .catch(queued.reject);
    }
    _refreshQueue = [];

    if (ok) {
      return authFetch(path, opts, true);  // Retry with new token
    }
    // Refresh failed — return the original 401 response
    return res;
  }

  if (res.status === 403) {
    document.dispatchEvent(new CustomEvent('api:forbidden', { detail: { path } }));
  }

  if (opts._returnRaw) return res;

  const text = await res.text();
  try { return JSON.parse(text); }
  catch { throw new Error(`Non-JSON response from ${path}: ${text.slice(0, 200)}`); }
}

export { BASE as API_BASE };
