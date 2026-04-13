import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import {
    CognitoIdentityProviderClient,
    InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import type { TestProjectBase } from "../../test-project-setup/test_project_base.js";
import { defaultEmailTestProjectCreator } from "../../test-projects/default-email/test_project_creator.js";
import { S3Mailbox } from "../../utilities/s3_mailbox.js";
import { loadTestInfraConfig } from "../../utilities/test_infra_config.js";

describe("default-email integration test", { concurrency: false }, () => {
    let testProject: TestProjectBase;
    let mailbox: S3Mailbox;
    let graphqlUrl: string;
    let idToken: string;
    const e2eProjectDir = "./e2e-tests";
    const cognito = new CognitoIdentityProviderClient({});

    before(
        async () => {
            const infra = await loadTestInfraConfig();
            mailbox = new S3Mailbox(infra.receiptS3Bucket);

            // Authenticate to get an ID token for GraphQL calls
            const ownerTestUser = infra.testUsers.owner;
            assert.ok(ownerTestUser, "Owner test user should exist");

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
            idToken = authResult.AuthenticationResult?.IdToken ?? "";
            assert.ok(idToken, "Should receive an ID token");

            // Deploy the test project
            testProject = await defaultEmailTestProjectCreator.createProject(e2eProjectDir, infra);
            await testProject.deploy();

            // Extract the AppSync endpoint
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

    it("sendNotification mutation delivers email via schema action", {
        timeout: 120_000,
    }, async () => {
        const mutation = /* GraphQL */ `
			mutation SendNotification(
				$recipient: AWSEmail!
				$subject: String!
				$header: String!
				$body: String!
			) {
				sendNotification(
					recipient: $recipient
					subject: $subject
					header: $header
					body: $body
				)
			}
		`;

        const response = await fetch(graphqlUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: idToken,
            },
            body: JSON.stringify({
                query: mutation,
                variables: {
                    recipient: "reader@amp-recv.nxsflowmail.com",
                    subject: "Your confirmation code",
                    header: "Confirmation Code",
                    body: "Use the code below to verify your identity: 123456",
                },
            }),
        });

        assert.ok(response.ok, `GraphQL request failed: ${response.status}`);
        const result = (await response.json()) as {
            data?: Record<string, unknown>;
            errors?: unknown[];
        };
        assert.ok(!result.errors, `GraphQL errors: ${JSON.stringify(result.errors)}`);
        assert.ok(result.data?.sendNotification !== undefined, "Mutation should return a result");

        // Verify email delivery
        const email = await mailbox.waitForEmail("reader/your-confirmation-code", 60_000);
        assert.ok(email, "Email should be delivered to S3");
        assert.ok(
            email.subject?.includes("Your confirmation code"),
            `Subject should match, got: ${email.subject}`,
        );
    });

    it("template renders header, body, and footer", { timeout: 120_000 }, async () => {
        const email = await mailbox.waitForEmail("reader/your-confirmation-code", 10_000);
        assert.ok(email, "Email should exist in mailbox");

        assert.ok(email.body.includes("Confirmation Code"), "Should contain header");
        assert.ok(email.body.includes("Use the code below"), "Should contain body text");
        assert.ok(email.body.includes("Sent by Overtone Test"), "Should contain footer");
    });
});
