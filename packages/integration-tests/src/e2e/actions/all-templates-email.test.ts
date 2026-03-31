import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import type { TestProjectBase } from "../../test-project-setup/test_project_base.js";
import { customDomainEmailTestProjectCreator } from "../../test-projects/custom-domain-email/test_project_creator.js";
import { assertEmailOutputsExist } from "../../utilities/amplify_outputs_validator.js";
import { S3Mailbox } from "../../utilities/s3_mailbox.js";
import { loadTestInfraConfig } from "../../utilities/test_infra_config.js";

// Sender domain env vars are still needed for the Amplify deploy
for (const name of [
    "TEST_SENDER_DOMAIN",
    "TEST_SENDER_HOSTED_ZONE_ID",
    "TEST_SENDER_HOSTED_ZONE_DOMAIN",
]) {
    if (!process.env[name]) {
        throw new Error(`Required env var ${name} is not set`);
    }
}

describe("all-templates-email integration test", { concurrency: false }, () => {
    let testProject: TestProjectBase;
    let recipientDomain: string;
    let mailbox: S3Mailbox;
    const e2eProjectDir = "./e2e-tests";
    const lambda = new LambdaClient({});

    before(
        async () => {
            const infra = await loadTestInfraConfig();
            recipientDomain = infra.recipientDomain;
            mailbox = new S3Mailbox(infra.receiptS3Bucket);

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

    it("confirmation-code template delivers email with correct subject", {
        timeout: 120_000,
    }, async () => {
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
                        template: "confirmation-code",
                        to: testRecipient,
                        data: { code: "999888" },
                    }),
                ),
            }),
        );

        const email = await mailbox.waitForEmail("", 60_000);

        assert.ok(email, "Email should be delivered to S3");
        assert.ok(
            email.subject?.includes("Your confirmation code"),
            `Email subject should contain 'Your confirmation code', got '${email.subject}'`,
        );
    });

    it("password-reset template delivers email with correct subject", {
        timeout: 120_000,
    }, async () => {
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
                        template: "password-reset",
                        to: testRecipient,
                        data: { resetLink: "https://example.com/reset" },
                    }),
                ),
            }),
        );

        const email = await mailbox.waitForEmail("", 60_000);

        assert.ok(email, "Email should be delivered to S3");
        assert.ok(
            email.subject?.includes("Reset your password"),
            `Email subject should contain 'Reset your password', got '${email.subject}'`,
        );
    });

    it("invite template delivers email with correct subject", { timeout: 120_000 }, async () => {
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
                            inviterName: "Alice",
                            inviteLink: "https://example.com/invite",
                        },
                    }),
                ),
            }),
        );

        const email = await mailbox.waitForEmail("", 60_000);

        assert.ok(email, "Email should be delivered to S3");
        assert.ok(
            email.subject?.toLowerCase().includes("invited"),
            `Email subject should contain 'invited', got '${email.subject}'`,
        );
    });

    it("getting-started template delivers email with correct subject", {
        timeout: 120_000,
    }, async () => {
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
                        template: "getting-started",
                        to: testRecipient,
                        data: {},
                    }),
                ),
            }),
        );

        const email = await mailbox.waitForEmail("", 60_000);

        assert.ok(email, "Email should be delivered to S3");
        assert.ok(
            email.subject?.toLowerCase().includes("welcome"),
            `Email subject should contain 'Welcome', got '${email.subject}'`,
        );
    });
});
