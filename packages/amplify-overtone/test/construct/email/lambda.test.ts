import { describe, it } from "node:test";
import { Match } from "aws-cdk-lib/assertions";
import { createEmailTemplate, createNoDomainTemplate } from "./helpers.js";

// ---------------------------------------------------------------------------
// Lambda function tests
// ---------------------------------------------------------------------------

void describe("Lambda — Mode 3 (domain + Route 53)", () => {
    const template = createEmailTemplate();

    void it("creates a Lambda with Node 22 runtime", () => {
        template.hasResourceProperties("AWS::Lambda::Function", {
            Runtime: "nodejs22.x",
        });
    });

    void it("sets SENDERS_CONFIG env var with normalized sender", () => {
        template.hasResourceProperties("AWS::Lambda::Function", {
            Environment: {
                Variables: Match.objectLike({
                    SENDERS_CONFIG: JSON.stringify({
                        noreply: {
                            email: "noreply@mail.example.com",
                            displayName: "TestApp",
                        },
                    }),
                }),
            },
        });
    });

    void it("sets DEFAULT_SENDER env var", () => {
        template.hasResourceProperties("AWS::Lambda::Function", {
            Environment: {
                Variables: Match.objectLike({
                    DEFAULT_SENDER: "noreply",
                }),
            },
        });
    });

    void it("sets EMAIL_DOMAIN env var when domain is configured", () => {
        template.hasResourceProperties("AWS::Lambda::Function", {
            Environment: {
                Variables: Match.objectLike({
                    EMAIL_DOMAIN: "mail.example.com",
                }),
            },
        });
    });

    void it("uses default 15s timeout", () => {
        template.hasResourceProperties("AWS::Lambda::Function", {
            Timeout: 15,
        });
    });
});

void describe("Lambda — Mode 1 (no domain)", () => {
    const template = createNoDomainTemplate();

    void it("does NOT set EMAIL_DOMAIN env var", () => {
        template.hasResourceProperties("AWS::Lambda::Function", {
            Environment: {
                Variables: Match.not(Match.objectLike({ EMAIL_DOMAIN: Match.anyValue() })),
            },
        });
    });

    void it("sets SENDERS_CONFIG with normalized sender email", () => {
        template.hasResourceProperties("AWS::Lambda::Function", {
            Environment: {
                Variables: Match.objectLike({
                    SENDERS_CONFIG: JSON.stringify({
                        noreply: {
                            email: "noreply@example.com",
                            displayName: "TestApp",
                        },
                    }),
                }),
            },
        });
    });
});

void describe("Lambda — custom timeout", () => {
    const template = createEmailTemplate({ timeoutSeconds: 30 });

    void it("uses the provided timeout", () => {
        template.hasResourceProperties("AWS::Lambda::Function", {
            Timeout: 30,
        });
    });
});
