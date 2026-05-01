// ════════════════════════════════════════════
// app/(site)/components/SiteNav.jsx
//
// Shared top-navigation bar used by every public site page.
// Renders as a React Server Component — no 'use client' needed.
// All class names kept identical to style.css.
// ════════════════════════════════════════════

export default function SiteNav({ activePage }) {
  return (
    <nav>
      <a href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="logo">
          <div className="logo-mark">SO</div>
          Strapi Orbit
        </div>
      </a>
      <ul className="nav-links">
        <li><a href="/#why">Features</a></li>
        <li><a href="/#specs">Specs</a></li>
        <li><a href="/#pricing">Pricing</a></li>
        <li><a href="/#start">Deploy</a></li>
      </ul>
      <div className="nav-actions">
        <a href="/dashboard" className="btn-nav">Dashboard</a>
      </div>
    </nav>
  );
}
