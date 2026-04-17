// ════════════════════════════════════════════
// app/lib/htmlFragment.js
//
// Server-side helper: reads pre-extracted body-content HTML fragments
// from /content and returns them for injection via dangerouslySetInnerHTML.
//
// The fragments were extracted once-off from the original Vite HTML files
// so page markup, inline styles, and scripts are preserved byte-for-byte.
//
// ── XSS SAFETY INVARIANT ────────────────────────────────────────────────
// The `name` argument MUST always be a hard-coded string literal at the
// call site (e.g. readFragment('privacy.body.html')) — never user input,
// never a request param, never a dynamic value. Every caller in this repo
// satisfies this: grep `readFragment(` to verify.
//
// Under that invariant:
//   • The returned HTML comes from files shipped in the repo at build time.
//   • No user input or runtime data is ever concatenated into these files.
//   • Injecting them via dangerouslySetInnerHTML is equivalent to shipping
//     a static HTML page — no XSS surface.
//
// If this ever needs to take a dynamic name, add an allow-list check here
// and resolve against CONTENT_DIR with path.resolve + startsWith(CONTENT_DIR)
// to block path-traversal.
// ════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// process.cwd() during `next build`/`next dev` is the project root (portal-next)
const CONTENT_DIR = join(process.cwd(), 'content');

export function readFragment(name) {
  return readFileSync(join(CONTENT_DIR, name), 'utf8');
}
