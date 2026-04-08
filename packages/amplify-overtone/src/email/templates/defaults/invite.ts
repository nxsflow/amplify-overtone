import type { TemplateDefinition } from "../types.js";

export const inviteTemplate: TemplateDefinition = {
    subject: "You've been invited to collaborate",

    renderHtml(data: Record<string, string>, _brandName: string): string {
        if (!data.inviterName) {
            throw new Error('Template "invite" requires data.inviterName');
        }
        if (!data.inviteLink) {
            throw new Error('Template "invite" requires data.inviteLink');
        }

        const resourceText = data.resourceName ? ` on <strong>${data.resourceName}</strong>` : "";

        return `<p style="margin:0 0 16px;font-size:16px;color:#1C1C1C;"><strong>${data.inviterName}</strong> invited you to collaborate${resourceText}.</p>
<p style="margin:0 0 24px;font-size:16px;color:#1C1C1C;">Click the button below to accept the invitation and get started.</p>
<div style="margin:24px 0;">
    <a href="${data.inviteLink}" style="display:inline-block;padding:12px 24px;background:#A78BFA;color:#FFFFFF;text-decoration:none;border-radius:6px;font-weight:600;">Accept Invitation</a>
</div>`;
    },

    renderText(data: Record<string, string>, _brandName: string): string {
        if (!data.inviterName) {
            throw new Error('Template "invite" requires data.inviterName');
        }
        if (!data.inviteLink) {
            throw new Error('Template "invite" requires data.inviteLink');
        }

        const resourceText = data.resourceName ? ` on ${data.resourceName}` : "";

        const parts = [
            `${data.inviterName} invited you to collaborate${resourceText}.`,
            "",
            "Click the link below to accept the invitation and get started.",
            "",
            `Accept Invitation: ${data.inviteLink}`,
        ];

        return parts.join("\n");
    },
};
