// ════════════════════════════════════════════
// app/(site)/layout.jsx
//
// Applies to the public site routes: /, /dashboard, /privacy, /tos.
// (Admin is in app/admin/, outside this group, so it won't inherit
// the global style.css — admin uses its own inline <style> from
// the original admin.html instead.)
// ════════════════════════════════════════════
import Script from 'next/script';

// Global stylesheet — the exact style.css from the original Vite project,
// copied byte-for-byte to src/style.css.
import '../../src/style.css';

export default function SiteLayout({ children }) {
  return (
    <>
      {/* Google Fonts — same preconnect+preload pattern as the original HTML */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Inter:wght@300;400;500&family=Source+Code+Pro:wght@400;500;600;700&family=DM+Mono:wght@400;500;600&display=swap"
      />

      {/* Lucide icons (loaded on every site page — matches original).
          Pinned to a specific version to eliminate the supply-chain risk of
          @latest silently fetching a new release. Bump deliberately when needed.
          To add SRI, run:
            curl -s https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js \
              | openssl dgst -sha384 -binary | openssl base64 -A
          then set integrity="sha384-..." crossOrigin="anonymous" below. */}
      <Script
        src="https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js"
        strategy="beforeInteractive"
        crossOrigin="anonymous"
      />

      {/* Stripe.js is loaded only by landing + dashboard pages individually
          (matches the original HTML where /privacy and /tos did not include it). */}

      {children}
    </>
  );
}
