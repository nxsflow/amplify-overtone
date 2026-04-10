import { describe, expect, it } from "vitest";
import {
    generateEmailInvokeCode,
    generateUserLookupCode,
    hasUserIdArgs,
    type ResolverAction,
} from "../../../src/schema/resolver-generator.js";

const actionWithUserIds: ResolverAction = {
    name: "sendInvite",
    config: { sender: "noreply" },
    compiledTemplate: {
        subject: "{{invitedByName}} invited you to {{projectName}}",
        header: "Invitation",
        body: "{{invitedByName}} invited you to collaborate on {{projectName}}.",
        callToAction: { label: "Accept", href: "https://app.example.com" },
        footer: "Ignore this if unexpected.",
    },
    userIdArgNames: ["recipient", "invitedBy"],
    hasRecipientUserId: true,
};

const actionWithoutUserIds: ResolverAction = {
    name: "sendNotice",
    config: { sender: "noreply" },
    compiledTemplate: {
        subject: "Notice: {{title}}",
        header: "Notice",
        body: "{{message}}",
    },
    userIdArgNames: [],
    hasRecipientUserId: false,
};

describe("hasUserIdArgs", () => {
    it("returns true when action has n.userId() arguments", () => {
        expect(hasUserIdArgs(actionWithUserIds)).toBe(true);
    });

    it("returns false when action has no n.userId() arguments", () => {
        expect(hasUserIdArgs(actionWithoutUserIds)).toBe(false);
    });
});

describe("generateUserLookupCode", () => {
    it("generates request that extracts userId args", () => {
        const code = generateUserLookupCode(actionWithUserIds);
        expect(code).toContain("export function request(ctx)");
        expect(code).toContain("'Invoke'");
        expect(code).toContain("userIdArgs");
        expect(code).toContain("recipient");
        expect(code).toContain("invitedBy");
    });

    it("generates response that stashes resolved users", () => {
        const code = generateUserLookupCode(actionWithUserIds);
        expect(code).toContain("export function response(ctx)");
        expect(code).toContain("ctx.stash");
    });
});

describe("generateEmailInvokeCode", () => {
    it("flattens resolved user fields into args namespace", () => {
        const code = generateEmailInvokeCode(actionWithUserIds);
        expect(code).toContain("invitedByName");
        expect(code).toContain("invitedByEmail");
        expect(code).toContain("invitedByGivenName");
        expect(code).toContain("invitedByFamilyName");
        expect(code).toContain("recipientName");
        expect(code).toContain("recipientEmail");
    });

    it("uses recipientEmail as to address when recipient convention is used", () => {
        const code = generateEmailInvokeCode(actionWithUserIds);
        expect(code).toContain("to:");
        expect(code).toContain("recipientEmail");
    });

    it("uses ctx.args.recipientEmail as to address when no recipient userId", () => {
        const code = generateEmailInvokeCode(actionWithoutUserIds);
        expect(code).toContain("ctx.args.recipientEmail");
    });

    it("interpolates template fields", () => {
        const code = generateEmailInvokeCode(actionWithUserIds);
        expect(code).toContain("subject:");
        expect(code).toContain("header:");
        expect(code).toContain("body:");
    });

    it("includes callToAction when defined", () => {
        const code = generateEmailInvokeCode(actionWithUserIds);
        expect(code).toContain("callToAction:");
        expect(code).toContain("Accept");
    });

    it("includes footer when defined", () => {
        const code = generateEmailInvokeCode(actionWithUserIds);
        expect(code).toContain("footer:");
    });

    it("includes Lambda Invoke operation", () => {
        const code = generateEmailInvokeCode(actionWithUserIds);
        expect(code).toContain("'Invoke'");
    });

    it("embeds sender from config", () => {
        const code = generateEmailInvokeCode(actionWithUserIds);
        expect(code).toContain('"noreply"');
    });
});
