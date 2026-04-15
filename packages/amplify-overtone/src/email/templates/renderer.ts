import { coreTemplate } from "./defaults/core.js";
import * as S from "./styles.js";

export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function buildBaseHtml(brandName: string, content: string): string {
    const brandHtml = brandName
        ? `<tr><td style="${S.brand}">${escapeHtml(brandName)}</td></tr>`
        : "";

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="${S.body}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${S.wrapperTable}">
<tr><td align="center" style="${S.wrapperCell}">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="${S.card}">
${brandHtml}
<tr><td style="${S.content}">
${content}
</td></tr>
<tr><td style="${S.footerRow}">You received this email because you have an account with ${escapeHtml(brandName || "us")}.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * Renders an email using the core template with pre-resolved fields.
 */
export function renderEmail(
    data: Record<string, string>,
    brandName: string,
): { html: string; text: string } {
    const escapedData: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
        escapedData[key] = escapeHtml(value);
    }

    const contentHtml = coreTemplate.renderHtml(escapedData, brandName);
    const text = coreTemplate.renderText(data, brandName);
    const html = buildBaseHtml(brandName, contentHtml);

    return { html, text };
}
