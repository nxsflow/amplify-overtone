import { coreTemplate } from "./defaults/core.js";

export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function buildBaseHtml(brandName: string, content: string): string {
    const brandHtml = brandName
        ? `<tr><td style="padding:24px 32px 0;color:#6B6B6B;font-size:13px;">${escapeHtml(brandName)}</td></tr>`
        : "";

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#FFFFFF;font-family:'Merriweather Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E5E5E0;border-radius:8px;overflow:hidden;">
${brandHtml}
<tr><td style="padding:24px 32px;">
${content}
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #E5E5E0;font-size:13px;color:#6B6B6B;">You received this email because you have an account with ${escapeHtml(brandName || "us")}.</td></tr>
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
