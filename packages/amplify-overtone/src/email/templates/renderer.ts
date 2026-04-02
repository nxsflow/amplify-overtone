import type { EmailTemplateName } from "../types.js";
import { confirmationCodeTemplate } from "./defaults/confirmation-code.js";
import { gettingStartedTemplate } from "./defaults/getting-started.js";
import { inviteTemplate } from "./defaults/invite.js";
import { passwordResetTemplate } from "./defaults/password-reset.js";
import type { TemplateDefinition } from "./types.js";

/**
 * Escapes special HTML characters to prevent XSS injection.
 * Escapes in order: & first to avoid double-escaping.
 */
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

const templateRegistry: Record<EmailTemplateName, TemplateDefinition> = {
    "confirmation-code": confirmationCodeTemplate,
    "password-reset": passwordResetTemplate,
    invite: inviteTemplate,
    "getting-started": gettingStartedTemplate,
};

function buildBaseHtml(brandName: string, content: string): string {
    const brandHtml = brandName
        ? `<tr><td style="padding:24px 32px 0;color:#888;font-size:13px;">${escapeHtml(brandName)}</td></tr>`
        : "";

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;">
${brandHtml}
<tr><td style="padding:24px 32px;">
${content}
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #eee;font-size:13px;color:#888;">You received this email because you have an account with ${escapeHtml(brandName || "us")}.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * Renders a built-in email template by key.
 *
 * @param templateKey - One of: "confirmation-code", "password-reset", "invite", "getting-started"
 * @param data - Template data values (will be HTML-escaped before substitution)
 * @param brandName - Brand name shown in the email header
 * @returns Object with subject, html, and text fields
 * @throws If the template key is unknown or required data fields are missing
 */
export function renderTemplate(
    templateKey: EmailTemplateName,
    data: Record<string, string>,
    brandName: string,
): { subject: string; html: string; text: string } {
    const template = templateRegistry[templateKey];

    // HTML-escape all data values before passing to templates
    const escapedData: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
        escapedData[key] = escapeHtml(value);
    }

    const contentHtml = template.renderHtml(escapedData, brandName);
    const text = template.renderText(data, brandName);
    const html = buildBaseHtml(brandName, contentHtml);

    return {
        subject: template.subject,
        html,
        text,
    };
}
