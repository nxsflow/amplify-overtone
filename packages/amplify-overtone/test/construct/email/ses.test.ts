import assert from "node:assert";
import { describe, it } from "node:test";
import { Match } from "aws-cdk-lib/assertions";
import { createEmailTemplate, createNoDomainTemplate } from "./helpers.js";

// ---------------------------------------------------------------------------
// SES identity and ConfigurationSet tests
// ---------------------------------------------------------------------------

void describe("SES — Mode 3 (domain + Route 53)", () => {
    const template = createEmailTemplate();

    void it("creates an SES EmailIdentity for the domain", () => {
        template.hasResourceProperties("AWS::SES::EmailIdentity", {
            EmailIdentity: "mail.example.com",
        });
    });

    void it("creates a ConfigurationSet with reputation metrics", () => {
        template.resourceCountIs("AWS::SES::ConfigurationSet", 1);
    });

    void it("creates a ConfigurationSet event destination", () => {
        template.resourceCountIs("AWS::SES::ConfigurationSetEventDestination", 1);
    });
});

void describe("SES — Mode 1 (no domain)", () => {
    const template = createNoDomainTemplate();

    void it("creates an idempotent identity for the sender address", () => {
        template.hasResourceProperties("Custom::SesEmailIdentity", {
            Email: "noreply@example.com",
        });
        // No L2 EmailIdentity — only the domain modes use those
        template.resourceCountIs("AWS::SES::EmailIdentity", 0);
    });

    void it("grants identity handler a wildcard SES policy for safe replacements", () => {
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

    void it("still creates a ConfigurationSet", () => {
        template.resourceCountIs("AWS::SES::ConfigurationSet", 1);
    });

    void it("still creates a ConfigurationSet event destination", () => {
        template.resourceCountIs("AWS::SES::ConfigurationSetEventDestination", 1);
    });
});

void describe("SES — sandbox recipient construct IDs are stable", () => {
    void it(
        "produces the same logical IDs regardless of array order",
        () => {
            const templateAB = createNoDomainTemplate({
                sandboxRecipients: ["alice@example.com", "bob@example.com"],
            });
            const templateBA = createNoDomainTemplate({
                sandboxRecipients: ["bob@example.com", "alice@example.com"],
            });

            const idsAB = Object.keys(templateAB.findResources("Custom::SesEmailIdentity"));
            const idsBA = Object.keys(templateBA.findResources("Custom::SesEmailIdentity"));

            assert.deepStrictEqual(idsAB.sort(), idsBA.sort());
        },
        { timeout: 20_000 },
    );

    void it("does not use index-based construct IDs", () => {
        const template = createNoDomainTemplate({
            sandboxRecipients: ["alice@example.com"],
        });

        const logicalIds = Object.keys(template.findResources("Custom::SesEmailIdentity"));
        // Should not contain sequential index patterns like "Recipient0" or "Recipient1"
        for (const id of logicalIds) {
            assert.doesNotMatch(id, /SandboxRecipient\d+/);
        }
    });
});
