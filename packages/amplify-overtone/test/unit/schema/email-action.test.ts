import { describe, expect, it } from "vitest";
import { emailAction } from "../../../src/schema/email-action.js";
import type { CognitoUserFields } from "../../../src/schema/types.js";

describe("emailAction", () => {
    it("compiles callback template fields into {{variable}} strings", () => {
        const action = emailAction({ sender: "noreply" })
            .arguments({
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
            })
            .template({
                subject: ({ invitedBy, projectName }) =>
                    `${(invitedBy as CognitoUserFields).givenName} invited you to ${projectName as string}`,
                header: "You've been invited!",
                body: ({ invitedBy, projectName }) =>
                    `${(invitedBy as CognitoUserFields).givenName} (${(invitedBy as CognitoUserFields).email}) invited you to ${projectName as string}.`,
            })
            .authorization((allow) => [allow.authenticated()]);

        const compiled = action._compile("sendInvite");
        expect(compiled.name).toBe("sendInvite");
        expect(compiled.config.sender).toBe("noreply");
        expect(compiled.compiledTemplate?.subject).toBe(
            "{{invitedByGivenName}} invited you to {{projectName}}",
        );
        expect(compiled.compiledTemplate?.header).toBe("You've been invited!");
        expect(compiled.compiledTemplate?.body).toBe(
            "{{invitedByGivenName}} ({{invitedByEmail}}) invited you to {{projectName}}.",
        );
        expect(compiled.authRules).toHaveLength(1);
    });

    it("compiles callToAction and footer", () => {
        const action = emailAction({ sender: "noreply" })
            .arguments({
                recipient: {
                    typeName: "String",
                    required: true,
                    isList: false,
                    resolveType: "cognitoUser",
                },
                link: { typeName: "AWSURL", required: true, isList: false },
            })
            .template({
                subject: "Welcome",
                header: "Welcome!",
                body: "You are all set.",
                callToAction: { label: "Get Started", href: ({ link }) => link as string },
                footer: "You can unsubscribe at any time.",
            });

        const compiled = action._compile("welcome");
        expect(compiled.compiledTemplate?.callToAction).toEqual({
            label: "Get Started",
            href: "{{link}}",
        });
        expect(compiled.compiledTemplate?.footer).toBe("You can unsubscribe at any time.");
    });

    it("compiles static strings without callbacks", () => {
        const action = emailAction({ sender: "noreply" })
            .arguments({
                recipient: {
                    typeName: "String",
                    required: true,
                    isList: false,
                    resolveType: "cognitoUser",
                },
            })
            .template({ subject: "Static subject", header: "Static header", body: "Static body." });

        const compiled = action._compile("staticTest");
        expect(compiled.compiledTemplate?.subject).toBe("Static subject");
        expect(compiled.compiledTemplate?.header).toBe("Static header");
        expect(compiled.compiledTemplate?.body).toBe("Static body.");
    });

    it("is immutable — .template() returns new builder", () => {
        const base = emailAction({ sender: "noreply" });
        const withTemplate = base.template({ subject: "Test", header: "Test", body: "Test body." });
        expect(base._compile("a").compiledTemplate).toBeUndefined();
        expect(withTemplate._compile("b").compiledTemplate).toBeDefined();
    });

    it("defaults sender to undefined when not specified", () => {
        const action = emailAction({}).template({
            subject: "Test",
            header: "Test",
            body: "Test body.",
        });
        const compiled = action._compile("test");
        expect(compiled.config.sender).toBeUndefined();
    });
});
