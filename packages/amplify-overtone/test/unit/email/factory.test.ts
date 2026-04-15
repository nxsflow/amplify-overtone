import assert from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { EmailFactory } from "../../../src/email/factory.js";
import { defineEmail } from "../../../src/email/index.js";

void describe("defineEmail", () => {
    beforeEach(() => {
        EmailFactory.factoryCount = 0;
    });

    void it("returns an object with a getInstance method", () => {
        const factory = defineEmail();
        assert.notStrictEqual(factory, undefined);
        assert.strictEqual(typeof factory.getInstance, "function");
    });

    void it("throws on second call", () => {
        defineEmail();
        assert.throws(() => defineEmail(), /only be called once/);
    });

    void it("accepts no props (minimal config)", () => {
        const factory = defineEmail();
        assert.notStrictEqual(factory, undefined);
    });

    void it("accepts domain-only props with senderPrefix", () => {
        const factory = defineEmail({
            domain: "mail.example.com",
            senders: {
                noreply: { senderPrefix: "noreply", displayName: "Test" },
            },
        });
        assert.notStrictEqual(factory, undefined);
    });

    void it("accepts full Route 53 props with senderPrefix", () => {
        const factory = defineEmail({
            domain: "mail.example.com",
            hostedZoneId: "Z1234567890",
            hostedZoneDomain: "example.com",
            senders: {
                noreply: { senderPrefix: "noreply", displayName: "Test" },
            },
        });
        assert.notStrictEqual(factory, undefined);
    });

    void it("accepts no-domain props with senderEmail", () => {
        const factory = defineEmail({
            senders: {
                noreply: { senderEmail: "noreply@gmail.com", displayName: "Test" },
            },
        });
        assert.notStrictEqual(factory, undefined);
    });
});
