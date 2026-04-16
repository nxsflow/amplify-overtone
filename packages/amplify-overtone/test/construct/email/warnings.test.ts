import assert from "node:assert";
import { describe, it } from "node:test";
import { Annotations, Match } from "aws-cdk-lib/assertions";
import type { EmailProps } from "../../../src/email/types.js";
import { createEmailTemplate, createNoDomainStack, createNoDomainTemplate } from "./helpers.js";

// ---------------------------------------------------------------------------
// Warnings and sandbox check tests
// ---------------------------------------------------------------------------

void describe("SES sandbox check — AwsCustomResource", () => {
    const template = createEmailTemplate();

    void it("creates a Custom::AWS resource for SES GetAccount", () => {
        template.hasResourceProperties("Custom::AWS", {
            Create: Match.stringLikeRegexp("GetAccount"),
        });
    });

    void it("creates a SesSandboxWarning CfnOutput", () => {
        const outputs = template.toJSON().Outputs ?? {};
        const sandboxOutputs = Object.keys(outputs).filter((k) => k.includes("SesSandboxWarning"));
        assert.ok(sandboxOutputs.length >= 1);
    });
});

void describe("Sandbox recipients", () => {
    const template = createNoDomainTemplate({
        sandboxRecipients: ["dev@example.com", "qa@example.com"],
    });

    void it("creates idempotent identity for each sandbox recipient", () => {
        template.hasResourceProperties("Custom::SesEmailIdentity", {
            Email: "dev@example.com",
        });
        template.hasResourceProperties("Custom::SesEmailIdentity", {
            Email: "qa@example.com",
        });
    });

    void it("creates sender identity + 2 sandbox recipient identities", () => {
        // 1 sender + 2 sandbox recipients = 3 custom resources, 0 L2 identities
        template.resourceCountIs("Custom::SesEmailIdentity", 3);
        template.resourceCountIs("AWS::SES::EmailIdentity", 0);
    });
});

void describe("No domain — Mode 1", () => {
    void it("emits a warning about sender verification", () => {
        const stack = createNoDomainStack();
        const annotations = Annotations.fromStack(stack);
        annotations.hasWarning("*", Match.stringLikeRegexp("No custom domain configured"));
    });

    void it("creates idempotent identity for each sender address", () => {
        const template = createNoDomainTemplate();
        template.hasResourceProperties("Custom::SesEmailIdentity", {
            Email: "noreply@example.com",
        });
    });

    void it("creates multiple sender identities when multiple senders provided", () => {
        const template = createNoDomainTemplate({
            senders: {
                noreply: { senderEmail: "noreply@example.com", displayName: "App" },
                support: { senderEmail: "support@example.com", displayName: "Support" },
            },
        } as EmailProps);
        template.hasResourceProperties("Custom::SesEmailIdentity", {
            Email: "noreply@example.com",
        });
        template.hasResourceProperties("Custom::SesEmailIdentity", {
            Email: "support@example.com",
        });
    });
});

void describe("Sandbox recipients — with domain", () => {
    const template = createEmailTemplate({
        sandboxRecipients: ["dev@example.com"],
    });

    void it("creates domain identity (L2) + sandbox recipient (idempotent)", () => {
        // Domain identity uses L2 construct (DKIM tokens needed)
        template.resourceCountIs("AWS::SES::EmailIdentity", 1);
        // Sandbox recipient uses idempotent custom resource
        template.resourceCountIs("Custom::SesEmailIdentity", 1);
    });
});
