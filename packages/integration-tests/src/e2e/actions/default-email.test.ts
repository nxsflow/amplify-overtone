import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import type { TestProjectBase } from "../../test-project-setup/test_project_base.js";
import { defaultEmailTestProjectCreator } from "../../test-projects/default-email/test_project_creator.js";
import { assertEmailOutputsExist } from "../../utilities/amplify_outputs_validator.js";
import { S3Mailbox } from "../../utilities/s3_mailbox.js";
import { loadTestInfraConfig } from "../../utilities/test_infra_config.js";

describe("default-email integration test", { concurrency: false }, () => {
    let testProject: TestProjectBase;
    let mailbox: S3Mailbox;
    const e2eProjectDir = "./e2e-tests";
    const lambda = new LambdaClient({});

    before(
        async () => {
            const infra = await loadTestInfraConfig();
            mailbox = new S3Mailbox(infra.receiptS3Bucket);

            testProject = await defaultEmailTestProjectCreator.createProject(e2eProjectDir);
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

    it("amplify_outputs.json contains email config", async () => {
        await testProject.assertPostDeployment();
        const outputs = await testProject.getAmplifyOutputs();
        assertEmailOutputsExist(outputs);
    });

    it("send-email Lambda sends confirmation-code and email arrives in S3", {
        timeout: 120_000,
    }, async () => {
        const outputs = await testProject.getAmplifyOutputs();
        const emailOutputs = assertEmailOutputsExist(outputs);

        const result = await lambda.send(
            new InvokeCommand({
                FunctionName: emailOutputs.sendFunctionName,
                InvocationType: "RequestResponse",
                Payload: new TextEncoder().encode(
                    JSON.stringify({
                        template: "confirmation-code",
                        to: "reader@amp-recv.nxsflowmail.com",
                        data: { code: "123456" },
                    }),
                ),
            }),
        );

        assert.strictEqual(result.StatusCode, 200, "Lambda should execute successfully");
        assert.ok(!result.FunctionError, `Lambda should not error: ${result.FunctionError}`);

        const responsePayload = JSON.parse(new TextDecoder().decode(result.Payload));
        assert.ok(responsePayload.messageId, "Response should contain messageId");

        const email = await mailbox.waitForEmail("reader/your-confirmation-code", 60_000);
        assert.ok(email, "Email should be delivered to S3");
        assert.ok(
            email.subject?.includes("Your confirmation code"),
            `Subject should match, got: ${email.subject}`,
        );
        assert.ok(
            email.from?.includes("owner@amp-recv.nxsflowmail.com"),
            `From should match, got: ${email.from}`,
        );
    });
});
