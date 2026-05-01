// ════════════════════════════════════════════
// app/(site)/tos/page.jsx — /tos
//
// Converted from: content/tos.body.html
// Pattern: Native RSC JSX — no dangerouslySetInnerHTML, no vanilla JS,
//          no readFragment(), no lucide.createIcons() script.
// ════════════════════════════════════════════
import SiteNav from '../components/SiteNav';
import SiteFooter from '../components/SiteFooter';

export const metadata = {
  title: 'Terms of Service — Strapi Orbit',
  description:
    'Read the Strapi Orbit Terms of Service. Understand your rights and obligations when using our managed Strapi hosting platform.',
};

export default function TosPage() {
  return (
    <>
      <SiteNav />

      <div className="legal-wrap">
        <a href="/" className="legal-back">← Back to home</a>
        <h1 className="legal-title">Terms of Service</h1>
        <div className="legal-date">Last updated: April 3, 2026</div>

        <div className="legal-content">
          <h2>1. Service Overview</h2>
          <p>
            Strapi Orbit provides managed instance hosting for Strapi. By using our service, you
            agree to these terms.
          </p>

          <h2>2. Use of Service</h2>
          <p>
            You may not use our service for any illegal activities or to host content that
            violates local or international laws. We reserve the right to suspend any instance
            that compromises the stability of our clusters.
          </p>

          <h2>3. Billing and Cancellations</h2>
          <p>
            Billing is handled on a monthly subscription basis. You can cancel your subscription
            at any time via the portal, and your instance will remain active until the end of
            the current billing cycle.
          </p>

          <h2>4. Availability</h2>
          <p>
            We strive for 99.9% uptime for our managed clusters. However, we are not liable for
            any data loss occurring due to user misconfiguration or infrastructure failures.
          </p>
        </div>
      </div>

      <SiteFooter />
    </>
  );
}
