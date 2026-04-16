// test/unit/schema/template-compiler.test.ts
import assert from "node:assert";
import { describe, it } from "node:test";
import { compileTemplateField } from "../../../src/schema/template-compiler.js";
import type { CognitoUserFields } from "../../../src/schema/types.js";

void describe("compileTemplateField", () => {
    const args: Record<string, { resolveType?: "cognitoUser" }> = {
        recipient: { resolveType: "cognitoUser" },
        invitedBy: { resolveType: "cognitoUser" },
        projectName: {},
    };

    void it("passes through a static string unchanged", () => {
        const result = compileTemplateField("Hello world", args);
        assert.strictEqual(result, "Hello world");
    });

    void it("compiles callback with plain string arg", () => {
        const result = compileTemplateField(
            ({ projectName }) => `Welcome to ${projectName as string}`,
            args,
        );
        assert.strictEqual(result, "Welcome to {{projectName}}");
    });

    void it("compiles callback with userId arg — nested property access", () => {
        const result = compileTemplateField(
            ({ invitedBy }) => `${(invitedBy as CognitoUserFields).givenName} invited you`,
            args,
        );
        assert.strictEqual(result, "{{invitedByGivenName}} invited you");
    });

    void it("compiles callback with userId .email property", () => {
        const result = compileTemplateField(
            ({ invitedBy }) => `Contact: ${(invitedBy as CognitoUserFields).email}`,
            args,
        );
        assert.strictEqual(result, "Contact: {{invitedByEmail}}");
    });

    void it("compiles callback with userId .name property", () => {
        const result = compileTemplateField(
            ({ invitedBy }) => `From: ${(invitedBy as CognitoUserFields).name}`,
            args,
        );
        assert.strictEqual(result, "From: {{invitedByName}}");
    });

    void it("compiles callback with userId .familyName property", () => {
        const result = compileTemplateField(
            ({ recipient }) => `Dear ${(recipient as CognitoUserFields).familyName}`,
            args,
        );
        assert.strictEqual(result, "Dear {{recipientFamilyName}}");
    });

    void it("compiles callback with multiple args", () => {
        const result = compileTemplateField(
            ({ invitedBy, projectName }) =>
                `${(invitedBy as CognitoUserFields).givenName} (${(invitedBy as CognitoUserFields).email}) invited you to ${projectName as string}`,
            args,
        );
        assert.strictEqual(
            result,
            "{{invitedByGivenName}} ({{invitedByEmail}}) invited you to {{projectName}}",
        );
    });

    void it("compiles callback with multiple userId args", () => {
        const result = compileTemplateField(
            ({ recipient, invitedBy }) =>
                `Hi ${(recipient as CognitoUserFields).givenName}, ${(invitedBy as CognitoUserFields).name} sent you a message`,
            args,
        );
        assert.strictEqual(
            result,
            "Hi {{recipientGivenName}}, {{invitedByName}} sent you a message",
        );
    });
});
