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

    it("accepts domain-only props", () => {
        const factory = defineEmail({ domain: "mail.example.com" });
        expect(factory).toBeDefined();
    });

    it("accepts full Route 53 props", () => {
        const factory = defineEmail({
            domain: "mail.example.com",
            hostedZoneId: "Z1234567890",
            hostedZoneDomain: "example.com",
            senders: {
                noreply: { localPart: "noreply", displayName: "Test" },
            },
        });
        expect(factory).toBeDefined();
    });
});
