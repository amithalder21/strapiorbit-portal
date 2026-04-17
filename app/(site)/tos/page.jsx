// ════════════════════════════════════════════
// app/(site)/tos/page.jsx — /tos
// ════════════════════════════════════════════
import Script from 'next/script';
import { readFragment } from '../../lib/htmlFragment';

export const metadata = {
  title: 'Terms of Service — Strapi Orbit',
};

export default function TosPage() {
  const html = readFragment('tos.body.html');
  return (
    <>
      <div
        id="__page-root"
        style={{ display: 'contents' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <Script id="lucide-init" strategy="afterInteractive">
        {`if (window.lucide) lucide.createIcons();`}
      </Script>
    </>
  );
}
