'use client';
// ════════════════════════════════════════════
// app/(site)/components/HowItWorksSection.jsx
//
// Converted from: index.body.html — #how section
// + initStepCycle() from animations.js
// + initTerminal() from animations.js
//
// Key changes:
//   - setStep() DOM writes → useState(activeStep)
//   - setInterval for step cycling → useEffect with cleanup
//   - Terminal playLines() recursive setTimeout → useEffect with cleanup
//   - vc.innerHTML = stepContents[i] → conditional render from data array
// ════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react';

// ── How-it-works step content (was stepContents[] in animations.js) ──────────
const HOW_STEPS = [
  {
    num: '01',
    title: 'Provide details',
    desc: 'Choose your name, domain, and plan. Connect your Git repository for automatic updates on every push.',
    visual: [
      <><span className="vc-dim">Domain</span>{'    '}<span className="vc-accent">acme.justbots.tech</span></>,
      <><span className="vc-dim">Plan</span>{'      '}<span className="vc-accent2">PRO</span></>,
      <>&nbsp;</>,
      <><span className="vc-ok">✓</span> <span className="vc-dim">Configuration validated</span></>,
      <><span className="vc-ok">✓</span> <span className="vc-dim">Payment confirmed</span></>,
      <><span className="vc-dim">{'  '}Provisioning starting...</span></>,
    ],
  },
  {
    num: '02',
    title: 'Automated setup',
    desc: 'Databases, SSL, and monitoring are provisioned automatically. Your instance is live in under 3 minutes.',
    visual: [
      <><span className="vc-ok">✓</span> <span className="vc-dim">Database ready</span></>,
      <><span className="vc-ok">✓</span> <span className="vc-dim">Performance layer ready</span></>,
      <><span className="vc-ok">✓</span> <span className="vc-dim">Application deployed</span></>,
      <><span className="vc-ok">✓</span> <span className="vc-dim">TLS certificate issued</span></>,
      <><span className="vc-ok">✓</span> <span className="vc-dim">Monitoring configured</span></>,
      <>&nbsp;</>,
      <><span className="vc-dim">{'  '}All systems ready </span><span className="vc-ok">●</span></>,
    ],
  },
  {
    num: '03',
    title: 'Publish and scale',
    desc: 'Create content immediately. Your repository updates deploy automatically. Scale anytime with zero downtime.',
    visual: [
      <><span className="vc-ok">✓</span> <span className="vc-dim">Instance live</span></>,
      <><span className="vc-ok">✓</span> <span className="vc-dim">Admin panel ready</span></>,
      <>&nbsp;</>,
      <><span className="vc-dim">{'  '}Auto-deploy enabled</span></>,
      <><span className="vc-accent">→</span> <span className="vc-dim">Push to deploy automatically</span></>,
      <>&nbsp;</>,
      <><span className="vc-dim">{'  '}Credentials sent to email </span><span className="vc-ok">●</span></>,
    ],
  },
];

// ── Terminal sequences (was steps[] inside initTerminal()) ───────────────────
const TERMINAL_SEQUENCES = [
  [
    <><span className="vc-dim">$</span> <span className="vc-accent">strapi-orbit</span> <span className="vc-dim">deploy</span></>,
    <><span className="vc-dim">{'  '}Connecting to platform...</span></>,
    <><span className="vc-ok">✓</span> <span className="vc-dim">Environment created</span></>,
    <><span className="vc-ok">✓</span> <span className="vc-dim">Database provisioned</span></>,
    <><span className="vc-ok">✓</span> <span className="vc-dim">Cache ready</span></>,
    <><span className="vc-dim">{'  '}Building application...</span></>,
  ],
  [
    <><span className="vc-dim">$</span> <span className="vc-accent">strapi-orbit</span> <span className="vc-dim">status</span></>,
    <><span className="vc-dim">SERVICE{'           '}STATUS</span></>,
    <><span className="vc-accent2">strapi-app{'        '}Online</span></>,
    <><span className="vc-accent2">database{'          '}Online</span></>,
    <><span className="vc-accent2">redis-cache{'       '}Online</span></>,
    <><span className="vc-ok">✓</span> <span className="vc-dim">All systems operational</span></>,
  ],
  [
    <><span className="vc-dim">$</span> <span className="vc-accent">git push</span> <span className="vc-dim">origin main</span></>,
    <><span className="vc-dim">{'  '}Webhook received...</span></>,
    <><span className="vc-ok">✓</span> <span className="vc-dim">Building from commit a3f9c2d</span></>,
    <><span className="vc-ok">✓</span> <span className="vc-dim">Image pushed</span></>,
    <><span className="vc-ok">✓</span> <span className="vc-dim">Rolling update complete</span></>,
    <><span className="vc-purple">⚡ Live in 47s</span></>,
  ],
];

