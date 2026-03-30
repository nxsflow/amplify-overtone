import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { AmplifyEmail } from "../../../src/email/construct.js";
import type { EmailProps } from "../../../src/email/types.js";

// ---------------------------------------------------------------------------
// Default props: Mode 3 (domain + Route 53)
// ---------------------------------------------------------------------------

const defaultProps: EmailProps = {
    domain: "mail.example.com",
    hostedZoneId: "Z1234567890",
    hostedZoneDomain: "example.com",
    senders: {
        noreply: { localPart: "noreply", displayName: "TestApp" },
    },
};

/**
 * Synth a CDK template for Mode 3 (domain + Route 53) with optional overrides.
 */
export function createEmailTemplate(overrides?: Partial<EmailProps>): Template {
    const app = new App();
    const stack = new Stack(app, "TestStack");
    new AmplifyEmail(stack, "Email", {
        ...defaultProps,
        ...overrides,
    } as EmailProps);
    return Template.fromStack(stack);
}

/**
 * Synth a CDK template for Mode 1 (no domain).
 */
export function createNoDomainTemplate(
    overrides?: Partial<EmailProps>,
): Template {
    const app = new App();
    const stack = new Stack(app, "TestStack");
    new AmplifyEmail(stack, "Email", {
        ...overrides,
    } as EmailProps);
    return Template.fromStack(stack);
}

/**
 * Synth a CDK template for Mode 2 (domain only, no Route 53).
 */
export function createDomainOnlyTemplate(
    overrides?: Partial<EmailProps>,
): Template {
    const app = new App();
    const stack = new Stack(app, "TestStack");
    new AmplifyEmail(stack, "Email", {
        domain: "mail.example.com",
        senders: {
            noreply: { localPart: "noreply", displayName: "TestApp" },
        },
        ...overrides,
    } as EmailProps);
    return Template.fromStack(stack);
}
