# strapiorbit-portal

Next.js 15 (App Router) portal for StrapOrbit — customer-facing landing page, dashboard, and admin console.

## Stack

- **Framework**: Next.js 15 (App Router)
- **Runtime**: Node.js 18+
- **Styling**: Vanilla CSS (`src/style.css`) + per-page inline styles
- **Payments**: Stripe Elements
- **Icons**: Lucide
- **Fonts**: Inter, DM Mono, sohne-var

## Project structure

```
app/
  (site)/          ← landing, dashboard, privacy, tos pages
  admin/           ← admin console (/admin route)
  layout.jsx       ← root layout
content/           ← extracted HTML fragments (body markup per page)
src/
  admin.js         ← admin console vanilla JS (~3000 lines)
  dashboard.js     ← dashboard entry
  main.js          ← landing page entry
  modules/         ← shared modules (payment, api, modals, form, etc.)
  lib/             ← api-client
  style.css        ← global styles
public/            ← static assets (favicon, icons)
nginx/             ← nginx config for production
```

## How the HTML/JS wiring works

Each Next.js page has a `*Mount.jsx` client component that dynamically imports
the corresponding vanilla JS entry file and dispatches a synthetic
`DOMContentLoaded` event so all listeners fire as expected.

HTML body markup is extracted into `content/*.body.html` and injected via
`dangerouslySetInnerHTML` — no JSX conversion needed.

| Concern | Approach |
|---------|----------|
| HTML markup | Extracted to `content/*.body.html`, injected via `dangerouslySetInnerHTML` |
| CSS | `src/style.css` imported in `app/(site)/layout.jsx`; admin uses `content/admin.inline-style.css` |
| JS modules | Unchanged from original; mounted via `*Mount.jsx` client components |
| External scripts | Fonts, Lucide, Stripe loaded via `next/script` |
| URL back-compat | `next.config.mjs` rewrites `.html` URLs to clean equivalents |
| Dev API proxy | `/api/*` proxied to Flask backend on `:5000` when `NEXT_PUBLIC_API_URL` is unset |

## Getting started

```bash
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL for your backend
npm install
npm run dev                  # http://localhost:5173
```

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/dashboard` | Customer portal |
| `/admin` | Admin console (hostname-gated) |
| `/privacy` | Privacy policy |
| `/tos` | Terms of service |

## Environment variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL. Leave empty in dev to proxy to `:5000` |

Copy `.env.example` to `.env.local` and fill in values. **Never commit `.env.production` or `.env.local`.**

## Production build

```bash
npm run build
npm start
```

Or deploy to any Node-capable host (Vercel, Coolify, VPS with nginx).
See `nginx/strapiorbit.conf` for the nginx reverse-proxy config.
