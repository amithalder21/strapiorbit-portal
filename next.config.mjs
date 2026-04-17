/** @type {import('next').NextConfig} */
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// When BUILD_STATIC=1 is set, produce a fully static site in /out (no Node server).
// In that mode, server-only features (rewrites, image optimization) must be disabled.
const STATIC_EXPORT = process.env.BUILD_STATIC === '1';

const nextConfig = {
  reactStrictMode: false, // Matches Vite behavior; vanilla JS modules run once on mount
  // Silence the "multiple lockfiles" warning by pinning the tracing root to this project.
  outputFileTracingRoot: __dirname,

  // ── Static export mode (opt-in via BUILD_STATIC=1) ──────────────────────
  ...(STATIC_EXPORT
    ? {
        output: 'export',
        // With trailingSlash:false, App Router static export emits
        // out/dashboard.html (flat) rather than out/dashboard/index.html,
        // preserving the original Vite URL structure.
        trailingSlash: false,
        // Next's image optimizer needs a Node server; disable for static.
        images: { unoptimized: true },
      }
    : {
        // ── Server-mode only: rewrites (not supported with output:'export')
        async rewrites() {
          return [
            // Back-compat for old /*.html URLs
            { source: '/index.html',     destination: '/' },
            { source: '/dashboard.html', destination: '/dashboard' },
            { source: '/admin.html',     destination: '/admin' },
            { source: '/privacy.html',   destination: '/privacy' },
            { source: '/tos.html',       destination: '/tos' },

            // Dev-only API proxy (mirrors the old vite.config.js proxy)
            ...(process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_API_URL
              ? [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }]
              : []),
          ];
        },

        // ── Server-mode only: security response headers.
        //    (Static export can't emit these — configure them in nginx/CDN.)
        async headers() {
          const securityHeaders = [
            // Block clickjacking. Use SAMEORIGIN if any page needs to be framed
            // by another page on this origin; DENY is the stricter default.
            { key: 'X-Frame-Options', value: 'DENY' },
            // Prevent MIME-sniffing.
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            // Don't leak full URL (which may contain tenant IDs) on outbound
            // navigations. Send only the origin on cross-origin requests.
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            // Force HTTPS for 2 years incl. subdomains. Only sent over HTTPS;
            // browsers ignore it on http:// so local dev is unaffected.
            { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
            // Disable powerful APIs the portal doesn't use.
            { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self), interest-cohort=()' },
            // Isolate cross-origin popups/windows (protects against XS-Leaks).
            { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
            // Default to "no cross-origin requests may embed this resource."
            // Loosen to 'cross-origin' per-asset if a CDN needs it.
            { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          ];
          return [{ source: '/:path*', headers: securityHeaders }];
        },
      }),
};

export default nextConfig;
