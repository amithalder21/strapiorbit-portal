// ════════════════════════════════════════════
// animations.js — All visual / entrance effects
// ════════════════════════════════════════════

export function initAnimations() {
  initScrollFade();
  initCardAnimations();
  initTerminal();
  initCountUp();
  initStepCycle();
  initValueExplorer();
}

// ── How-it-works step switcher ──
const stepContents = [
  `<div><span class="vc-dim">Domain</span>    <span class="vc-accent">acme.justbots.tech</span></div>
   <div><span class="vc-dim">Plan</span>      <span class="vc-accent2">PRO</span></div>
   <div>&nbsp;</div>
   <div><span class="vc-ok">✓</span> <span class="vc-dim">Configuration validated</span></div>
   <div><span class="vc-ok">✓</span> <span class="vc-dim">Payment confirmed</span></div>
   <div><span class="vc-dim">  Provisioning starting...</span></div>`,

  `<div><span class="vc-ok">✓</span> <span class="vc-dim">Database ready</span></div>
   <div><span class="vc-ok">✓</span> <span class="vc-dim">Performance layer ready</span></div>
   <div><span class="vc-ok">✓</span> <span class="vc-dim">Application deployed</span></div>
   <div><span class="vc-ok">✓</span> <span class="vc-dim">TLS certificate issued</span></div>
   <div><span class="vc-ok">✓</span> <span class="vc-dim">Monitoring configured</span></div>
   <div>&nbsp;</div>
   <div><span class="vc-dim">  All systems ready </span><span class="vc-ok">●</span></div>`,

  `<div><span class="vc-ok">✓</span> <span class="vc-dim">Instance live</span></div>
   <div><span class="vc-ok">✓</span> <span class="vc-dim">Admin panel ready</span></div>
   <div>&nbsp;</div>
   <div><span class="vc-dim">  Auto-deploy enabled</span></div>
   <div><span class="vc-accent">→</span> <span class="vc-dim">Push to deploy automatically</span></div>
   <div>&nbsp;</div>
   <div><span class="vc-dim">  Credentials sent to email </span><span class="vc-ok">●</span></div>`,
];

export function setStep(i) {
  const how = document.getElementById('how');
  how?.querySelectorAll('.how-step').forEach((s, j) => {
    s.classList.toggle('active', j === i);
  });
  const vc = document.getElementById('visual-content');
  if (vc) vc.innerHTML = stepContents[i];
}

// Attach click listeners
function initStepCycle() {
  const how = document.getElementById('how');
  how?.querySelectorAll('.how-step').forEach((el, i) => {
    el.addEventListener('click', () => {
      _stopCycle = true;
      setStep(i);
    });
  });
  let _step = 0;
  let _stopCycle = false;
  setInterval(() => {
    if (_stopCycle) return;
    _step = (_step + 1) % 3;
    setStep(_step);
  }, 4500);
}

function initScrollFade() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('section, .stats-bar, footer').forEach(el => {
    el.classList.add('section-fade');
    io.observe(el);
  });
}

function initCardAnimations() {
  const cardIo = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      cardIo.unobserve(e.target);
      e.target.classList.add('visible');
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.value-card').forEach((el, i) => {
    el.style.transitionDelay = (i * 0.07) + 's';
    cardIo.observe(el);
  });

  const priceIo = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      priceIo.unobserve(e.target);
      e.target.classList.add('visible');
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.pricing-card').forEach((el, i) => {
    el.style.transitionDelay = (i * 0.12) + 's';
    priceIo.observe(el);
  });
}

function initTerminal() {
  const steps = [
    [
      '<span class="vc-dim">$</span> <span class="vc-accent">strapi-orbit</span> <span class="vc-dim">deploy</span>',
      '<span class="vc-dim">  Connecting to platform...</span>',
      '<span class="vc-ok">✓</span> <span class="vc-dim">Environment created</span>',
      '<span class="vc-ok">✓</span> <span class="vc-dim">Database provisioned</span>',
      '<span class="vc-ok">✓</span> <span class="vc-dim">Cache ready</span>',
      '<span class="vc-dim">  Building application...</span>',
    ],
    [
      '<span class="vc-dim">$</span> <span class="vc-accent">strapi-orbit</span> <span class="vc-dim">status</span>',
      '<span class="vc-dim">SERVICE           STATUS</span>',
      '<span class="vc-accent2">strapi-app        Online</span>',
      '<span class="vc-accent2">database          Online</span>',
      '<span class="vc-accent2">redis-cache       Online</span>',
      '<span class="vc-ok">✓</span> <span class="vc-dim">All systems operational</span>',
    ],
    [
      '<span class="vc-dim">$</span> <span class="vc-accent">git push</span> <span class="vc-dim">origin main</span>',
      '<span class="vc-dim">  Webhook received...</span>',
      '<span class="vc-ok">✓</span> <span class="vc-dim">Building from commit a3f9c2d</span>',
      '<span class="vc-ok">✓</span> <span class="vc-dim">Image pushed</span>',
      '<span class="vc-ok">✓</span> <span class="vc-dim">Rolling update complete</span>',
      '<span class="vc-purple">⚡ Live in 47s</span>',
    ],
  ];

  let currentStep = 0;
  const container = document.getElementById('visual-content');
  if (!container) return;

  function playLines(lines) {
    container.innerHTML = '<div><span class="vc-cursor"></span></div>';
    let i = 0;
    function addLine() {
      if (i >= lines.length) {
        setTimeout(() => {
          currentStep = (currentStep + 1) % steps.length;
          playLines(steps[currentStep]);
        }, 2800);
        return;
      }
      const div = document.createElement('div');
      div.innerHTML = lines[i];
      container.insertBefore(div, container.lastElementChild);
      i++;
      setTimeout(addLine, 420 + Math.random() * 200);
    }
    setTimeout(addLine, 300);
  }

  setTimeout(() => playLines(steps[0]), 1200);
}

