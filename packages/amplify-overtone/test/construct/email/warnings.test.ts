import { Annotations, Match } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import type { EmailProps } from "../../../src/email/types.js";
import { createEmailTemplate, createNoDomainStack, createNoDomainTemplate } from "./helpers.js";

// ---------------------------------------------------------------------------
// Warnings and sandbox check tests
// ---------------------------------------------------------------------------

describe("SES sandbox check — AwsCustomResource", () => {
    const template = createEmailTemplate();

    it("creates a Custom::AWS resource for SES GetAccount", () => {
        template.hasResourceProperties("Custom::AWS", {
            Create: Match.stringLikeRegexp("GetAccount"),
        });
    });

    it("creates a SesSandboxWarning CfnOutput", () => {
        const outputs = template.toJSON().Outputs ?? {};
        const sandboxOutputs = Object.keys(outputs).filter((k) => k.includes("SesSandboxWarning"));
        expect(sandboxOutputs.length).toBeGreaterThanOrEqual(1);
    });
});

describe("Sandbox recipients", () => {
    const template = createNoDomainTemplate({
        sandboxRecipients: ["dev@example.com", "qa@example.com"],
    });

    it("creates idempotent identity for each sandbox recipient", () => {
        template.hasResourceProperties("Custom::SesEmailIdentity", {
            Create: Match.stringLikeRegexp("dev@example.com"),
        });
        template.hasResourceProperties("Custom::SesEmailIdentity", {
            Create: Match.stringLikeRegexp("qa@example.com"),
        });
    });

    it("creates sender identity + 2 sandbox recipient identities", () => {
        // 1 sender + 2 sandbox recipients = 3 custom resources, 0 L2 identities
        template.resourceCountIs("Custom::SesEmailIdentity", 3);
        template.resourceCountIs("AWS::SES::EmailIdentity", 0);
    });
});

describe("No domain — Mode 1", () => {
    it("emits a warning about sender verification", () => {
        const stack = createNoDomainStack();
        const annotations = Annotations.fromStack(stack);
        annotations.hasWarning("*", Match.stringLikeRegexp("No custom domain configured"));
    });

    it("creates idempotent identity for each sender address", () => {
        const template = createNoDomainTemplate();
        template.hasResourceProperties("Custom::SesEmailIdentity", {
            Create: Match.stringLikeRegexp("noreply@example.com"),
        });
    });

    it("creates multiple sender identities when multiple senders provided", () => {
        const template = createNoDomainTemplate({
            senders: {
                noreply: { senderEmail: "noreply@example.com", displayName: "App" },
                support: { senderEmail: "support@example.com", displayName: "Support" },
            },
        } as EmailProps);
        template.hasResourceProperties("Custom::SesEmailIdentity", {
            Create: Match.stringLikeRegexp("noreply@example.com"),
        });
        template.hasResourceProperties("Custom::SesEmailIdentity", {
            Create: Match.stringLikeRegexp("support@example.com"),
        });
    });
});

describe("Sandbox recipients — with domain", () => {
    const template = createEmailTemplate({
        sandboxRecipients: ["dev@example.com"],
    });

    it("creates domain identity (L2) + sandbox recipient (idempotent)", () => {
        // Domain identity uses L2 construct (DKIM tokens needed)
        template.resourceCountIs("AWS::SES::EmailIdentity", 1);
        // Sandbox recipient uses idempotent custom resource
        template.resourceCountIs("Custom::SesEmailIdentity", 1);
    });
});
