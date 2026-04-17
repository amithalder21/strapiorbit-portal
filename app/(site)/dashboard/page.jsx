// ════════════════════════════════════════════
// app/(site)/dashboard/page.jsx — Dashboard (/dashboard)
// ════════════════════════════════════════════
import Script from 'next/script';
import { readFragment } from '../../lib/htmlFragment';
import DashboardMount from './DashboardMount';

export const metadata = {
  title: 'Dashboard — Strapi Orbit',
  description: 'Manage your Strapi instances, deployments, and team members.',
};

export default function DashboardPage() {
  const html = readFragment('dashboard.body.html');
  return (
    <>
      {/* Stripe.js — used by the renew subscription modal */}
      <Script src="https://js.stripe.com/v3/" strategy="beforeInteractive" />
      <div
        id="__page-root"
        style={{ display: 'contents' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <DashboardMount />
    </>
  );
}
