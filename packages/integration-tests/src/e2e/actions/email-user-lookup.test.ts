import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import {
    AdminGetUserCommand,
    CognitoIdentityProviderClient,
    InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import type { TestProjectBase } from "../../test-project-setup/test_project_base.js";
import { emailUserLookupTestProjectCreator } from "../../test-projects/email-user-lookup/test_project_creator.js";
import { S3Mailbox } from "../../utilities/s3_mailbox.js";
import { loadTestInfraConfig } from "../../utilities/test_infra_config.js";

describe("email-user-lookup integration test", { concurrency: false }, () => {
    let testProject: TestProjectBase;
    let mailbox: S3Mailbox;
    let ownerSub: string;
    let ownerIdToken: string;
    let readerSub: string;
    let graphqlUrl: string;
    const e2eProjectDir = "./e2e-tests";
    const cognito = new CognitoIdentityProviderClient({});

    before(
        async () => {
            const infra = await loadTestInfraConfig();
            mailbox = new S3Mailbox(infra.receiptS3Bucket);

            // Look up test user subs
            const ownerTestUser = infra.testUsers.owner;
            assert.ok(ownerTestUser, "Owner test user should exist in test infra config");

            const readerTestUser = infra.testUsers.reader;
            assert.ok(readerTestUser, "Reader test user should exist in test infra config");

            const [ownerUser, readerUser] = await Promise.all([
                cognito.send(
                    new AdminGetUserCommand({
                        UserPoolId: infra.userPoolId,
                        Username: ownerTestUser.email,
                    }),
                ),
                cognito.send(
                    new AdminGetUserCommand({
                        UserPoolId: infra.userPoolId,
                        Username: readerTestUser.email,
                    }),
                ),
            ]);

            ownerSub = ownerUser.UserAttributes?.find((a) => a.Name === "sub")?.Value ?? "";
            assert.ok(ownerSub, "Owner user should have a sub attribute");

            readerSub = readerUser.UserAttributes?.find((a) => a.Name === "sub")?.Value ?? "";
            assert.ok(readerSub, "Reader user should have a sub attribute");

            // Authenticate the owner to get an ID token for GraphQL calls
            const authResult = await cognito.send(
                new InitiateAuthCommand({
                    AuthFlow: "USER_PASSWORD_AUTH",
                    ClientId: infra.userPoolClientId,
                    AuthParameters: {
                        USERNAME: ownerTestUser.email,
                        PASSWORD: ownerTestUser.password,
                    },
                }),
            );
            ownerIdToken = authResult.AuthenticationResult?.IdToken ?? "";
            assert.ok(ownerIdToken, "Owner user should receive an ID token");

            // Deploy the test project with infra env vars
            testProject = await emailUserLookupTestProjectCreator.createProject(
                e2eProjectDir,
                infra,
            );
            await testProject.deploy();

            // Extract the AppSync endpoint from amplify_outputs.json
            const outputs = await testProject.getAmplifyOutputs();
            const dataOutputs = outputs.data as Record<string, unknown> | undefined;
            assert.ok(dataOutputs, "amplify_outputs.json should contain data config");
            graphqlUrl = dataOutputs.url as string;
            assert.ok(graphqlUrl, "Data outputs should contain a GraphQL URL");
        },
        { timeout: 600_000 },
    );

    after(
        async () => {
            await testProject.tearDown();
        },
        { timeout: 300_000 },
    );

    it("sendInvite mutation triggers email with resolved user attributes", {
        timeout: 120_000,
    }, async () => {
        const mutation = /* GraphQL */ `
            mutation SendInvite($recipient: ID!, $invitedBy: ID!, $projectName: String!) {
                sendInvite(recipient: $recipient, invitedBy: $invitedBy, projectName: $projectName)
            }
        `;

        const response = await fetch(graphqlUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: ownerIdToken,
            },
            body: JSON.stringify({
                query: mutation,
                variables: {
                    recipient: readerSub,
                    invitedBy: ownerSub,
                    projectName: "TestProject",
                },
            }),
        });

        assert.ok(response.ok, `GraphQL request failed with status ${response.status}`);

        const body = (await response.json()) as {
            data?: Record<string, unknown>;
            errors?: unknown[];
        };
        assert.ok(!body.errors, `GraphQL errors: ${JSON.stringify(body.errors)}`);
        assert.ok(body.data?.sendInvite !== undefined, "Mutation should return a result");

        // Verify the email was delivered with resolved user attributes
        const email = await mailbox.waitForEmail("reader/otto-invited-you", 60_000);
        assert.ok(email, "Email should be delivered to S3");
        assert.ok(
            email.subject?.includes("Otto invited you"),
            `Subject should contain resolved name, got: ${email.subject}`,
        );
        assert.ok(email.body.includes("Otto Owner"), "Body should contain resolved full name");
        assert.ok(email.body.includes("TestProject"), "Body should contain project name");
    });
});
