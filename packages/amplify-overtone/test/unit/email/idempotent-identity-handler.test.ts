import assert from "node:assert";
import { afterEach, describe, it } from "node:test";
import {
    AlreadyExistsException,
    CreateEmailIdentityCommand,
    DeleteEmailIdentityCommand,
    NotFoundException,
    SESv2Client,
} from "@aws-sdk/client-sesv2";
import { mockClient } from "aws-sdk-client-mock";
import { handler } from "../../../src/email/functions/idempotent-identity/handler.js";

const sesMock = mockClient(SESv2Client);

afterEach(() => {
    sesMock.reset();
});

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

void describe("Create", () => {
    void it("creates a new identity and marks it as 'created'", async () => {
        sesMock.on(CreateEmailIdentityCommand).resolves({});

        const result = await handler({
            RequestType: "Create",
            ResourceProperties: { Email: "new@example.com", ServiceToken: "" },
        });

        assert.strictEqual(result.PhysicalResourceId, "ses-identity:new@example.com:created");
        assert.strictEqual(sesMock.commandCalls(CreateEmailIdentityCommand).length, 1);
        assert.deepStrictEqual(sesMock.commandCalls(CreateEmailIdentityCommand)[0]?.args[0].input, {
            EmailIdentity: "new@example.com",
        });
    });

    void it("marks a pre-existing identity as 'preexisted'", async () => {
        sesMock
            .on(CreateEmailIdentityCommand)
            .rejects(new AlreadyExistsException({ message: "Already exists", $metadata: {} }));

        const result = await handler({
            RequestType: "Create",
            ResourceProperties: { Email: "existing@example.com", ServiceToken: "" },
        });

        assert.strictEqual(
            result.PhysicalResourceId,
            "ses-identity:existing@example.com:preexisted",
        );
    });

    void it("propagates unexpected errors", async () => {
        sesMock.on(CreateEmailIdentityCommand).rejects(new Error("Throttled"));

        await assert.rejects(
            handler({
                RequestType: "Create",
                ResourceProperties: { Email: "test@example.com", ServiceToken: "" },
            }),
            { message: "Throttled" },
        );
    });
});

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

void describe("Update", () => {
    void it("ensures identity exists and preserves physical ID when email is unchanged", async () => {
        sesMock
            .on(CreateEmailIdentityCommand)
            .rejects(new AlreadyExistsException({ message: "Already exists", $metadata: {} }));

        const result = await handler({
            RequestType: "Update",
            ResourceProperties: { Email: "same@example.com", ServiceToken: "" },
            OldResourceProperties: { Email: "same@example.com", ServiceToken: "" },
            PhysicalResourceId: "ses-identity:same@example.com:created",
        });

        assert.strictEqual(result.PhysicalResourceId, "ses-identity:same@example.com:created");
        assert.strictEqual(sesMock.commandCalls(CreateEmailIdentityCommand).length, 1);
    });

    void it("re-creates identity after drift and preserves physical ID", async () => {
        sesMock.on(CreateEmailIdentityCommand).resolves({});

        const result = await handler({
            RequestType: "Update",
            ResourceProperties: { Email: "same@example.com", ServiceToken: "" },
            OldResourceProperties: { Email: "same@example.com", ServiceToken: "" },
            PhysicalResourceId: "ses-identity:same@example.com:created",
        });

        assert.strictEqual(result.PhysicalResourceId, "ses-identity:same@example.com:created");
        assert.strictEqual(sesMock.commandCalls(CreateEmailIdentityCommand).length, 1);
    });

    void it("preserves 'preexisted' flag on update", async () => {
        sesMock
            .on(CreateEmailIdentityCommand)
            .rejects(new AlreadyExistsException({ message: "Already exists", $metadata: {} }));

        const result = await handler({
            RequestType: "Update",
            ResourceProperties: { Email: "same@example.com", ServiceToken: "" },
            OldResourceProperties: { Email: "same@example.com", ServiceToken: "" },
            PhysicalResourceId: "ses-identity:same@example.com:preexisted",
        });

        assert.strictEqual(result.PhysicalResourceId, "ses-identity:same@example.com:preexisted");
    });

    void it("creates a new identity and returns a new physical ID when the email changes", async () => {
        sesMock.on(CreateEmailIdentityCommand).resolves({});

        const result = await handler({
            RequestType: "Update",
            ResourceProperties: { Email: "new@example.com", ServiceToken: "" },
            OldResourceProperties: { Email: "old@example.com", ServiceToken: "" },
            PhysicalResourceId: "ses-identity:old@example.com:created",
        });

        assert.strictEqual(result.PhysicalResourceId, "ses-identity:new@example.com:created");
        assert.deepStrictEqual(sesMock.commandCalls(CreateEmailIdentityCommand)[0]?.args[0].input, {
            EmailIdentity: "new@example.com",
        });
    });

    void it("detects pre-existing identity on email change", async () => {
        sesMock
            .on(CreateEmailIdentityCommand)
            .rejects(new AlreadyExistsException({ message: "Already exists", $metadata: {} }));

        const result = await handler({
            RequestType: "Update",
            ResourceProperties: { Email: "existing@example.com", ServiceToken: "" },
            OldResourceProperties: { Email: "old@example.com", ServiceToken: "" },
            PhysicalResourceId: "ses-identity:old@example.com:created",
        });

        assert.strictEqual(
            result.PhysicalResourceId,
            "ses-identity:existing@example.com:preexisted",
        );
    });
});

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

void describe("Delete", () => {
    void it("deletes an identity that was created by this stack", async () => {
        sesMock.on(DeleteEmailIdentityCommand).resolves({});

        const result = await handler({
            RequestType: "Delete",
            ResourceProperties: { Email: "test@example.com", ServiceToken: "" },
            PhysicalResourceId: "ses-identity:test@example.com:created",
        });

        assert.strictEqual(result.PhysicalResourceId, "ses-identity:test@example.com:created");
        assert.strictEqual(sesMock.commandCalls(DeleteEmailIdentityCommand).length, 1);
        assert.deepStrictEqual(sesMock.commandCalls(DeleteEmailIdentityCommand)[0]?.args[0].input, {
            EmailIdentity: "test@example.com",
        });
    });

    void it("skips deletion of a pre-existing identity", async () => {
        const result = await handler({
            RequestType: "Delete",
            ResourceProperties: { Email: "test@example.com", ServiceToken: "" },
            PhysicalResourceId: "ses-identity:test@example.com:preexisted",
        });

        assert.strictEqual(result.PhysicalResourceId, "ses-identity:test@example.com:preexisted");
        assert.strictEqual(sesMock.commandCalls(DeleteEmailIdentityCommand).length, 0);
    });

    void it("ignores NotFoundException when identity was already deleted", async () => {
        sesMock
            .on(DeleteEmailIdentityCommand)
            .rejects(new NotFoundException({ message: "Not found", $metadata: {} }));

        const result = await handler({
            RequestType: "Delete",
            ResourceProperties: { Email: "test@example.com", ServiceToken: "" },
            PhysicalResourceId: "ses-identity:test@example.com:created",
        });

        assert.strictEqual(result.PhysicalResourceId, "ses-identity:test@example.com:created");
    });

    void it("propagates unexpected errors on delete", async () => {
        sesMock.on(DeleteEmailIdentityCommand).rejects(new Error("AccessDenied"));

        await assert.rejects(
            handler({
                RequestType: "Delete",
                ResourceProperties: { Email: "test@example.com", ServiceToken: "" },
                PhysicalResourceId: "ses-identity:test@example.com:created",
            }),
            { message: "AccessDenied" },
        );
    });
});
