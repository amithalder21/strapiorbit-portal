# StrapOrbit Portal

The customer-facing frontend for [StrapOrbit](https://strapiorbit.cloud) — a managed Strapi hosting platform. Includes the marketing landing page, customer dashboard, and an internal admin console.

Built with **Next.js 15** (App Router), deployed as a static site via GitHub Actions to a self-hosted nginx server.

---

## Features

- **Landing page** — pricing, live instance counter, cluster availability, deploy form with Stripe checkout
- **Customer dashboard** — manage instances, Git/CI-CD config, billing, password reset, notifications
- **Admin console** — full internal panel: tenant management, users, subscriptions, invoices, audit log, sessions, organizations, rate limits, jobs, system status, DB backups
- **Stripe integration** — subscription checkout, renewal, and payment history
- **Static export** — builds to flat HTML/CSS/JS, served by nginx with no Node runtime in production
- **Security headers** — X-Frame-Options, HSTS, CSP-ready, Permissions-Policy on all routes

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| Language | JavaScript (ES2022) |
| Styling | Vanilla CSS — Stripe-inspired design system |
| Payments | Stripe Elements (card, subscription) |
| Icons | Lucide |
| Fonts | Inter, DM Mono, sohne-var |
| CI/CD | GitHub Actions → SCP → nginx |
| Hosting | Self-hosted VPS + Let's Encrypt TLS |

---

## Project Structure

```
.
├── app/
│   ├── (site)/                  # Landing, dashboard, privacy, ToS pages
│   │   ├── page.jsx             # Landing page (/)
│   │   ├── dashboard/           # Customer dashboard (/dashboard)
│   │   ├── privacy/             # Privacy policy
│   │   ├── tos/                 # Terms of service
│   │   └── layout.jsx           # Shared layout (imports style.css)
│   ├── admin/                   # Admin console (/admin)
│   │   ├── page.jsx             # Admin page — injects HTML/CSS fragments
│   │   └── AdminMount.jsx       # Client component — mounts admin.js
│   ├── layout.jsx               # Root layout
│   └── lib/
│       └── htmlFragment.js      # Reads content/*.html files at build time
├── content/                     # Extracted HTML/CSS fragments (per page)
│   ├── admin.body.html
│   ├── admin.inline-style.css
│   ├── admin.inline-head-script.js
│   ├── dashboard.body.html
│   └── index.body.html
├── src/
│   ├── admin.js                 # Admin console — full vanilla JS (~3k lines)
│   ├── dashboard.js             # Dashboard entry point
│   ├── main.js                  # Landing page entry point
│   ├── style.css                # Global design system styles
│   ├── modules/                 # Shared JS modules
│   │   ├── api.js               # Live data fetching (instances, clusters, stats)
│   │   ├── payment.js           # Stripe Elements — checkout + renewal
│   │   ├── form.js              # Multi-step deploy form
│   │   ├── modals.js            # Modal open/close/ESC handling
│   │   ├── portal.js            # Dashboard logic
│   │   ├── animations.js        # Entrance animations
│   │   └── utils.js             # Toast, helpers
│   └── lib/
│       └── api-client.js        # Authenticated fetch wrapper
├── public/                      # Static assets (favicon, icon sprite)
├── nginx/
│   └── strapiorbit.conf         # Production nginx config
├── .github/
│   └── workflows/
│       └── deploy-frontend.yml  # CI/CD: build → SCP → nginx reload
├── next.config.mjs              # Next.js config (static export, rewrites, headers)
├── DESIGN.md                    # Design system reference (Stripe-inspired)
└── .env.example                 # Environment variable template
```

---

## Architecture

The app uses a **hybrid rendering pattern**: Next.js handles routing and build tooling, while the actual page markup and interactivity remain as vanilla HTML/CSS/JS. This keeps the original UI pixel-perfect while gaining Next.js's static export, file-based routing, and security headers.

Each page follows this pattern:

```
Next.js page (page.jsx)
  ├── Reads content/*.body.html  →  dangerouslySetInnerHTML
  ├── Injects inline <style> from content/*.css
  └── *Mount.jsx (client component)
        └── dynamic import(src/*.js)
              └── dispatches synthetic DOMContentLoaded
```

In **production**, `BUILD_STATIC=1` triggers `output: 'export'`, generating flat `.html` files in `/out` that nginx serves directly — no Node.js process needed at runtime.

In **development**, Next.js runs as a server and proxies `/api/*` to the Flask backend on `:5000`.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Local Development

```bash
# 1. Clone and install
git clone https://github.com/amithalder21/strapiorbit-portal.git
cd strapiorbit-portal
npm install

# 2. Configure environment
cp .env.example .env.local
# Leave NEXT_PUBLIC_API_URL empty — /api/* will proxy to localhost:5000

# 3. Start dev server
npm run dev
# → http://localhost:5173
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL (no trailing slash) | Empty → proxies to `:5000` in dev |

> Copy `.env.example` to `.env.local`. Never commit `.env.local` or `.env.production` — they are gitignored.

---

## Routes

| Route | Description |
|-------|-------------|
| `/` | Marketing landing page |
| `/dashboard` | Customer portal |
| `/admin` | Internal admin console (hostname-gated) |
| `/privacy` | Privacy policy |
| `/tos` | Terms of service |

Legacy `.html` URLs (`/dashboard.html`, `/admin.html`, etc.) are permanently redirected to their clean equivalents.

---

## Deployment

### CI/CD (GitHub Actions)

Every push to `master` triggers `.github/workflows/deploy-frontend.yml`:

1. Builds a static export: `BUILD_STATIC=1 npm run build:static`
2. SCPs the `/out` directory to the production server
3. Deploys the nginx config
4. Reloads nginx

Required GitHub repository secrets:

| Secret | Description |
|--------|-------------|
| `SERVER_HOST` | Production server IP or hostname |
| `SERVER_USER` | SSH username |
| `SERVER_PASSWORD` | SSH password |

### Manual Build

```bash
# Static export (production)
BUILD_STATIC=1 NEXT_PUBLIC_API_URL=https://api.strapiorbit.cloud npm run build:static
# Output: /out

# Node server mode (optional)
npm run build
npm start
```

### nginx

The `nginx/strapiorbit.conf` config handles:
- HTTP → HTTPS redirect
- TLS (Let's Encrypt, TLSv1.2/1.3)
- Clean URLs (strips `.html`, serves `foo.html` for `/foo`)
- All security headers (HSTS, X-Frame-Options, etc.)
- Aggressive static asset caching (1 year, immutable)
- Gzip compression

---

## Design System

See [`DESIGN.md`](DESIGN.md) for the full Stripe-inspired design reference — color palette, typography scale, shadow system, spacing, and component rules used throughout the portal and admin console.

---

## License

Private — all rights reserved.
