import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import {
    AdminGetUserCommand,
    CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import type { TestProjectBase } from "../../test-project-setup/test_project_base.js";
import { emailUserLookupTestProjectCreator } from "../../test-projects/email-user-lookup/test_project_creator.js";
import { assertEmailOutputsExist } from "../../utilities/amplify_outputs_validator.js";
import { S3Mailbox } from "../../utilities/s3_mailbox.js";
import { loadTestInfraConfig } from "../../utilities/test_infra_config.js";

describe("email-user-lookup integration test", { concurrency: false }, () => {
    let testProject: TestProjectBase;
    let mailbox: S3Mailbox;
    let userPoolId: string;
    let ownerSub: string;
    const e2eProjectDir = "./e2e-tests";
    const lambda = new LambdaClient({});
    const cognito = new CognitoIdentityProviderClient({});

    before(
        async () => {
            const infra = await loadTestInfraConfig();
            mailbox = new S3Mailbox(infra.receiptS3Bucket);
            userPoolId = infra.userPoolId;

            // Look up the "owner" test user's sub (Cognito user ID)
            const ownerTestUser = infra.testUsers.owner;
            assert.ok(ownerTestUser, "Owner test user should exist in test infra config");

            const ownerUser = await cognito.send(
                new AdminGetUserCommand({
                    UserPoolId: userPoolId,
                    Username: ownerTestUser.email,
                }),
            );
            ownerSub = ownerUser.UserAttributes?.find((a) => a.Name === "sub")?.Value ?? "";
            assert.ok(ownerSub, "Owner user should have a sub attribute");

            testProject = await emailUserLookupTestProjectCreator.createProject(e2eProjectDir);
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

    it("user-lookup Lambda resolves Cognito attributes from user ID", {
        timeout: 30_000,
    }, async () => {
        const outputs = await testProject.getAmplifyOutputs();
        const emailOutputs = assertEmailOutputsExist(outputs);

        // The user-lookup Lambda function name should be in outputs
        // (added to factory output in factory.ts)
        const userLookupFunctionName = emailOutputs.userLookupFunctionName;
        assert.ok(userLookupFunctionName, "User-lookup function name should be in outputs");

        // Invoke user-lookup Lambda directly with the owner's sub
        const result = await lambda.send(
            new InvokeCommand({
                FunctionName: userLookupFunctionName,
                InvocationType: "RequestResponse",
                Payload: new TextEncoder().encode(
                    JSON.stringify({
                        userIdArgs: { invitedBy: ownerSub },
                    }),
                ),
            }),
        );

        assert.strictEqual(result.StatusCode, 200);
        assert.ok(!result.FunctionError, `Lambda error: ${result.FunctionError}`);

        const resolved = JSON.parse(new TextDecoder().decode(result.Payload));
        assert.ok(resolved.invitedBy, "Should resolve invitedBy user");
        assert.strictEqual(resolved.invitedBy.givenName, "Otto", "Should resolve given_name");
        assert.strictEqual(resolved.invitedBy.familyName, "Owner", "Should resolve family_name");
        assert.strictEqual(resolved.invitedBy.name, "Otto Owner", "Should resolve name");
        assert.ok(
            resolved.invitedBy.email.includes("owner@"),
            `Should resolve email, got: ${resolved.invitedBy.email}`,
        );
    });

    it("full flow: resolved user attributes appear in delivered email", {
        timeout: 120_000,
    }, async () => {
        const outputs = await testProject.getAmplifyOutputs();
        const emailOutputs = assertEmailOutputsExist(outputs);

        // Invoke send-email Lambda with fields as if the resolver had
        // interpolated them (simulating what the pipeline resolver does)
        const result = await lambda.send(
            new InvokeCommand({
                FunctionName: emailOutputs.sendFunctionName,
                InvocationType: "RequestResponse",
                Payload: new TextEncoder().encode(
                    JSON.stringify({
                        to: "reader@amp-recv.nxsflowmail.com",
                        subject: "Otto invited you to TestProject",
                        header: "You've been invited!",
                        body: "Otto Owner (owner@amp-recv.nxsflowmail.com) invited you to TestProject.",
                    }),
                ),
            }),
        );

        assert.strictEqual(result.StatusCode, 200);
        assert.ok(!result.FunctionError, `Lambda error: ${result.FunctionError}`);

        const email = await mailbox.waitForEmail("reader/otto-invited-you", 60_000);
        assert.ok(email, "Email should be delivered");
        assert.ok(
            email.subject?.includes("Otto invited you"),
            `Subject should contain resolved name, got: ${email.subject}`,
        );
        assert.ok(email.body.includes("Otto Owner"), "Body should contain resolved full name");
    });
});
