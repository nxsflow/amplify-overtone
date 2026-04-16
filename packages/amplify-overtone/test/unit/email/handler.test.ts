import assert from "node:assert";
import { beforeEach, describe, it } from "node:test";
import {
    AdminGetUserCommand,
    CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { mockClient } from "aws-sdk-client-mock";

// aws-sdk-client-mock intercepts at the SmithyClient level, so it works even
// when the clients are created at module top-level.
const sesMock = mockClient(SESv2Client);
const cognitoMock = mockClient(CognitoIdentityProviderClient);

const BASE_TEMPLATE = {
    subject: "Hello {{projectName}}",
    header: "Welcome",
    body: "You are invited to {{projectName}}.",
    userIdArgs: [],
};

// Import the handler once after mocks are set up
const { handler } = await import("../../../src/email/functions/send/handler.js");

void describe("send-email handler", () => {
    beforeEach(() => {
        sesMock.reset();
        cognitoMock.reset();
        sesMock.on(SendEmailCommand).resolves({ MessageId: "test-msg-id" });
        process.env.SENDERS_CONFIG = JSON.stringify({
            noreply: { email: "noreply@test.com", displayName: "TestApp" },
        });
        process.env.DEFAULT_SENDER = "noreply";
        process.env.USER_POOL_ID = "us-east-1_TestPool";
    });

    void it("sends email using template config with plain argument interpolation", async () => {
        process.env.EMAIL_TEMPLATES = JSON.stringify({
            "email-action-1": {
                ...BASE_TEMPLATE,
                userIdArgs: [],
                recipientArg: undefined,
            },
        });

        const result = await handler({
            actionId: "email-action-1",
            fieldName: "sendInvite",
            arguments: { projectName: "MyProject", recipient: "user@example.com" },
        });

        assert.strictEqual(result.messageId, "test-msg-id");
    });

    void it("interpolates template fields with argument values", async () => {
        process.env.EMAIL_TEMPLATES = JSON.stringify({
            "email-action-1": {
                subject: "{{greeting}} from {{sender}}",
                header: "Header {{greeting}}",
                body: "Body {{sender}}",
                userIdArgs: [],
            },
        });

        await handler({
            actionId: "email-action-1",
            fieldName: "sendMessage",
            arguments: { greeting: "Hello", sender: "Alice", recipient: "bob@example.com" },
        });

        assert.strictEqual(sesMock.commandCalls(SendEmailCommand).length > 0, true);
    });

    void it("resolves Cognito users for userIdArgs and exposes flattened vars", async () => {
        cognitoMock.on(AdminGetUserCommand).resolves({
            UserAttributes: [
                { Name: "name", Value: "Alice Smith" },
                { Name: "email", Value: "alice@example.com" },
                { Name: "given_name", Value: "Alice" },
                { Name: "family_name", Value: "Smith" },
            ],
        });

        process.env.EMAIL_TEMPLATES = JSON.stringify({
            "email-action-2": {
                subject: "Invite from {{invitedByGivenName}}",
                header: "Hi",
                body: "{{invitedByName}} invited you.",
                userIdArgs: ["invitedBy"],
                recipientArg: undefined,
            },
        });

        const result = await handler({
            actionId: "email-action-2",
            fieldName: "sendInvite",
            arguments: { invitedBy: "user-123", recipient: "target@example.com" },
        });

        assert.strictEqual(result.messageId, "test-msg-id");
        assert.strictEqual(cognitoMock.commandCalls(AdminGetUserCommand).length, 1);
    });

    void it("uses recipientArg's resolved email as the To address", async () => {
        cognitoMock.on(AdminGetUserCommand).resolves({
            UserAttributes: [
                { Name: "name", Value: "Bob Jones" },
                { Name: "email", Value: "bob@example.com" },
                { Name: "given_name", Value: "Bob" },
                { Name: "family_name", Value: "Jones" },
            ],
        });

        process.env.EMAIL_TEMPLATES = JSON.stringify({
            "email-action-3": {
                subject: "Hello",
                header: "Hi",
                body: "Welcome",
                userIdArgs: ["recipient"],
                recipientArg: "recipient",
            },
        });

        const result = await handler({
            actionId: "email-action-3",
            fieldName: "sendWelcome",
            arguments: { recipient: "user-bob-456" },
        });

        assert.strictEqual(result.messageId, "test-msg-id");
        // Cognito was called once for the recipient userId
        assert.strictEqual(cognitoMock.commandCalls(AdminGetUserCommand).length, 1);
    });

    void it("throws when actionId is not found in EMAIL_TEMPLATES", async () => {
        process.env.EMAIL_TEMPLATES = JSON.stringify({});

        await assert.rejects(
            handler({
                actionId: "unknown-action",
                fieldName: "sendSomething",
                arguments: {},
            }),
            { message: /Template config for action "unknown-action" not found/ },
        );
    });

    void it("throws when sender not found in SENDERS_CONFIG", async () => {
        process.env.EMAIL_TEMPLATES = JSON.stringify({
            "email-action-1": {
                ...BASE_TEMPLATE,
                sender: "nonexistent",
                userIdArgs: [],
            },
        });

        await assert.rejects(
            handler({
                actionId: "email-action-1",
                fieldName: "sendInvite",
                arguments: { recipient: "user@example.com" },
            }),
            { message: /Sender "nonexistent" not found/ },
        );
    });

    void it("throws when recipient cannot be determined", async () => {
        process.env.EMAIL_TEMPLATES = JSON.stringify({
            "email-action-1": {
                ...BASE_TEMPLATE,
                userIdArgs: [],
            },
        });

        await assert.rejects(
            handler({
                actionId: "email-action-1",
                fieldName: "sendInvite",
                arguments: { projectName: "MyProject" },
            }),
            { message: /Could not determine recipient email address/ },
        );
    });

    void it("uses callToAction and footer from template when provided", async () => {
        process.env.EMAIL_TEMPLATES = JSON.stringify({
            "email-action-cta": {
                subject: "Join {{projectName}}",
                header: "You are invited",
                body: "Click below to join.",
                callToAction: {
                    label: "Join {{projectName}}",
                    href: "https://example.com/join/{{projectId}}",
                },
                footer: "Unsubscribe at {{unsubscribeUrl}}",
                userIdArgs: [],
            },
        });

        const result = await handler({
            actionId: "email-action-cta",
            fieldName: "sendInvite",
            arguments: {
                projectName: "Acme",
                projectId: "proj-1",
                unsubscribeUrl: "https://example.com/unsub",
                recipient: "user@example.com",
            },
        });

        assert.strictEqual(result.messageId, "test-msg-id");
    });
});