// ── Terminal animation hook ───────────────────────────────────────────────────
function useTerminalAnimation() {
  const [lines, setLines] = useState([]);
  const cancelledRef = useRef(false);
  const timerRef = useRef(null);
  const seqIndexRef = useRef(0);

  useEffect(() => {
    cancelledRef.current = false;

    function playSequence(seqIdx) {
      const seq = TERMINAL_SEQUENCES[seqIdx % TERMINAL_SEQUENCES.length];
      setLines([]);
      let i = 0;

      function addLine() {
        if (cancelledRef.current) return;
        if (i >= seq.length) {
          timerRef.current = setTimeout(() => {
            if (!cancelledRef.current) playSequence(seqIdx + 1);
          }, 2800);
          return;
        }
        setLines(prev => [...prev, seq[i]]);
        i++;
        timerRef.current = setTimeout(addLine, 420 + Math.random() * 200);
      }

      timerRef.current = setTimeout(addLine, 300);
    }

    timerRef.current = setTimeout(() => playSequence(0), 1200);
    return () => {
      cancelledRef.current = true;
      clearTimeout(timerRef.current);
    };
  }, []);

  return lines;
}

export default function HowItWorksSection({ sectionRef }) {
  const [activeStep, setActiveStep] = useState(0);
  const [userChose, setUserChose] = useState(false);
  const terminalLines = useTerminalAnimation();

  // Auto-cycle steps every 4.5s unless user clicked
  useEffect(() => {
    if (userChose) return;
    const id = setInterval(() => setActiveStep(s => (s + 1) % 3), 4500);
    return () => clearInterval(id);
  }, [userChose]);

  function handleStepClick(i) {
    setUserChose(true);
    setActiveStep(i);
  }

  return (
    <section id="how" className="charcoal section-fade" ref={sectionRef}>
      <span className="sec-tag">How It Works</span>
      <h2>Three steps.<br />Production-ready.</h2>
      <p className="sec-sub">
        Launch without complexity. Everything is configured and ready to use. You handle the
        content — we handle the infrastructure.
      </p>

      <div className="how-grid">
        {/* Steps list */}
        <div className="how-steps">
          {HOW_STEPS.map((step, i) => (
            <div
              key={i}
              className={`how-step${activeStep === i ? ' active' : ''}`}
              data-step={i}
              onClick={() => handleStepClick(i)}
              style={{ cursor: 'pointer' }}
            >
              <div className="step-circle">{step.num}</div>
              <div className="step-body">
                <div className="step-title">{step.title}</div>
                <div className="step-desc">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Visual content pane */}
        <div className="how-visual">
          <div className="visual-bar">
            <div className="vdot vdot-r" />
            <div className="vdot vdot-y" />
            <div className="vdot vdot-g" />
            <div style={{
              marginLeft: '12px',
              fontSize: '10px',
              fontFamily: "'Source Code Pro','SFMono-Regular','DM Mono',monospace",
              color: 'rgba(255,255,255,0.72)',
              letterSpacing: '1px',
            }}>
              DASHBOARD / SHELL
            </div>
          </div>
          <div className="visual-content" id="visual-content">
            {/* Active step content */}
            {HOW_STEPS[activeStep].visual.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
            {/* Terminal cursor */}
            <div><span className="vc-cursor" /></div>
          </div>
        </div>
      </div>
    </section>
  );
}
