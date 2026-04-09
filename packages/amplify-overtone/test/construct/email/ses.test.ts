import { Match } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { createEmailTemplate, createNoDomainTemplate } from "./helpers.js";

// ---------------------------------------------------------------------------
// SES identity and ConfigurationSet tests
// ---------------------------------------------------------------------------

describe("SES — Mode 3 (domain + Route 53)", () => {
    const template = createEmailTemplate();

    it("creates an SES EmailIdentity for the domain", () => {
        template.hasResourceProperties("AWS::SES::EmailIdentity", {
            EmailIdentity: "mail.example.com",
        });
    });

    it("creates a ConfigurationSet with reputation metrics", () => {
        template.resourceCountIs("AWS::SES::ConfigurationSet", 1);
    });

    it("creates a ConfigurationSet event destination", () => {
        template.resourceCountIs("AWS::SES::ConfigurationSetEventDestination", 1);
    });
});

describe("SES — Mode 1 (no domain)", () => {
    const template = createNoDomainTemplate();

    it("creates an idempotent identity for the sender address", () => {
        template.hasResourceProperties("Custom::SesEmailIdentity", {
            Email: "noreply@example.com",
        });
        // No L2 EmailIdentity — only the domain modes use those
        template.resourceCountIs("AWS::SES::EmailIdentity", 0);
    });

    it("grants identity handler a wildcard SES policy for safe replacements", () => {
        template.hasResourceProperties("AWS::IAM::Policy", {
            PolicyDocument: {
                Statement: Match.arrayWith([
                    Match.objectLike({
                        Action: ["ses:CreateEmailIdentity", "ses:DeleteEmailIdentity"],
                        Resource: {
                            "Fn::Join": ["", Match.arrayWith([":identity/*"])],
                        },
                    }),
                ]),
            },
        });
    });

    it("still creates a ConfigurationSet", () => {
        template.resourceCountIs("AWS::SES::ConfigurationSet", 1);
    });

    it("still creates a ConfigurationSet event destination", () => {
        template.resourceCountIs("AWS::SES::ConfigurationSetEventDestination", 1);
    });
});

describe("SES — sandbox recipient construct IDs are stable", () => {
    it("produces the same logical IDs regardless of array order", () => {
        const templateAB = createNoDomainTemplate({
            sandboxRecipients: ["alice@example.com", "bob@example.com"],
        });
        const templateBA = createNoDomainTemplate({
            sandboxRecipients: ["bob@example.com", "alice@example.com"],
        });

        const idsAB = Object.keys(templateAB.findResources("Custom::SesEmailIdentity"));
        const idsBA = Object.keys(templateBA.findResources("Custom::SesEmailIdentity"));

        expect(idsAB.sort()).toEqual(idsBA.sort());
    });

    it("does not use index-based construct IDs", () => {
        const template = createNoDomainTemplate({
            sandboxRecipients: ["alice@example.com"],
        });

        const logicalIds = Object.keys(template.findResources("Custom::SesEmailIdentity"));
        // Should not contain sequential index patterns like "Recipient0" or "Recipient1"
        for (const id of logicalIds) {
            expect(id).not.toMatch(/SandboxRecipient\d+/);
        }
    });
});
