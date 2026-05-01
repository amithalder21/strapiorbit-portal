'use client';
// ════════════════════════════════════════════
// app/(site)/components/PricingSection.jsx
//
// Converted from: index.body.html — #pricing section
// + choosePlan() from form.js
//
// Key changes:
//   - plan-cta click → onChoosePlan callback prop
//   - section-fade class applied; parent IntersectionObserver handles visibility
// ════════════════════════════════════════════

const PLANS = [
  {
    id: 'starter',
    tier: 'Starter',
    price: 29,
    billing: 'per month',
    features: [
      'One Strapi instance',
      'Basic storage & bandwidth',
      'Custom domain with SSL',
      'Regular Platform Updates',
      'Community support',
      'Ideal for small projects',
    ],
    featured: false,
  },
  {
    id: 'pro',
    tier: 'Pro',
    price: 79,
    billing: 'per instance · monthly',
    features: [
      'Everything in Starter',
      '10x more storage capacity',
      'GitHub & GitLab integration',
      'Advanced monitoring',
      '99.5% uptime guarantee',
      'Priority email support',
    ],
    featured: true,
  },
  {
    id: 'enterprise',
    tier: 'Enterprise',
    price: 199,
    billing: 'per instance · monthly',
    features: [
      'Everything in Pro',
      'Unlimited storage & traffic',
      'Dedicated infrastructure',
      '99.9% uptime SLA',
      'Custom integrations',
      '24/7 phone support',
    ],
    featured: false,
  },
];

export default function PricingSection({ onChoosePlan, selectedPlan }) {
  return (
    <section id="pricing" className="section-fade">
      <span className="sec-tag">Pricing</span>
      <h2>Simple, transparent<br />pricing.</h2>
      <p className="sec-sub">
        All plans include a 28-day free trial. No credit card required to start. Upgrade anytime.
      </p>

      <div className="pricing-grid">
        {PLANS.map(plan => (
          <div
            key={plan.id}
            className={`pricing-card${plan.featured ? ' featured' : ''}${selectedPlan === plan.id ? ' selected' : ''}`}
          >
            {plan.featured && <div className="pop-badge">Most popular</div>}
            <div className="plan-top-spacer" />
            <div className="plan-tier">{plan.tier}</div>
            <div className="plan-price"><sup>$</sup>{plan.price}</div>
            <div className="plan-billing">{plan.billing}</div>
            <hr className="plan-hr" />
            <ul className="plan-feat">
              {plan.features.map((f, i) => (
                <li key={i}><span className="check">✓</span>{f}</li>
              ))}
            </ul>
            <button
              className={`plan-cta${plan.featured ? ' featured-cta' : ''}`}
              data-plan={plan.id}
              onClick={() => onChoosePlan?.(plan.id)}
            >
              Get started
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
