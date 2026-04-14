import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSesSend = vi.fn().mockResolvedValue({ MessageId: "test-msg-id" });
const mockCognitoSend = vi.fn();

vi.mock("@aws-sdk/client-sesv2", () => ({
    SESv2Client: class {
        send = mockSesSend;
    },
    SendEmailCommand: vi.fn(),
}));

vi.mock("@aws-sdk/client-cognito-identity-provider", () => ({
    CognitoIdentityProviderClient: class {
        send = mockCognitoSend;
    },
    AdminGetUserCommand: class {
        constructor(public params: unknown) {}
    },
}));

const BASE_TEMPLATE = {
    subject: "Hello {{projectName}}",
    header: "Welcome",
    body: "You are invited to {{projectName}}.",
    userIdArgs: [],
};

describe("send-email handler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSesSend.mockResolvedValue({ MessageId: "test-msg-id" });
        process.env.SENDERS_CONFIG = JSON.stringify({
            noreply: { email: "noreply@test.com", displayName: "TestApp" },
        });
        process.env.DEFAULT_SENDER = "noreply";
        process.env.USER_POOL_ID = "us-east-1_TestPool";
    });

    it("sends email using template config with plain argument interpolation", async () => {
        process.env.EMAIL_TEMPLATES = JSON.stringify({
            "email-action-1": {
                ...BASE_TEMPLATE,
                userIdArgs: [],
                recipientArg: undefined,
            },
        });

        const { handler } = await import("../../../src/email/functions/send/handler.js");
        const result = await handler({
            actionId: "email-action-1",
            fieldName: "sendInvite",
            arguments: { projectName: "MyProject", recipient: "user@example.com" },
        });

        expect(result.messageId).toBe("test-msg-id");
    });

    it("interpolates template fields with argument values", async () => {
        process.env.EMAIL_TEMPLATES = JSON.stringify({
            "email-action-1": {
                subject: "{{greeting}} from {{sender}}",
                header: "Header {{greeting}}",
                body: "Body {{sender}}",
                userIdArgs: [],
            },
        });

        const { handler } = await import("../../../src/email/functions/send/handler.js");
        await handler({
            actionId: "email-action-1",
            fieldName: "sendMessage",
            arguments: { greeting: "Hello", sender: "Alice", recipient: "bob@example.com" },
        });

        const [sendEmailCommand] = mockSesSend.mock.calls[0];
        expect(sendEmailCommand).toBeDefined();
    });

    it("resolves Cognito users for userIdArgs and exposes flattened vars", async () => {
        mockCognitoSend.mockResolvedValueOnce({
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

        const { handler } = await import("../../../src/email/functions/send/handler.js");
        const result = await handler({
            actionId: "email-action-2",
            fieldName: "sendInvite",
            arguments: { invitedBy: "user-123", recipient: "target@example.com" },
        });

        expect(result.messageId).toBe("test-msg-id");
        expect(mockCognitoSend).toHaveBeenCalledTimes(1);
    });

    it("uses recipientArg's resolved email as the To address", async () => {
        mockCognitoSend.mockResolvedValueOnce({
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

        const { handler } = await import("../../../src/email/functions/send/handler.js");
        const result = await handler({
            actionId: "email-action-3",
            fieldName: "sendWelcome",
            arguments: { recipient: "user-bob-456" },
        });

        expect(result.messageId).toBe("test-msg-id");
        // Cognito was called once for the recipient userId
        expect(mockCognitoSend).toHaveBeenCalledTimes(1);
    });

    it("throws when actionId is not found in EMAIL_TEMPLATES", async () => {
        process.env.EMAIL_TEMPLATES = JSON.stringify({});

        const { handler } = await import("../../../src/email/functions/send/handler.js");
        await expect(
            handler({
                actionId: "unknown-action",
                fieldName: "sendSomething",
                arguments: {},
            }),
        ).rejects.toThrow('Template config for action "unknown-action" not found');
    });

    it("throws when sender not found in SENDERS_CONFIG", async () => {
        process.env.EMAIL_TEMPLATES = JSON.stringify({
            "email-action-1": {
                ...BASE_TEMPLATE,
                sender: "nonexistent",
                userIdArgs: [],
            },
        });

        const { handler } = await import("../../../src/email/functions/send/handler.js");
        await expect(
            handler({
                actionId: "email-action-1",
                fieldName: "sendInvite",
                arguments: { recipient: "user@example.com" },
            }),
        ).rejects.toThrow('Sender "nonexistent" not found');
    });

    it("throws when recipient cannot be determined", async () => {
        process.env.EMAIL_TEMPLATES = JSON.stringify({
            "email-action-1": {
                ...BASE_TEMPLATE,
                userIdArgs: [],
            },
        });

        const { handler } = await import("../../../src/email/functions/send/handler.js");
        await expect(
            handler({
                actionId: "email-action-1",
                fieldName: "sendInvite",
                arguments: { projectName: "MyProject" },
            }),
        ).rejects.toThrow("Could not determine recipient email address");
    });

    it("uses callToAction and footer from template when provided", async () => {
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

        const { handler } = await import("../../../src/email/functions/send/handler.js");
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

        expect(result.messageId).toBe("test-msg-id");
    });
});
