import { describe, expect, it } from "vitest";
import { generateResolverCode } from "../../../src/schema/resolver-generator.js";
import type { CompiledEmailAction } from "../../../src/schema/types.js";

const sampleAction: CompiledEmailAction = {
    name: "inviteEmail",
    config: { sender: "noreply", template: "invite" },
    subjectTemplate: "{{inviter}} has invited you",
    arguments: {
        recipientEmail: { typeName: "AWSEmail", required: true, isList: false },
        inviter: { typeName: "String", required: true, isList: false },
    },
    returnType: {
        messageId: { typeName: "String", required: true, isList: false },
    },
    authRules: [],
};

describe("generateResolverCode", () => {
    it("generates valid JS with request and response exports", () => {
        const code = generateResolverCode(sampleAction);
        expect(code).toContain("export function request(ctx)");
        expect(code).toContain("export function response(ctx)");
    });

    it("includes Lambda Invoke operation", () => {
        const code = generateResolverCode(sampleAction);
        expect(code).toContain("'Invoke'");
    });

    it("embeds sender and template from config", () => {
        const code = generateResolverCode(sampleAction);
        expect(code).toContain('"noreply"');
        expect(code).toContain('"invite"');
    });

    it("uses recipientEmail as the to field", () => {
        const code = generateResolverCode(sampleAction);
        expect(code).toContain("ctx.args.recipientEmail");
    });

    it("interpolates subject template variables from args", () => {
        const code = generateResolverCode(sampleAction);
        expect(code).toContain("{{inviter}}");
    });

    it("passes all arguments as template data", () => {
        const code = generateResolverCode(sampleAction);
        expect(code).toContain("ctx.args");
    });

    it("injects built-in variables", () => {
        const code = generateResolverCode(sampleAction);
        expect(code).toContain("__callerUserId");
        expect(code).toContain("ctx.identity");
    });
});
