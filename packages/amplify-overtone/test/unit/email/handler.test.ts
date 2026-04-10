import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@aws-sdk/client-sesv2", () => ({
    SESv2Client: class {
        send = vi.fn().mockResolvedValue({ MessageId: "test-msg-id" });
    },
    SendEmailCommand: vi.fn(),
}));

describe("send-email handler", () => {
    beforeEach(() => {
        process.env.SENDERS_CONFIG = JSON.stringify({
            noreply: { email: "noreply@test.com", displayName: "TestApp" },
        });
        process.env.DEFAULT_SENDER = "noreply";
    });

    it("accepts core fields and sends email", async () => {
        const { handler } = await import("../../../src/email/functions/send/handler.js");
        const result = await handler({
            to: "user@example.com",
            subject: "Test Subject",
            header: "Hello",
            body: "Welcome to the app.",
        });
        expect(result.messageId).toBe("test-msg-id");
    });

    it("throws when sender not found", async () => {
        const { handler } = await import("../../../src/email/functions/send/handler.js");
        await expect(
            handler({
                to: "user@example.com",
                sender: "nonexistent",
                subject: "Test",
                header: "Hi",
                body: "Body.",
            }),
        ).rejects.toThrow('Sender "nonexistent" not found');
    });
});
