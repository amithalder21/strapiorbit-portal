'use client';
// ════════════════════════════════════════════
// app/(site)/components/HeroSection.jsx
//
// Converted from: index.body.html (lines 2–58)
// Vanilla JS replaced:
//   - hero-deploy-btn click → onClick + ref scroll
//   - hero-how-btn click   → onClick + ref scroll
//   - password reset token redirect → handled in parent page useEffect
// ════════════════════════════════════════════

export default function HeroSection({ startRef, howRef }) {
  return (
    <>
      {/* Background orbs */}
      <div className="hero-bg">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="hero-orb hero-orb-3" />
      </div>

      <div className="hero">
        <div className="hero-pill">
          <span className="pill-dot" />
          Fully Managed Strapi Infrastructure · Public Beta
        </div>

        <h1>
          Enterprise Strapi.<br />
          <em>Zero Overhead.</em>
        </h1>

        <p className="hero-sub">
          Production-ready Strapi instances, live in under 3 minutes.
        </p>

        <div className="hero-btns">
          <button
            id="hero-deploy-btn"
            className="btn-primary"
            onClick={() => startRef?.current?.scrollIntoView({ behavior: 'smooth' })}
          >
            Deploy Your First Instance
          </button>
          <button
            id="hero-how-btn"
            className="btn-outline"
            onClick={() => howRef?.current?.scrollIntoView({ behavior: 'smooth' })}
          >
            See How It Works
          </button>
        </div>

        {/* Product-as-hero: static terminal mock */}
        <div className="hero-product-mock">
          <div className="hpm-bar">
            <div className="vdot vdot-r" />
            <div className="vdot vdot-y" />
            <div className="vdot vdot-g" />
            <span className="hpm-title">Strapi Orbit — Deploy Engine</span>
            <span className="hpm-indicator" />
          </div>
          <div className="hpm-body">
            <div className="hpm-line">
              <span className="hpm-prompt">$</span>
              <span className="hpm-cmd"> strapi-orbit deploy --plan pro --domain cms.acme.com</span>
            </div>
            <div className="hpm-line hpm-ok">
              ✓&nbsp; Isolated runtime environment ready&nbsp;&nbsp;&nbsp;&nbsp; <span className="hpm-tag">done</span>
            </div>
            <div className="hpm-line hpm-ok">
              ✓&nbsp; PostgreSQL 15 cluster ready&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="hpm-tag">ready</span>
            </div>
            <div className="hpm-line hpm-ok">
              ✓&nbsp; SSL certificate issued via cert-manager <span className="hpm-tag">issued</span>
            </div>
            <div className="hpm-line hpm-ok">
              ✓&nbsp; Strapi v5 image deployed&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="hpm-tag">deployed</span>
            </div>
            <div className="hpm-line hpm-ok">
              ✓&nbsp; Domain cms.acme.com verified &amp; active&nbsp; <span className="hpm-tag">live</span>
            </div>
            <div className="hpm-line hpm-result">
              ›&nbsp; Instance is live. Total deploy time: 2m 41s&nbsp;<span className="hpm-cursor" />
            </div>
          </div>
          <div className="hpm-footer">
            <span className="hpm-status-dot" />
            <span>All systems operational</span>
            <span style={{ marginLeft: 'auto' }}>
              Avg. deploy: <strong>2m 41s</strong>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
