// ════════════════════════════════════════════
// app/admin/page.jsx — /admin
//
// Admin is self-contained: the original admin.html defines its own
// inline <style> and inline hostname-redirect <script> in <head>.
// We reproduce both here so styling and the redirect behaviour are
// preserved identically.
//
// IMPORTANT: this route is intentionally OUTSIDE the (site) route group
// so it does NOT inherit app/(site)/layout.jsx's style.css import.
// ════════════════════════════════════════════
import Script from 'next/script';
import { readFragment } from '../lib/htmlFragment';
import AdminMount from './AdminMount';

export const metadata = {
  title: 'Enterprise Strapi Console',
};

export default function AdminPage() {
  const html = readFragment('admin.body.html');
  const inlineStyle = readFragment('admin.inline-style.css');
  const redirectScript = readFragment('admin.inline-head-script.js');

  return (
    <>
      {/* Hostname gate — matches the original inline head script exactly.
          strategy="beforeInteractive" ensures it runs before anything else. */}
      <Script
        id="admin-hostname-gate"
        strategy="beforeInteractive"
      >{redirectScript}</Script>

      {/* Fonts — admin uses Inter + DM Mono (note: no Geist, same as original) */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap"
      />

      {/* Lucide icons (needed by admin.js).
          Pinned to a specific version to eliminate the supply-chain risk of
          @latest silently fetching a new release. Bump deliberately when needed.
          Same version as app/(site)/layout.jsx — keep in sync.
          To add SRI, run:
            curl -s https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js \
              | openssl dgst -sha384 -binary | openssl base64 -A
          then set integrity="sha384-..." below. */}
      <Script
        src="https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js"
        strategy="beforeInteractive"
        crossOrigin="anonymous"
      />

      {/* Admin-specific inline <style> extracted from the original admin.html */}
      <style dangerouslySetInnerHTML={{ __html: inlineStyle }} />

      {/* Admin body markup — byte-for-byte from the original admin.html */}
      <div
        id="__page-root"
        style={{ display: 'contents' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <AdminMount />

      {/* Mirrors the trailing inline <script> in admin.html that renders
          Lucide icons on DOMContentLoaded. */}
      <Script id="admin-lucide-init" strategy="afterInteractive">
        {`window.addEventListener('DOMContentLoaded', () => { if (window.lucide) lucide.createIcons(); });`}
      </Script>
    </>
  );
}
