// ════════════════════════════════════════════
// app/(site)/components/SpecsSection.jsx
//
// Converted from: index.body.html — #specs section.
// Pure static content → React Server Component.
// ════════════════════════════════════════════

function SpecRow({ label, value, accent = false, muted = false }) {
  return (
    <div className="specs-row">
      <span className="spec-key">{label}</span>
      <span className={`spec-val${accent ? ' spec-val-accent' : muted ? ' spec-val-muted' : ''}`}>
        {value}
      </span>
    </div>
  );
}

export default function SpecsSection() {
  return (
    <section id="specs" className="charcoal section-fade">
      <span className="sec-tag">Technical Specifications</span>
      <h2>Every layer.<br />Every detail.</h2>
      <p className="sec-sub">
        Precision-engineered infrastructure. Know exactly what powers your Strapi instance.
      </p>

      <div className="specs-grid">
        <div className="specs-group">
          <div className="specs-group-title">Infrastructure Layer</div>
          <SpecRow label="Orchestration"       value="Proprietary runtime orchestration"         accent />
          <SpecRow label="Isolation"           value="Dedicated isolated environment per tenant"         />
          <SpecRow label="Networking"          value="Isolated private network per instance"             />
          <SpecRow label="Scaling"             value="Elastic — CPU & Memory"                    accent />
          <SpecRow label="Availability regions" value="USA, EUROPE, ASIA"                               />
          <SpecRow label="Uptime SLA"          value="99.9% guaranteed (enterprise plan)"        accent />
        </div>

        <div className="specs-group">
          <div className="specs-group-title">Application Layer</div>
          <SpecRow label="CMS Platform"   value="Strapi v5 (LTS)"                accent />
          <SpecRow label="Runtime"        value="Node.js 18 / 20 / 22"                  />
          <SpecRow label="Database"       value="MySql 8"                         accent />
          <SpecRow label="File storage"   value="Persistent Storage"                     />
          <SpecRow label="SSL/TLS"        value="Automated SSL"                          />
          <SpecRow label="Custom domains" value="DNS based domain verification"   accent />
        </div>

        <div className="specs-group">
          <div className="specs-group-title">DevOps &amp; Delivery</div>
          <SpecRow label="Deployment model"    value="Git push → auto-deploy"                    />
          <SpecRow label="Supported providers" value="GitHub, GitLab"               accent       />
          <SpecRow label="Deploy time"         value="< 3 minutes avg."             accent       />
          <SpecRow label="Rollback"            value="One-click via dashboard"                   />
          <SpecRow label="Env variables"       value="Encrypted at rest"                         />
          <SpecRow label="Backups"             value="Daily automated snapshots"                 />
        </div>

        <div className="specs-group">
          <div className="specs-group-title">Security &amp; Compliance</div>
          <SpecRow label="Network policy"     value="Zero-trust by default"              accent  />
          <SpecRow label="Secrets management" value="Encrypted secrets store (at rest)"         />
          <SpecRow label="Auth model"         value="Token-based auth + secure credential hashing" />
          <SpecRow label="RBAC"               value="Owner / Admin / Viewer"             accent  />
          <SpecRow label="Audit logging"      value="SOC2-aligned access logs"                  />
          <SpecRow label="Data residency"     value="Multi Region DR (enterprise plan)"  muted   />
        </div>
      </div>
    </section>
  );
}
