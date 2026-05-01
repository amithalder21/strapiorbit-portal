// ════════════════════════════════════════════
// app/(site)/privacy/page.jsx — /privacy
//
// Converted from: content/privacy.body.html
// Pattern: Native RSC JSX — no dangerouslySetInnerHTML, no vanilla JS,
//          no readFragment(), no lucide.createIcons() script.
// ════════════════════════════════════════════
import SiteNav from '../components/SiteNav';
import SiteFooter from '../components/SiteFooter';

export const metadata = {
  title: 'Privacy Policy — Strapi Orbit',
  description:
    'Learn how Strapi Orbit collects, uses, and protects your data. We do not track, broker, or sell your personal information.',
};

export default function PrivacyPage() {
  return (
    <>
      <SiteNav />

      <div className="legal-wrap">
        <a href="/" className="legal-back">← Back to home</a>
        <h1 className="legal-title">Privacy Policy</h1>
        <div className="legal-date">Last updated: April 2026</div>

        <div className="legal-content">
          <h2>1. Information We Collect</h2>
          <p>
            When you register for Strapi Orbit, we solely collect your email address and payment
            details securely processed by Stripe. We do not track, broker, or sell your personal
            data.
          </p>

          <h2>2. How We Use Information</h2>
          <p>
            We use your information exclusively to provide the managed Strapi hosting service,
            bill for compute resources utilized, and communicate crucial account notifications.
          </p>

          <h2>3. Cookies and Tracking</h2>
          <p>
            Strapi Orbit utilizes strictly necessary cookies for session management
            (authentication) and security. We do not use third-party marketing or cross-site
            tracking cookies.
          </p>

          <h2>4. Contact &amp; Feedback</h2>
          <p>
            If you have any questions regarding your data privacy, or wish to request immediate
            data deletion, please contact our support team at{' '}
            <strong>beta@strapiorbit.cloud</strong>.
          </p>
          <p>
            As we are launching our public beta, we kindly ask our users and teams to provide
            any feedback, bug reports, or feature suggestions directly to that email.
          </p>
        </div>
      </div>

      <SiteFooter />
    </>
  );
}
