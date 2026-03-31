import { describe, it } from "vitest";
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

    it("creates an SES EmailIdentity for the sender address", () => {
        template.hasResourceProperties("AWS::SES::EmailIdentity", {
            EmailIdentity: "noreply@example.com",
        });
        template.resourceCountIs("AWS::SES::EmailIdentity", 1);
    });

    it("still creates a ConfigurationSet", () => {
        template.resourceCountIs("AWS::SES::ConfigurationSet", 1);
    });

    it("still creates a ConfigurationSet event destination", () => {
        template.resourceCountIs("AWS::SES::ConfigurationSetEventDestination", 1);
    });
});
