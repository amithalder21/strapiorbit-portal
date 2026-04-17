# portal-next

Next.js 15 (App Router) port of the original Vite-based `portal/` app.
**Content, design, and functionality are preserved identically** — the original
HTML markup, `style.css`, and vanilla JS modules are reused byte-for-byte.
Only the build/serve layer changes from Vite → Next.js.

## How the port works

| Concern | Approach |
|---|---|
| HTML markup | `<body>` contents of each page were extracted into `/content/*.body.html` and injected into Next.js pages via `dangerouslySetInnerHTML`. No JSX conversion — same bytes. |
| CSS | `src/style.css` copied verbatim; imported once in `app/(site)/layout.jsx`. `admin` uses its own inline `<style>` from the original `admin.html` (kept in `content/admin.inline-style.css`). |
| JS modules | Everything under `src/modules/`, `src/lib/`, plus `src/main.js`, `src/dashboard.js`, `src/admin.js` — copied unchanged except for three surgical edits (see below). |
| Entry wiring | Each page has a `*Mount.jsx` client component that `import()`s the corresponding entry JS and dispatches a synthetic `DOMContentLoaded`, so the top-level listeners in `main.js`/`dashboard.js`/`admin.js` fire exactly as they did under Vite. |
| External scripts | Google Fonts, Lucide icons, and Stripe.js load via `next/script` with strategies that match the original page ordering. |
| URL back-compat | `next.config.mjs` rewrites `/index.html`, `/dashboard.html`, `/admin.html`, `/privacy.html`, `/tos.html` to their clean equivalents so old links keep working. |
| Dev API proxy | `next.config.mjs` replicates the old `vite.config.js` proxy: in dev when `NEXT_PUBLIC_API_URL` is empty, `/api/*` forwards to the Flask backend on `:5000`. |

## The three intentional JS touches

All other changes are zero. These three are unavoidable because Vite-specific
syntax doesn't work under Next.js:

1. **`src/lib/api-client.js:15`** — `import.meta.env.VITE_API_URL`
   → `process.env.NEXT_PUBLIC_API_URL`.
2. **`src/main.js:4`** — removed the `import './style.css';` line.
   CSS is now imported via `app/(site)/layout.jsx`.
3. **`src/dashboard.js:4`** — removed the `import './style.css';` line. Same reason.

Everything else (form wizard, Stripe flows, dashboard, admin console,
animations, modals, API client behaviour) is the exact original code.

## Getting started

```bash
cp .env.example .env.local   # leave NEXT_PUBLIC_API_URL empty for local dev
npm install
npm run dev                  # serves on :5173 (same as Vite default)
```

Routes:

- `/` — landing page
- `/dashboard` — customer portal
- `/admin` — admin console (same hostname gate as before)
- `/privacy`, `/tos`

## Production build

```bash
npm run build
npm start
```

Or deploy to Vercel, Netlify, or any Node-capable host. The static assets from
`src/assets/` and `public/` are served identically to the Vite output.
# strapiorbit-portal
