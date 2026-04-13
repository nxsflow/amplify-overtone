import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import type { TestProjectBase } from "../../test-project-setup/test_project_base.js";
import { emailTemplateApiTestProjectCreator } from "../../test-projects/email-template-api/test_project_creator.js";
import { discoverFunctionName } from "../../utilities/lambda_discovery.js";
import { S3Mailbox } from "../../utilities/s3_mailbox.js";
import { loadTestInfraConfig } from "../../utilities/test_infra_config.js";

describe("email-template-api integration test", { concurrency: false }, () => {
    let testProject: TestProjectBase;
    let mailbox: S3Mailbox;
    let sendFunctionName: string;
    const e2eProjectDir = "./e2e-tests";
    const lambda = new LambdaClient({});

    before(
        async () => {
            const infra = await loadTestInfraConfig();
            mailbox = new S3Mailbox(infra.receiptS3Bucket);

            testProject = await emailTemplateApiTestProjectCreator.createProject(e2eProjectDir);
            await testProject.deploy();
            sendFunctionName = await discoverFunctionName(
                lambda,
                "email-template-api-test",
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

    it("send-email Lambda accepts core fields and email arrives", {
        timeout: 120_000,
    }, async () => {
        const result = await lambda.send(
            new InvokeCommand({
                FunctionName: sendFunctionName,
                InvocationType: "RequestResponse",
                Payload: new TextEncoder().encode(
                    JSON.stringify({
                        to: "reader@amp-recv.nxsflowmail.com",
                        subject: "Alice invited you to ProjectX",
                        header: "You've been invited!",
                        body: "Alice invited you to collaborate on ProjectX.",
                        callToAction: {
                            label: "Accept Invitation",
                            href: "https://app.example.com/accept",
                        },
                        footer: "If you did not expect this, ignore this email.",
                    }),
                ),
            }),
        );

        assert.strictEqual(result.StatusCode, 200, "Lambda should execute successfully");
        assert.ok(!result.FunctionError, `Lambda should not error: ${result.FunctionError}`);

        const responsePayload = JSON.parse(new TextDecoder().decode(result.Payload));
        assert.ok(responsePayload.messageId, "Response should contain messageId");

        const email = await mailbox.waitForEmail("reader/alice-invited-you", 60_000);
        assert.ok(email, "Email should be delivered to S3");
        assert.ok(
            email.subject?.includes("Alice invited you to ProjectX"),
            `Subject should match, got: ${email.subject}`,
        );
    });

    it("core template renders header, body, CTA, and footer", { timeout: 120_000 }, async () => {
        const email = await mailbox.waitForEmail("reader/alice-invited-you", 10_000);
        assert.ok(email, "Email should exist in mailbox");

        assert.ok(email.body.includes("You've been invited!"), "Should contain header");
        assert.ok(email.body.includes("Alice invited you to collaborate"), "Should contain body");
        assert.ok(email.body.includes("Accept Invitation"), "Should contain CTA label");
        assert.ok(email.body.includes("https://app.example.com/accept"), "Should contain CTA href");
        assert.ok(email.body.includes("If you did not expect this"), "Should contain footer");
    });
});
