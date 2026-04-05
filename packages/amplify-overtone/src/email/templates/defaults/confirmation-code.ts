import type { TemplateDefinition } from "../types.js";

export const confirmationCodeTemplate: TemplateDefinition = {
    subject: "Your confirmation code",

    renderHtml(data: Record<string, string>, _brandName: string): string {
        if (!data.code) {
            throw new Error('Template "confirmation-code" requires data.code');
        }

        const expiryHtml = data.expiresInMinutes
            ? `<p style="margin:8px 0 0;font-size:14px;color:#6B6B6B;">This code expires in ${data.expiresInMinutes} minutes.</p>`
            : "";

        return `<p style="margin:0 0 16px;font-size:16px;color:#1C1C1C;">Use the confirmation code below to verify your identity.</p>
<div style="text-align:center;margin:24px 0;">
    <span style="display:inline-block;padding:16px 32px;background:#FFFFFF;border:1px solid #E5E5E0;border-radius:8px;font-size:36px;font-family:monospace,monospace;font-weight:700;letter-spacing:8px;color:#1C1C1C;">${data.code}</span>
    ${expiryHtml}
</div>`;
    },

    renderText(data: Record<string, string>, _brandName: string): string {
        if (!data.code) {
            throw new Error('Template "confirmation-code" requires data.code');
        }

        const parts = [
            "Use the confirmation code below to verify your identity.",
            "",
            `Your confirmation code is: ${data.code}`,
        ];

        if (data.expiresInMinutes) {
            parts.push(`This code expires in ${data.expiresInMinutes} minutes.`);
        }

        return parts.join("\n");
    },
};
