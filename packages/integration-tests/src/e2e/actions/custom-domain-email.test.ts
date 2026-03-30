import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { ListResourceRecordSetsCommand, Route53Client } from "@aws-sdk/client-route-53";
import { GetEmailIdentityCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import type { TestProjectBase } from "../../test-project-setup/test_project_base.js";
import { customDomainEmailTestProjectCreator } from "../../test-projects/custom-domain-email/test_project_creator.js";
import {
    assertEmailDomainOutput,
    assertEmailOutputsExist,
} from "../../utilities/amplify_outputs_validator.js";
import { S3Mailbox } from "../../utilities/s3_mailbox.js";

const senderDomain = process.env.TEST_SENDER_DOMAIN!;
const senderHostedZoneId = process.env.TEST_SENDER_HOSTED_ZONE_ID!;
const recipientDomain = process.env.TEST_RECIPIENT_DOMAIN!;
const receiptBucket = process.env.TEST_RECEIPT_S3_BUCKET!;

for (const [name, value] of Object.entries({
    TEST_SENDER_DOMAIN: senderDomain,
    TEST_SENDER_HOSTED_ZONE_ID: senderHostedZoneId,
    TEST_RECIPIENT_DOMAIN: recipientDomain,
    TEST_RECEIPT_S3_BUCKET: receiptBucket,
})) {
    if (!value) {
        throw new Error(`Required env var ${name} is not set`);
    }
}

describe("custom-domain-email integration test", { concurrency: false }, () => {
    let testProject: TestProjectBase;
    const e2eProjectDir = "./e2e-tests";
    const ses = new SESv2Client({});
    const route53 = new Route53Client({});
    const lambda = new LambdaClient({});
    const mailbox = new S3Mailbox(receiptBucket);

    before(
        async () => {
            testProject = await customDomainEmailTestProjectCreator.createProject(e2eProjectDir);
            await testProject.deploy();
        },
        { timeout: 600_000 },
    );

    after(
        async () => {
            await testProject.tearDown();
        },
        { timeout: 300_000 },
    );

    it("amplify_outputs.json contains full email config", async () => {
        await testProject.assertPostDeployment();
        const outputs = await testProject.getAmplifyOutputs();
        assertEmailOutputsExist(outputs);
        assertEmailDomainOutput(outputs, senderDomain);
    });

    it("DNS records are created", async () => {
        const result = await route53.send(
            new ListResourceRecordSetsCommand({
                HostedZoneId: senderHostedZoneId,
            }),
        );

        const records = result.ResourceRecordSets ?? [];

        const dkimRecords = records.filter(
            (r) => r.Type === "CNAME" && r.Name?.includes("_domainkey"),
        );
        assert.ok(dkimRecords.length >= 3, `Expected 3 DKIM CNAMEs, found ${dkimRecords.length}`);

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

    it("SES identity is verified", async () => {
        const identity = await ses.send(
            new GetEmailIdentityCommand({ EmailIdentity: senderDomain }),
        );

        assert.ok(identity.VerifiedForSendingStatus, "SES identity should be verified for sending");
    });

    it("email delivery works end-to-end", { timeout: 120_000 }, async () => {
        const testRecipient = `test@${recipientDomain}`;

        await mailbox.clearMailbox();

        const outputs = await testProject.getAmplifyOutputs();
        const emailOutputs = assertEmailOutputsExist(outputs);

        await lambda.send(
            new InvokeCommand({
                FunctionName: emailOutputs.sendFunctionName,
                InvocationType: "RequestResponse",
                Payload: new TextEncoder().encode(
                    JSON.stringify({
                        template: "invite",
                        to: testRecipient,
                        data: {
                            inviterName: "E2E Test",
                            inviteLink: "https://example.com/invite/test",
                        },
                    }),
                ),
            }),
        );

        const email = await mailbox.waitForEmail("", 60_000);

        assert.ok(email, "Email should be delivered to S3");
    });
});
