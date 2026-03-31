import { beforeEach, describe, expect, it } from "vitest";
import { EmailFactory } from "../../../src/email/factory.js";
import { defineEmail } from "../../../src/email/index.js";

describe("defineEmail", () => {
    beforeEach(() => {
        EmailFactory.factoryCount = 0;
    });

    it("returns an object with a getInstance method", () => {
        const factory = defineEmail();
        expect(factory).toBeDefined();
        expect(typeof factory.getInstance).toBe("function");
    });

    it("throws on second call", () => {
        defineEmail();
        expect(() => defineEmail()).toThrow(/only be called once/);
    });

    it("accepts no props (minimal config)", () => {
        const factory = defineEmail();
        expect(factory).toBeDefined();
    });

    it("accepts domain-only props with senderPrefix", () => {
        const factory = defineEmail({
            domain: "mail.example.com",
            senders: {
                noreply: { senderPrefix: "noreply", displayName: "Test" },
            },
        });
        expect(factory).toBeDefined();
    });

    it("accepts full Route 53 props with senderPrefix", () => {
        const factory = defineEmail({
            domain: "mail.example.com",
            hostedZoneId: "Z1234567890",
            hostedZoneDomain: "example.com",
            senders: {
                noreply: { senderPrefix: "noreply", displayName: "Test" },
            },
        });
        expect(factory).toBeDefined();
    });

    it("accepts no-domain props with senderEmail", () => {
        const factory = defineEmail({
            senders: {
                noreply: { senderEmail: "noreply@gmail.com", displayName: "Test" },
            },
        });
        expect(factory).toBeDefined();
    });
});
