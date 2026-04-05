import type { TemplateDefinition } from "../types.js";

export const gettingStartedTemplate: TemplateDefinition = {
    subject: "Welcome — get started",

    renderHtml(data: Record<string, string>, brandName: string): string {
        const greeting = data.userName
            ? `<p style="margin:0 0 8px;font-size:18px;color:#1C1C1C;font-weight:600;">Hi ${data.userName},</p>`
            : "";

        const brand = brandName || "the app";

        const ctaHtml = data.dashboardLink
            ? `<div style="margin:24px 0;">
    <a href="${data.dashboardLink}" style="display:inline-block;padding:12px 24px;background:#A78BFA;color:#FFFFFF;text-decoration:none;border-radius:6px;font-weight:600;">Go to Dashboard</a>
</div>`
            : "";

        return `${greeting}
<p style="margin:0 0 16px;font-size:16px;color:#1C1C1C;">Welcome to ${brand}! We're excited to have you on board.</p>
<p style="margin:0 0 16px;font-size:16px;color:#1C1C1C;">You're all set and ready to get started. Explore the features and let us know if you have any questions.</p>
${ctaHtml}`;
    },

    renderText(data: Record<string, string>, brandName: string): string {
        const brand = brandName || "the app";
        const parts: string[] = [];

        if (data.userName) {
            parts.push(`Hi ${data.userName},`);
            parts.push("");
        }

        parts.push(`Welcome to ${brand}! We're excited to have you on board.`);
        parts.push(
            "You're all set and ready to get started. Explore the features and let us know if you have any questions.",
        );

        if (data.dashboardLink) {
            parts.push("");
            parts.push(`Go to Dashboard: ${data.dashboardLink}`);
        }

        return parts.join("\n");
    },
};
