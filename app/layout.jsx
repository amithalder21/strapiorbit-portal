// ════════════════════════════════════════════
// app/layout.jsx — Root layout
//
// Provides the <html>/<body> shell only. Per-route styling lives in
// nested layouts:
//   - app/(site)/layout.jsx → imports style.css (for landing, dashboard, privacy, tos)
//   - app/admin/layout.jsx  → uses the inline <style> from the original admin.html
//
// data-theme="noir" matches the original Vite index.html / dashboard.html.
// The admin route overrides this via its own <html>-level attributes in the
// admin page render — we keep "noir" as the default since admin's inline CSS
// defines both [data-theme="noir"] and [data-theme="classic"] identically.
// ════════════════════════════════════════════

export const metadata = {
  title: 'Strapi Orbit — Managed Strapi Hosting',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="noir">
      <body>{children}</body>
    </html>
  );
}
