/**
 * Design tokens and pre-composed style strings for email templates.
 *
 * Inline styles are required for broad email-client compatibility.
 * Centralising them here keeps the HTML templates readable while
 * still producing fully-inlined output.
 */

// ── Design tokens ──────────────────────────────────────────────

const color = {
    text: "#1C1C1C",
    secondary: "#6B6B6B",
    cta: "#A78BFA",
    ctaText: "#FFFFFF",
    bg: "#FFFFFF",
    border: "#E5E5E0",
} as const;

const font = "'Merriweather Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";

// ── Composed style strings ─────────────────────────────────────

/** Outer `<body>` element. */
export const body = `margin:0;padding:0;background:${color.bg};font-family:${font};`;

/** Full-width wrapper table. */
export const wrapperTable = `background:${color.bg};`;

/** Centring cell around the content card. */
export const wrapperCell = "padding:32px 16px;";

/** The content card (600 px table). */
export const card = `background:${color.bg};border:1px solid ${color.border};border-radius:8px;overflow:hidden;`;

/** Brand name row at the top of the card. */
export const brand = `padding:24px 32px 0;color:${color.secondary};font-size:13px;`;

/** Main content cell. */
export const content = "padding:24px 32px;";

/** Footer row with the "you received this because…" note. */
export const footerRow = `padding:16px 32px;border-top:1px solid ${color.border};font-size:13px;color:${color.secondary};`;

/** Email header / title. */
export const header = `margin:0 0 8px;font-size:20px;font-weight:700;color:${color.text};`;

/** Body paragraph. */
export const bodyText = `margin:0 0 16px;font-size:16px;color:${color.text};`;

/** CTA button wrapper `<div>`. */
export const ctaWrap = "margin:24px 0;";

/** CTA `<a>` element. */
export const ctaLink = `display:inline-block;padding:12px 24px;background:${color.cta};color:${color.ctaText};text-decoration:none;border-radius:6px;font-weight:600;`;

/** Optional footer paragraph inside the content area. */
export const footerText = `margin:16px 0 0;font-size:14px;color:${color.secondary};`;
