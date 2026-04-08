import {
    AlreadyExistsException,
    CreateEmailIdentityCommand,
    DeleteEmailIdentityCommand,
    NotFoundException,
    SESv2Client,
} from "@aws-sdk/client-sesv2";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, describe, expect, it } from "vitest";
import { handler } from "../../../src/email/functions/idempotent-identity/handler.js";

const sesMock = mockClient(SESv2Client);

afterEach(() => {
    sesMock.reset();
});

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

describe("Create", () => {
    it("creates a new identity and marks it as 'created'", async () => {
        sesMock.on(CreateEmailIdentityCommand).resolves({});

        const result = await handler({
            RequestType: "Create",
            ResourceProperties: { Email: "new@example.com", ServiceToken: "" },
        });

        expect(result.PhysicalResourceId).toBe("ses-identity:new@example.com:created");
        expect(sesMock.commandCalls(CreateEmailIdentityCommand)).toHaveLength(1);
        expect(sesMock.commandCalls(CreateEmailIdentityCommand)[0]?.args[0].input).toEqual({
            EmailIdentity: "new@example.com",
        });
    });

    it("marks a pre-existing identity as 'preexisted'", async () => {
        sesMock
            .on(CreateEmailIdentityCommand)
            .rejects(new AlreadyExistsException({ message: "Already exists", $metadata: {} }));

        const result = await handler({
            RequestType: "Create",
            ResourceProperties: { Email: "existing@example.com", ServiceToken: "" },
        });

        expect(result.PhysicalResourceId).toBe("ses-identity:existing@example.com:preexisted");
    });

    it("propagates unexpected errors", async () => {
        sesMock.on(CreateEmailIdentityCommand).rejects(new Error("Throttled"));

        await expect(
            handler({
                RequestType: "Create",
                ResourceProperties: { Email: "test@example.com", ServiceToken: "" },
            }),
        ).rejects.toThrow("Throttled");
    });
});

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

describe("Update", () => {
    it("ensures identity exists and preserves physical ID when email is unchanged", async () => {
        sesMock
            .on(CreateEmailIdentityCommand)
            .rejects(new AlreadyExistsException({ message: "Already exists", $metadata: {} }));

        const result = await handler({
            RequestType: "Update",
            ResourceProperties: { Email: "same@example.com", ServiceToken: "" },
            OldResourceProperties: { Email: "same@example.com", ServiceToken: "" },
            PhysicalResourceId: "ses-identity:same@example.com:created",
        });

        expect(result.PhysicalResourceId).toBe("ses-identity:same@example.com:created");
        expect(sesMock.commandCalls(CreateEmailIdentityCommand)).toHaveLength(1);
    });

    it("re-creates identity after drift and preserves physical ID", async () => {
        sesMock.on(CreateEmailIdentityCommand).resolves({});

        const result = await handler({
            RequestType: "Update",
            ResourceProperties: { Email: "same@example.com", ServiceToken: "" },
            OldResourceProperties: { Email: "same@example.com", ServiceToken: "" },
            PhysicalResourceId: "ses-identity:same@example.com:created",
        });

        expect(result.PhysicalResourceId).toBe("ses-identity:same@example.com:created");
        expect(sesMock.commandCalls(CreateEmailIdentityCommand)).toHaveLength(1);
    });

    it("preserves 'preexisted' flag on update", async () => {
        sesMock
            .on(CreateEmailIdentityCommand)
            .rejects(new AlreadyExistsException({ message: "Already exists", $metadata: {} }));

        const result = await handler({
            RequestType: "Update",
            ResourceProperties: { Email: "same@example.com", ServiceToken: "" },
            OldResourceProperties: { Email: "same@example.com", ServiceToken: "" },
            PhysicalResourceId: "ses-identity:same@example.com:preexisted",
        });

        expect(result.PhysicalResourceId).toBe("ses-identity:same@example.com:preexisted");
    });

    it("creates a new identity and returns a new physical ID when the email changes", async () => {
        sesMock.on(CreateEmailIdentityCommand).resolves({});

        const result = await handler({
            RequestType: "Update",
            ResourceProperties: { Email: "new@example.com", ServiceToken: "" },
            OldResourceProperties: { Email: "old@example.com", ServiceToken: "" },
            PhysicalResourceId: "ses-identity:old@example.com:created",
        });

        expect(result.PhysicalResourceId).toBe("ses-identity:new@example.com:created");
        expect(sesMock.commandCalls(CreateEmailIdentityCommand)[0]?.args[0].input).toEqual({
            EmailIdentity: "new@example.com",
        });
    });

    it("detects pre-existing identity on email change", async () => {
        sesMock
            .on(CreateEmailIdentityCommand)
            .rejects(new AlreadyExistsException({ message: "Already exists", $metadata: {} }));

        const result = await handler({
            RequestType: "Update",
            ResourceProperties: { Email: "existing@example.com", ServiceToken: "" },
            OldResourceProperties: { Email: "old@example.com", ServiceToken: "" },
            PhysicalResourceId: "ses-identity:old@example.com:created",
        });

        expect(result.PhysicalResourceId).toBe("ses-identity:existing@example.com:preexisted");
    });
});

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

describe("Delete", () => {
    it("deletes an identity that was created by this stack", async () => {
        sesMock.on(DeleteEmailIdentityCommand).resolves({});

        const result = await handler({
            RequestType: "Delete",
            ResourceProperties: { Email: "test@example.com", ServiceToken: "" },
            PhysicalResourceId: "ses-identity:test@example.com:created",
        });

        expect(result.PhysicalResourceId).toBe("ses-identity:test@example.com:created");
        expect(sesMock.commandCalls(DeleteEmailIdentityCommand)).toHaveLength(1);
        expect(sesMock.commandCalls(DeleteEmailIdentityCommand)[0]?.args[0].input).toEqual({
            EmailIdentity: "test@example.com",
        });
    });

    it("skips deletion of a pre-existing identity", async () => {
        const result = await handler({
            RequestType: "Delete",
            ResourceProperties: { Email: "test@example.com", ServiceToken: "" },
            PhysicalResourceId: "ses-identity:test@example.com:preexisted",
        });

        expect(result.PhysicalResourceId).toBe("ses-identity:test@example.com:preexisted");
        expect(sesMock.commandCalls(DeleteEmailIdentityCommand)).toHaveLength(0);
    });

    it("ignores NotFoundException when identity was already deleted", async () => {
        sesMock
            .on(DeleteEmailIdentityCommand)
            .rejects(new NotFoundException({ message: "Not found", $metadata: {} }));

        const result = await handler({
            RequestType: "Delete",
            ResourceProperties: { Email: "test@example.com", ServiceToken: "" },
            PhysicalResourceId: "ses-identity:test@example.com:created",
        });

        expect(result.PhysicalResourceId).toBe("ses-identity:test@example.com:created");
    });

    it("propagates unexpected errors on delete", async () => {
        sesMock.on(DeleteEmailIdentityCommand).rejects(new Error("AccessDenied"));

        await expect(
            handler({
                RequestType: "Delete",
                ResourceProperties: { Email: "test@example.com", ServiceToken: "" },
                PhysicalResourceId: "ses-identity:test@example.com:created",
            }),
        ).rejects.toThrow("AccessDenied");
    });
});
