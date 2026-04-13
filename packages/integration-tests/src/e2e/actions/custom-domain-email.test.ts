import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { ListResourceRecordSetsCommand, Route53Client } from "@aws-sdk/client-route-53";
import { GetEmailIdentityCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import type { TestProjectBase } from "../../test-project-setup/test_project_base.js";
import { customDomainEmailTestProjectCreator } from "../../test-projects/custom-domain-email/test_project_creator.js";
import { discoverFunctionName } from "../../utilities/lambda_discovery.js";
import { S3Mailbox } from "../../utilities/s3_mailbox.js";
import { waitForSesVerification } from "../../utilities/ses_identity_waiter.js";
import { loadTestInfraConfig } from "../../utilities/test_infra_config.js";

const senderDomain = process.env.TEST_SENDER_DOMAIN!;
const senderHostedZoneId = process.env.TEST_SENDER_HOSTED_ZONE_ID!;

for (const [name, value] of Object.entries({
    TEST_SENDER_DOMAIN: senderDomain,
    TEST_SENDER_HOSTED_ZONE_ID: senderHostedZoneId,
})) {
    if (!value) {
        throw new Error(`Required env var ${name} is not set`);
    }
}

describe("custom-domain-email integration test", { concurrency: false }, () => {
    let testProject: TestProjectBase;
    let mailbox: S3Mailbox;
    let sendFunctionName: string;
    const e2eProjectDir = "./e2e-tests";
    const ses = new SESv2Client({});
    const route53 = new Route53Client({});
    const lambda = new LambdaClient({});

    before(
        async () => {
            const infra = await loadTestInfraConfig();
            mailbox = new S3Mailbox(infra.receiptS3Bucket);

            testProject = await customDomainEmailTestProjectCreator.createProject(e2eProjectDir);
            await testProject.deploy();
            sendFunctionName = await discoverFunctionName(
                lambda,
                "custom-domain-email-test",
                "SendEmail",
            );
        },
        { timeout: 600_000 },
    );

    after(
        async () => {
            await testProject.tearDown();
        },
        { timeout: 300_000 },
    );

    // -- Infrastructure verification --

    it("DNS records are created (DKIM, SPF, DMARC, MX)", async () => {
        const result = await route53.send(
            new ListResourceRecordSetsCommand({ HostedZoneId: senderHostedZoneId }),
        );

        const records = result.ResourceRecordSets ?? [];

        const dkimRecords = records.filter(
            (r) => r.Type === "CNAME" && r.Name?.includes("_domainkey"),
        );
        assert.ok(dkimRecords.length >= 3, `Expected 3+ DKIM CNAMEs, found ${dkimRecords.length}`);

        const spfRecords = records.filter(
            (r) =>
                r.Type === "TXT" &&
                r.Name?.includes(senderDomain) &&
                r.ResourceRecords?.some((rr) => rr.Value?.includes("v=spf1")),
        );
        assert.ok(spfRecords.length >= 1, "SPF TXT record should exist");

        const dmarcRecords = records.filter(
            (r) =>
                r.Type === "TXT" &&
                r.Name?.includes("_dmarc") &&
                r.ResourceRecords?.some((rr) => rr.Value?.includes("DMARC1")),
        );
        assert.ok(dmarcRecords.length >= 1, "DMARC TXT record should exist");

        const mxRecords = records.filter((r) => r.Type === "MX" && r.Name?.includes(senderDomain));
        assert.ok(mxRecords.length >= 1, "MX record should exist");
    });

    it("SES domain identity is verified", { timeout: 360_000 }, async () => {
        // DKIM verification can take 1-5 minutes after DNS records are created.
        // Poll until verified — subsequent tests depend on this.
        await waitForSesVerification(senderDomain, 300_000);

        const identity = await ses.send(
            new GetEmailIdentityCommand({ EmailIdentity: senderDomain }),
        );
        assert.ok(identity.VerifiedForSendingStatus, "SES identity should be verified for sending");
    });

    // -- Email delivery --

    it("email delivery works end-to-end", { timeout: 120_000 }, async () => {
        // mailbox.clearMailbox removed — 7-day lifecycle handles cleanup
        // await mailbox.clearMailbox("editor/");

        const result = await lambda.send(
            new InvokeCommand({
                FunctionName: sendFunctionName,
                InvocationType: "RequestResponse",
                Payload: new TextEncoder().encode(
                    JSON.stringify({
                        to: "editor@amp-recv.nxsflowmail.com",
                        subject: "You've been invited!",
                        header: "You've been invited!",
                        body: "E2E Test has invited you. Accept your invite at https://example.com/invite/test",
                    }),
                ),
            }),
        );

        assert.strictEqual(result.StatusCode, 200);
        assert.ok(!result.FunctionError, `Lambda error: ${result.FunctionError}`);

        const email = await mailbox.waitForEmail("editor/you-ve-been-invited", 60_000);
        assert.ok(email, "Email should be delivered to S3");
        assert.ok(email.subject?.toLowerCase().includes("invited"), `Subject: ${email.subject}`);
    });

    // -- All 4 templates --

    it("confirmation-code template delivers correctly", { timeout: 120_000 }, async () => {
        // mailbox.clearMailbox removed — 7-day lifecycle handles cleanup
        // await mailbox.clearMailbox("editor/your-confirmation-code");

        await lambda.send(
            new InvokeCommand({
                FunctionName: sendFunctionName,
                InvocationType: "RequestResponse",
                Payload: new TextEncoder().encode(
                    JSON.stringify({
                        to: "editor@amp-recv.nxsflowmail.com",
                        subject: "Your confirmation code",
                        header: "Confirmation Code",
                        body: "Use the code below to verify your identity: 999888",
                    }),
                ),
            }),
        );

        const email = await mailbox.waitForEmail("editor/your-confirmation-code", 60_000);
        assert.ok(email, "Email should arrive");
        assert.ok(email.subject?.includes("Your confirmation code"), `Subject: ${email.subject}`);
    });

    it("password-reset template delivers correctly", { timeout: 120_000 }, async () => {
        // mailbox.clearMailbox removed — 7-day lifecycle handles cleanup
        // await mailbox.clearMailbox("editor/reset-your-password");

        await lambda.send(
            new InvokeCommand({
                FunctionName: sendFunctionName,
                InvocationType: "RequestResponse",
                Payload: new TextEncoder().encode(
                    JSON.stringify({
                        to: "editor@amp-recv.nxsflowmail.com",
                        subject: "Reset your password",
                        header: "Password Reset",
                        body: "Click the link below to reset your password: https://example.com/reset",
                    }),
                ),
            }),
        );

        const email = await mailbox.waitForEmail("editor/reset-your-password", 60_000);
        assert.ok(email, "Email should arrive");
        assert.ok(email.subject?.includes("Reset your password"), `Subject: ${email.subject}`);
    });

    it("getting-started template delivers correctly", { timeout: 120_000 }, async () => {
        // mailbox.clearMailbox removed — 7-day lifecycle handles cleanup
        // await mailbox.clearMailbox("editor/welcome");

        await lambda.send(
            new InvokeCommand({
                FunctionName: sendFunctionName,
                InvocationType: "RequestResponse",
                Payload: new TextEncoder().encode(
                    JSON.stringify({
                        to: "editor@amp-recv.nxsflowmail.com",
                        subject: "Welcome, Tester!",
                        header: "Welcome!",
                        body: "Hi Tester, welcome aboard! Here's how to get started.",
                    }),
                ),
            }),
        );

        const email = await mailbox.waitForEmail("editor/welcome-tester", 60_000);
        assert.ok(email, "Email should arrive");
        assert.ok(email.subject?.toLowerCase().includes("welcome"), `Subject: ${email.subject}`);
    });
});
