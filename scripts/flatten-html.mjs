// ════════════════════════════════════════════
// scripts/flatten-html.mjs
//
// Runs after `next build` (static export). Copies each out/<route>/index.html
// to out/<route>.html so the old /*.html URLs from the Vite era keep working
// without any web-server rewrites.
//
// After this runs, BOTH of these serve the same content from any static host:
//   /dashboard        (Next.js preferred)
//   /dashboard.html   (back-compat with old links)
// ════════════════════════════════════════════
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'out');
const routes = ['dashboard', 'admin', 'privacy', 'tos'];

if (!existsSync(OUT)) {
  console.error('[flatten-html] out/ does not exist — did `next build` run?');
  process.exit(1);
}

for (const route of routes) {
  const src = join(OUT, route, 'index.html');
  const dst = join(OUT, `${route}.html`);
  if (existsSync(src)) {
    copyFileSync(src, dst);
    console.log(`[flatten-html] out/${route}/index.html → out/${route}.html`);
  } else {
    console.warn(`[flatten-html] skipped ${route}: ${src} not found`);
  }
}
