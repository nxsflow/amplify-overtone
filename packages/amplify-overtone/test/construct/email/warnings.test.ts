import { Match } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import {
    createEmailTemplate,
    createNoDomainTemplate,
} from "./helpers.js";

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
        const sandboxOutputs = Object.keys(outputs).filter((k) =>
            k.includes("SesSandboxWarning"),
        );
        expect(sandboxOutputs.length).toBeGreaterThanOrEqual(1);
    });
});

describe("Sandbox recipients", () => {
    const template = createNoDomainTemplate({
        sandboxRecipients: ["dev@example.com", "qa@example.com"],
    });

    it("creates EmailIdentity for each sandbox recipient", () => {
        template.hasResourceProperties("AWS::SES::EmailIdentity", {
            EmailIdentity: "dev@example.com",
        });
        template.hasResourceProperties("AWS::SES::EmailIdentity", {
            EmailIdentity: "qa@example.com",
        });
    });

    it("creates exactly 2 sandbox recipient identities", () => {
        template.resourceCountIs("AWS::SES::EmailIdentity", 2);
    });
});

describe("Sandbox recipients — with domain", () => {
    const template = createEmailTemplate({
        sandboxRecipients: ["dev@example.com"],
    });

    it("creates domain identity + sandbox recipient identity", () => {
        // 1 domain + 1 sandbox recipient = 2
        template.resourceCountIs("AWS::SES::EmailIdentity", 2);
    });
});