function initCountUp() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const el       = e.target;
      const target   = parseFloat(el.dataset.target);
      const decimals = parseInt(el.dataset.decimals || '0', 10);
      const duration = 1400;
      const step     = 16;
      const steps    = duration / step;
      const inc      = target / steps;
      let current  = 0;
      const timer = setInterval(() => {
        current = Math.min(current + inc, target);
        el.textContent = current.toFixed(decimals);
        if (current >= target) clearInterval(timer);
      }, step);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.count-up').forEach(el => io.observe(el));
}

export function launchConfetti() {
  const colors = ['rgba(255,255,255,0.7)','rgba(255,255,255,0.4)','rgba(139,92,246,0.8)','rgba(139,92,246,0.5)'];
  for (let i = 0; i < 32; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'confetti-particle';
      el.style.left        = Math.random() * 100 + 'vw';
      el.style.top         = '-10px';
      el.style.background  = colors[Math.floor(Math.random() * colors.length)];
      el.style.width       = (Math.random() * 4 + 3) + 'px';
      el.style.height      = (Math.random() * 4 + 3) + 'px';
      el.style.animationDuration = (Math.random() * 0.6 + 1.2) + 's';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 2200);
    }, i * 22);
  }
}

// ── Value explorer walkthrough switcher ──
const featureSimContents = [
  `<div><span class="vc-dim">$</span> <span class="vc-accent">orbit</span> <span class="vc-dim">isolate --domain</span></div>
   <div>&nbsp;</div>
   <div><span class="vc-dim">VPC:</span> <span class="vc-ok">Isolated [0x92f]</span></div>
   <div><span class="vc-dim">TLS 1.3:</span> <span class="vc-ok">Verified</span></div>
   <div><span class="vc-dim">Cert:</span> <span class="vc-accent2">Auto-Renewing</span></div>
   <div><span class="vc-ok">✓</span> <span class="vc-dim">Dedicated CPU locked</span></div>`,
  
  `<div><span class="vc-dim">$</span> <span class="vc-accent">git push</span> <span class="vc-dim">origin main</span></div>
   <div>&nbsp;</div>
   <div><span class="vc-dim">→ Webhook received</span></div>
   <div><span class="vc-ok">✓</span> <span class="vc-dim">CI/CD Pipeline started</span></div>
   <div><span class="vc-dim">→ Rolling out cluster...</span></div>
   <div><span class="vc-ok">●</span> <span class="vc-accent2">Instance Live [3m]</span></div>`,

  `<div><span class="vc-dim">$</span> <span class="vc-accent">orbit</span> <span class="vc-dim">top --auto-scale</span></div>
   <div>&nbsp;</div>
   <div><span class="vc-dim">Traffic:</span>   [ <span class="vc-ok">|||||||</span>--- ] <span class="vc-dim">+140%</span></div>
   <div><span class="vc-ok">✓</span> <span class="vc-dim">Elastic node provisioned</span></div>
   <div><span class="vc-dim">Health:</span>    <span class="vc-ok">OPERATIONAL [42ms]</span></div>`,
];

export function setFeature(i) {
  const why = document.getElementById('why');
  why?.querySelectorAll('.how-step').forEach((s, j) => {
    s.classList.toggle('active', j === i);
  });
  const vc = document.getElementById('feature-visual-content');
  if (vc) vc.innerHTML = featureSimContents[i];
}

export function initValueExplorer() {
  const why = document.getElementById('why');
  why?.querySelectorAll('.how-step').forEach((el, i) => {
    el.addEventListener('click', () => {
      _stopFeatureCycle = true;
      setFeature(i);
    });
    el.addEventListener('mouseenter', () => setFeature(i));
  });

  let _f = 0;
  let _stopFeatureCycle = false;
  setInterval(() => {
    if (_stopFeatureCycle) return;
    _f = (_f + 1) % 3;
    setFeature(_f);
  }, 4500);

  // Initial state
  setFeature(0);
}
