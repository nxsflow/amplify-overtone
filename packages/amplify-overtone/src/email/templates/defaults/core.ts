import type { TemplateDefinition } from "../types.js";
import * as S from "../styles.js";

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
                ? `<div style="${S.ctaWrap}">
    <a href="${data.callToActionHref}" style="${S.ctaLink}">${data.callToActionLabel}</a>
</div>`
                : "";

        const footerHtml = data.footer
            ? `<p style="${S.footerText}">${data.footer}</p>`
            : "";

        return `<p style="${S.header}">${data.header}</p>
<p style="${S.bodyText}">${data.body}</p>
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
