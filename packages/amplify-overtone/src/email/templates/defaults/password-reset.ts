import type { TemplateDefinition } from "../types.js";

export const passwordResetTemplate: TemplateDefinition = {
    subject: "Reset your password",

    renderHtml(data: Record<string, string>, _brandName: string): string {
        if (!data["resetLink"]) {
            throw new Error('Template "password-reset" requires data.resetLink');
        }

        const expiryHtml = data["expiresInMinutes"]
            ? `<p style="margin:16px 0 0;font-size:14px;color:#888;">This link expires in ${data["expiresInMinutes"]} minutes.</p>`
            : "";

        return `<p style="margin:0 0 16px;font-size:16px;color:#333;">We received a request to reset your password. Click the button below to choose a new one.</p>
<div style="margin:24px 0;">
    <a href="${data["resetLink"]}" style="display:inline-block;padding:12px 24px;background:#e8734a;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Reset Password</a>
</div>
<p style="margin:16px 0 0;font-size:14px;color:#888;">If you did not request a password reset, you can ignore this email.</p>
${expiryHtml}`;
    },

    renderText(data: Record<string, string>, _brandName: string): string {
        if (!data["resetLink"]) {
            throw new Error('Template "password-reset" requires data.resetLink');
        }

        const parts = [`Reset your password: ${data["resetLink"]}`];
        parts.push("If you did not request a password reset, you can ignore this email.");

        if (data["expiresInMinutes"]) {
            parts.push(`This link expires in ${data["expiresInMinutes"]} minutes.`);
        }

        return parts.join("\n");
    },
};
