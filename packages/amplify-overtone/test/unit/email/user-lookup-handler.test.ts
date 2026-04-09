import { describe, expect, it, vi, beforeEach } from "vitest";

const mockAdminGetUser = vi.fn();

vi.mock("@aws-sdk/client-cognito-identity-provider", () => ({
    CognitoIdentityProviderClient: class {
        send = mockAdminGetUser;
    },
    AdminGetUserCommand: class {
        constructor(public params: unknown) {}
    },
}));

describe("user-lookup handler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.USER_POOL_ID = "us-east-1_TestPool";
    });

    it("resolves a single userId to Cognito attributes", async () => {
        mockAdminGetUser.mockResolvedValue({
            UserAttributes: [
                { Name: "name", Value: "Alice Smith" },
                { Name: "email", Value: "alice@example.com" },
                { Name: "given_name", Value: "Alice" },
                { Name: "family_name", Value: "Smith" },
            ],
        });

        const { handler } = await import(
            "../../../src/email/functions/user-lookup/handler.js"
        );

        const result = await handler({
            userIdArgs: { invitedBy: "user-123" },
        });

        expect(result).toEqual({
            invitedBy: {
                name: "Alice Smith",
                email: "alice@example.com",
                givenName: "Alice",
                familyName: "Smith",
            },
        });
    });

    it("resolves multiple userId args", async () => {
        mockAdminGetUser
            .mockResolvedValueOnce({
                UserAttributes: [
                    { Name: "name", Value: "Alice" },
                    { Name: "email", Value: "alice@example.com" },
                    { Name: "given_name", Value: "Alice" },
                    { Name: "family_name", Value: "Smith" },
                ],
            })
            .mockResolvedValueOnce({
                UserAttributes: [
                    { Name: "name", Value: "Bob" },
                    { Name: "email", Value: "bob@example.com" },
                    { Name: "given_name", Value: "Bob" },
                    { Name: "family_name", Value: "Jones" },
                ],
            });

        const { handler } = await import(
            "../../../src/email/functions/user-lookup/handler.js"
        );

        const result = await handler({
            userIdArgs: { recipient: "user-111", invitedBy: "user-222" },
        });

        expect(result.recipient.name).toBe("Alice");
        expect(result.invitedBy.name).toBe("Bob");
    });

    it("returns empty strings for missing attributes", async () => {
        mockAdminGetUser.mockResolvedValue({
            UserAttributes: [{ Name: "email", Value: "user@example.com" }],
        });

        const { handler } = await import(
            "../../../src/email/functions/user-lookup/handler.js"
        );

        const result = await handler({
            userIdArgs: { recipient: "user-123" },
        });

        expect(result.recipient.name).toBe("");
        expect(result.recipient.email).toBe("user@example.com");
        expect(result.recipient.givenName).toBe("");
        expect(result.recipient.familyName).toBe("");
    });
});
