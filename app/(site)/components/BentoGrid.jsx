// ════════════════════════════════════════════
// app/(site)/components/BentoGrid.jsx
//
// Converted from: index.body.html — #why section bento-grid cards.
// Pure static content → React Server Component (no 'use client').
// ════════════════════════════════════════════

export default function BentoGrid() {
  return (
    <section id="why" className="section-fade">
      <div className="sec-header">
        <span className="sec-tag">Why Strapi Orbit</span>
        <h2>Built for teams that<br />need it to just work.</h2>
        <p className="sec-sub">
          Purpose-built managed Strapi hosting. Enterprise infrastructure, zero operations overhead.
        </p>
      </div>

      <div className="bento-grid">
        {/* Card 1: Infrastructure */}
        <div className="bento-card">
          <div className="bento-eyebrow">Infrastructure</div>
          <div className="bento-title">Total isolation by design.</div>
          <div className="bento-desc">
            Every instance runs inside its own fully isolated runtime environment. Dedicated
            compute, isolated networking, automated SSL — applied automatically, every deployment,
            without exception.
          </div>
          <div className="bento-metrics">
            <div className="bento-metric">
              <span className="bento-metric-num">100%</span>
              <span className="bento-metric-label">Isolated tenants</span>
            </div>
            <div className="bento-metric">
              <span className="bento-metric-num">0</span>
              <span className="bento-metric-label">Shared resources</span>
            </div>
            <div className="bento-metric">
              <span className="bento-metric-num">VPC</span>
              <span className="bento-metric-label">Per instance</span>
            </div>
          </div>
        </div>

        {/* Card 2: Delivery */}
        <div className="bento-card">
          <div className="bento-eyebrow">Delivery</div>
          <div className="bento-title">Live in under 3 minutes.</div>
          <div className="bento-desc">
            Push to deploy with automated CI/CD. Databases, SSL, and monitoring provisioned
            instantly.
          </div>
          <div className="bento-stat">
            <span className="bento-stat-num">
              &lt;3<span className="bento-stat-unit">min</span>
            </span>
          </div>
        </div>

        {/* Card 3: Observability */}
        <div className="bento-card">
          <div className="bento-eyebrow">Observability</div>
          <div className="bento-title">Deep platform intelligence.</div>
          <div className="bento-desc">
            Elastic auto-scaling, built-in health telemetry, and real-time performance metrics.
            Full visibility into every layer of your stack.
          </div>
        </div>

        {/* Card 4: Reliability */}
        <div className="bento-card">
          <div className="bento-eyebrow">Reliability</div>
          <div className="bento-title">99.9% uptime. Backed by infrastructure, not promises.</div>
          <div className="bento-desc">
            Redundant clusters across multiple availability regions with automated failover. Our
            SLA is contractual — downtime costs us, which means we&apos;re motivated to prevent it.
          </div>
          <div className="bento-metrics">
            <div className="bento-metric">
              <span className="bento-metric-num">99.9%</span>
              <span className="bento-metric-label">Uptime SLA</span>
            </div>
            <div className="bento-metric">
              <span className="bento-metric-num">3</span>
              <span className="bento-metric-label">Availability regions</span>
            </div>
            <div className="bento-metric">
              <span className="bento-metric-num">Auto</span>
              <span className="bento-metric-label">Failover</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
