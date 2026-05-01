// ════════════════════════════════════════════
// app/(site)/components/SiteFooter.jsx
//
// Shared footer + horizontal rule used by every public page.
// React Server Component — no interactivity needed.
// All class names kept identical to style.css.
// ════════════════════════════════════════════

export default function SiteFooter() {
  return (
    <>
      <hr className="divider" />
      <footer>
        <div className="footer-left">
          <div className="logo-mark">SO</div>
          Strapi Orbit{' '}
          <span
            style={{
              fontSize: '10px',
              color: 'rgba(255,255,255,0.4)',
              fontFamily: "'DM Mono',monospace",
              marginLeft: '4px',
            }}
          >
            v1.0.0
          </span>
        </div>
        <ul className="footer-links">
          <li><a href="/#why">Features</a></li>
          <li><a href="/#pricing">Pricing</a></li>
          <li><a href="/privacy">Privacy</a></li>
          <li><a href="/tos">Terms</a></li>
          <li>
            <a
              href="https://admin-beta.strapiorbit.cloud"
              style={{ color: 'var(--accent2)' }}
            >
              Admin Console
            </a>
          </li>
        </ul>
        <span className="footer-copy">© 2026 Nosia Technologies</span>
      </footer>
    </>
  );
}
