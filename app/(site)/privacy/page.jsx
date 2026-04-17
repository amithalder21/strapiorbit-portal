// ════════════════════════════════════════════
// app/(site)/privacy/page.jsx — /privacy
// ════════════════════════════════════════════
import Script from 'next/script';
import { readFragment } from '../../lib/htmlFragment';

export const metadata = {
  title: 'Privacy Policy — Strapi Orbit',
};

export default function PrivacyPage() {
  const html = readFragment('privacy.body.html');
  return (
    <>
      <div
        id="__page-root"
        style={{ display: 'contents' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {/* Mirrors the inline <script>lucide.createIcons()</script> in the original */}
      <Script id="lucide-init" strategy="afterInteractive">
        {`if (window.lucide) lucide.createIcons();`}
      </Script>
    </>
  );
}
