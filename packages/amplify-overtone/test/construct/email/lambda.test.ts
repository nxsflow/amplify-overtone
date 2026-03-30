import { Match } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import {
    createEmailTemplate,
    createNoDomainTemplate,
} from "./helpers.js";

// ---------------------------------------------------------------------------
// Lambda function tests
// ---------------------------------------------------------------------------

describe("Lambda — Mode 3 (domain + Route 53)", () => {
    const template = createEmailTemplate();

    it("creates a Lambda with Node 22 runtime", () => {
        template.hasResourceProperties("AWS::Lambda::Function", {
            Runtime: "nodejs22.x",
        });
    });

    it("sets SENDERS_CONFIG env var with JSON", () => {
        template.hasResourceProperties("AWS::Lambda::Function", {
            Environment: {
                Variables: Match.objectLike({
                    SENDERS_CONFIG: JSON.stringify({
                        noreply: {
                            localPart: "noreply",
                            displayName: "TestApp",
                        },
                    }),
                }),
            },
        });
    });

    it("sets DEFAULT_SENDER env var", () => {
        template.hasResourceProperties("AWS::Lambda::Function", {
            Environment: {
                Variables: Match.objectLike({
                    DEFAULT_SENDER: "noreply",
                }),
            },
        });
    });

    it("sets EMAIL_DOMAIN env var when domain is configured", () => {
        template.hasResourceProperties("AWS::Lambda::Function", {
            Environment: {
                Variables: Match.objectLike({
                    EMAIL_DOMAIN: "mail.example.com",
                }),
            },
        });
    });

    it("uses default 15s timeout", () => {
        template.hasResourceProperties("AWS::Lambda::Function", {
            Timeout: 15,
        });
    });
});

describe("Lambda — Mode 1 (no domain)", () => {
    const template = createNoDomainTemplate();

    it("does NOT set EMAIL_DOMAIN env var", () => {
        template.hasResourceProperties("AWS::Lambda::Function", {
            Environment: {
                Variables: Match.not(
                    Match.objectLike({ EMAIL_DOMAIN: Match.anyValue() }),
                ),
            },
        });
    });

    it("sets SENDERS_CONFIG with default sender", () => {
        template.hasResourceProperties("AWS::Lambda::Function", {
            Environment: {
                Variables: Match.objectLike({
                    SENDERS_CONFIG: JSON.stringify({
                        noreply: { localPart: "noreply", displayName: "" },
                    }),
                }),
            },
        });
    });
});

describe("Lambda — custom timeout", () => {
    const template = createEmailTemplate({ timeoutSeconds: 30 });

    it("uses the provided timeout", () => {
        template.hasResourceProperties("AWS::Lambda::Function", {
            Timeout: 30,
        });
    });
});
