import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import type { TestProjectBase } from "../../test-project-setup/test_project_base.js";
import { defaultEmailTestProjectCreator } from "../../test-projects/default-email/test_project_creator.js";
import { assertEmailOutputsExist } from "../../utilities/amplify_outputs_validator.js";

describe("default-email integration test", { concurrency: false }, () => {
    let testProject: TestProjectBase;
    const e2eProjectDir = "./e2e-tests";
    const lambda = new LambdaClient({});

    before(
        async () => {
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

    it("send-email Lambda is invocable", async () => {
        const outputs = await testProject.getAmplifyOutputs();
        const emailOutputs = assertEmailOutputsExist(outputs);

        const result = await lambda.send(
            new InvokeCommand({
                FunctionName: emailOutputs.sendFunctionName,
                InvocationType: "RequestResponse",
                Payload: new TextEncoder().encode(
                    JSON.stringify({
                        template: "confirmation-code",
                        to: "test@example.com",
                        data: { code: "123456" },
                    }),
                ),
            }),
        );

        assert.strictEqual(result.StatusCode, 200, "Lambda should execute successfully");
    });
});
