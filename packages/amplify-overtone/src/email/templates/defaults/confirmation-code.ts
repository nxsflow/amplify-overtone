import type { TemplateDefinition } from "../types.js";

export const confirmationCodeTemplate: TemplateDefinition = {
    subject: "Your confirmation code",

    renderHtml(data: Record<string, string>, _brandName: string): string {
        if (!data["code"]) {
            throw new Error(
                'Template "confirmation-code" requires data.code',
            );
        }

        const expiryHtml = data["expiresInMinutes"]
            ? `<p style="margin:8px 0 0;font-size:14px;color:#888;">This code expires in ${data["expiresInMinutes"]} minutes.</p>`
            : "";

        return `<p style="margin:0 0 16px;font-size:16px;color:#333;">Use the confirmation code below to verify your identity.</p>
<div style="text-align:center;margin:24px 0;">
    <span style="display:inline-block;padding:16px 32px;background:#f4f4f7;border-radius:8px;font-size:36px;font-family:monospace,monospace;font-weight:700;letter-spacing:8px;color:#1a1a2e;">${data["code"]}</span>
    ${expiryHtml}
</div>`;
    },

    renderText(data: Record<string, string>, _brandName: string): string {
        if (!data["code"]) {
            throw new Error(
                'Template "confirmation-code" requires data.code',
            );
        }

        const parts = [`Your confirmation code is: ${data["code"]}`];

        if (data["expiresInMinutes"]) {
            parts.push(`This code expires in ${data["expiresInMinutes"]} minutes.`);
        }

        return parts.join("\n");
    },
};
