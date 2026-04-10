// test/unit/schema/template-compiler.test.ts
import { describe, expect, it } from "vitest";
import { compileTemplateField } from "../../../src/schema/template-compiler.js";
import type { ArgumentsDef, CognitoUserFields } from "../../../src/schema/types.js";

describe("compileTemplateField", () => {
    const args: ArgumentsDef = {
        recipient: {
            typeName: "String",
            required: true,
            isList: false,
            resolveType: "cognitoUser",
        },
        invitedBy: {
            typeName: "String",
            required: true,
            isList: false,
            resolveType: "cognitoUser",
        },
        projectName: { typeName: "String", required: true, isList: false },
    };

    it("passes through a static string unchanged", () => {
        const result = compileTemplateField("Hello world", args);
        expect(result).toBe("Hello world");
    });

    it("compiles callback with plain string arg", () => {
        const result = compileTemplateField(
            ({ projectName }) => `Welcome to ${projectName as string}`,
            args,
        );
        expect(result).toBe("Welcome to {{projectName}}");
    });

    it("compiles callback with userId arg — nested property access", () => {
        const result = compileTemplateField(
            ({ invitedBy }) => `${(invitedBy as CognitoUserFields).givenName} invited you`,
            args,
        );
        expect(result).toBe("{{invitedByGivenName}} invited you");
    });

    it("compiles callback with userId .email property", () => {
        const result = compileTemplateField(
            ({ invitedBy }) => `Contact: ${(invitedBy as CognitoUserFields).email}`,
            args,
        );
        expect(result).toBe("Contact: {{invitedByEmail}}");
    });

    it("compiles callback with userId .name property", () => {
        const result = compileTemplateField(
            ({ invitedBy }) => `From: ${(invitedBy as CognitoUserFields).name}`,
            args,
        );
        expect(result).toBe("From: {{invitedByName}}");
    });

    it("compiles callback with userId .familyName property", () => {
        const result = compileTemplateField(
            ({ recipient }) => `Dear ${(recipient as CognitoUserFields).familyName}`,
            args,
        );
        expect(result).toBe("Dear {{recipientFamilyName}}");
    });

    it("compiles callback with multiple args", () => {
        const result = compileTemplateField(
            ({ invitedBy, projectName }) =>
                `${(invitedBy as CognitoUserFields).givenName} (${(invitedBy as CognitoUserFields).email}) invited you to ${projectName as string}`,
            args,
        );
        expect(result).toBe(
            "{{invitedByGivenName}} ({{invitedByEmail}}) invited you to {{projectName}}",
        );
    });

    it("compiles callback with multiple userId args", () => {
        const result = compileTemplateField(
            ({ recipient, invitedBy }) =>
                `Hi ${(recipient as CognitoUserFields).givenName}, ${(invitedBy as CognitoUserFields).name} sent you a message`,
            args,
        );
        expect(result).toBe("Hi {{recipientGivenName}}, {{invitedByName}} sent you a message");
    });
});
