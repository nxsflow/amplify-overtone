import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import {
    AdminGetUserCommand,
    CognitoIdentityProviderClient,
    InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { ListResourceRecordSetsCommand, Route53Client } from "@aws-sdk/client-route-53";
import { GetEmailIdentityCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import type { TestProjectBase } from "../../test-project-setup/test_project_base.js";
import { customDomainEmailTestProjectCreator } from "../../test-projects/custom-domain-email/test_project_creator.js";
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
    let graphqlUrl: string;
    let idToken: string;
    let ownerSub: string;
    let readerSub: string;
    const e2eProjectDir = "./e2e-tests";
    const ses = new SESv2Client({});
    const route53 = new Route53Client({});
    const cognito = new CognitoIdentityProviderClient({});

    before(
        async () => {
            const infra = await loadTestInfraConfig();
            mailbox = new S3Mailbox(infra.receiptS3Bucket);

            // Look up test user subs for n.userId() resolution
            const ownerTestUser = infra.testUsers.owner;
            assert.ok(ownerTestUser, "Owner test user should exist");
            const readerTestUser = infra.testUsers.reader;
            assert.ok(readerTestUser, "Reader test user should exist");

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
            assert.ok(ownerSub, "Owner should have a sub");
            readerSub = readerUser.UserAttributes?.find((a) => a.Name === "sub")?.Value ?? "";
            assert.ok(readerSub, "Reader should have a sub");

            // Authenticate to get an ID token for GraphQL calls
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
            testProject = await customDomainEmailTestProjectCreator.createProject(
                e2eProjectDir,
                infra,
            );
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
        await waitForSesVerification(senderDomain, 300_000);

        const identity = await ses.send(
            new GetEmailIdentityCommand({ EmailIdentity: senderDomain }),
        );
        assert.ok(identity.VerifiedForSendingStatus, "SES identity should be verified for sending");
    });

    // -- Email delivery via schema action with user lookup --

    it("sendInvite mutation delivers email with resolved user attributes", {
        timeout: 120_000,
    }, async () => {
        const mutation = /* GraphQL */ `
			mutation SendInvite($recipient: ID!, $invitedBy: ID!, $projectName: String!) {
				sendInvite(
					recipient: $recipient
					invitedBy: $invitedBy
					projectName: $projectName
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
                    recipient: readerSub,
                    invitedBy: ownerSub,
                    projectName: "TestProject",
                },
            }),
        });

        assert.ok(response.ok, `GraphQL request failed: ${response.status}`);
        const result = (await response.json()) as {
            data?: Record<string, unknown>;
            errors?: unknown[];
        };
        assert.ok(!result.errors, `GraphQL errors: ${JSON.stringify(result.errors)}`);
        assert.ok(result.data?.sendInvite !== undefined, "Mutation should return a result");

        // Verify email delivery with resolved Cognito attributes
        const email = await mailbox.waitForEmail("reader/otto-invited-you", 60_000);
        assert.ok(email, "Email should be delivered to S3");

        // Subject uses invitedBy.givenName
        assert.ok(
            email.subject?.includes("Otto invited you"),
            `Subject should contain resolved givenName, got: ${email.subject}`,
        );
    });

    it("template renders all sections with resolved attributes", { timeout: 120_000 }, async () => {
        const email = await mailbox.waitForEmail("reader/otto-invited-you", 10_000);
        assert.ok(email, "Email should exist in mailbox");

        // Header uses invitedBy.name (full display name)
        assert.ok(
            email.body.includes("Otto Owner wants to collaborate"),
            "Header should contain resolved name",
        );

        // Body uses invitedBy.givenName, familyName, email, recipient.name
        assert.ok(email.body.includes("Otto Owner ("), "Body should contain invitedBy name");
        assert.ok(email.body.includes("owner@"), "Body should contain invitedBy email");
        assert.ok(
            email.body.includes("invited Reed Reader to collaborate"),
            "Body should contain recipient name",
        );
        assert.ok(email.body.includes("TestProject"), "Body should contain project name");

        // CTA
        assert.ok(email.body.includes("Accept Invitation"), "Should contain CTA label");
        assert.ok(email.body.includes("https://app.example.com/accept"), "Should contain CTA href");

        // Footer
        assert.ok(email.body.includes("If you did not expect this"), "Should contain footer");
    });
});
