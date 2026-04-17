// ════════════════════════════════════════════
// app/(site)/page.jsx — Landing page (/)
//
// Renders the body markup of the original index.html unchanged, then
// mounts src/main.js client-side to wire up animations, the deploy
// form, Stripe modals, live stats, etc.
// ════════════════════════════════════════════
import Script from 'next/script';
import { readFragment } from '../lib/htmlFragment';
import MainMount from './MainMount';

export const metadata = {
  title: 'Strapi Orbit — Managed Strapi Hosting',
  description:
    'Deploy production-ready Strapi instances in minutes. No servers to manage, no infrastructure decisions. Enterprise Strapi hosting by Strapi Orbit.',
};

export default function LandingPage() {
  const html = readFragment('index.body.html');
  return (
    <>
      {/* Stripe.js — used by the payment modal on this page */}
      <Script src="https://js.stripe.com/v3/" strategy="beforeInteractive" />
      <div
        id="__page-root"
        style={{ display: 'contents' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <MainMount />
    </>
  );
}
