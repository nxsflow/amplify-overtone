import type { TemplateDefinition } from "../types.js";

export const coreTemplate: TemplateDefinition = {
    subject: "",

    renderHtml(data: Record<string, string>, _brandName: string): string {
        if (!data.header) {
            throw new Error("Core template requires data.header");
        }
        if (!data.body) {
            throw new Error("Core template requires data.body");
        }

        const ctaHtml =
            data.callToActionLabel && data.callToActionHref
                ? `<div style="margin:24px 0;">
    <a href="${data.callToActionHref}" style="display:inline-block;padding:12px 24px;background:#A78BFA;color:#FFFFFF;text-decoration:none;border-radius:6px;font-weight:600;">${data.callToActionLabel}</a>
</div>`
                : "";

        const footerHtml = data.footer
            ? `<p style="margin:16px 0 0;font-size:14px;color:#6B6B6B;">${data.footer}</p>`
            : "";

        return `<p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1C1C1C;">${data.header}</p>
<p style="margin:0 0 16px;font-size:16px;color:#1C1C1C;">${data.body}</p>
${ctaHtml}${footerHtml}`;
    },

    renderText(data: Record<string, string>, _brandName: string): string {
        if (!data.header) {
            throw new Error("Core template requires data.header");
        }
        if (!data.body) {
            throw new Error("Core template requires data.body");
        }

        const parts = [data.header, "", data.body];

        if (data.callToActionLabel && data.callToActionHref) {
            parts.push("", `${data.callToActionLabel}: ${data.callToActionHref}`);
        }

        if (data.footer) {
            parts.push("", data.footer);
        }

        return parts.join("\n");
    },
};
