// test/unit/schema/field-types.test.ts
import { describe, expect, it } from "vitest";
import { a } from "@aws-amplify/data-schema";
import { isUserIdField, userId } from "../../../src/schema/field-types.js";
import { OVERTONE_USER_ID } from "../../../src/schema/types.js";

describe("n.userId()", () => {
    it("returns an Amplify field type (has .data property)", () => {
        const field = userId();
        expect(field).toHaveProperty("data");
    });

    it("is tagged with the OVERTONE_USER_ID symbol", () => {
        const field = userId();
        expect((field as any)[OVERTONE_USER_ID]).toBe(true);
    });

    it("is detected by isUserIdField()", () => {
        expect(isUserIdField(userId())).toBe(true);
    });

    it("plain a.string() is NOT detected as userId", () => {
        expect(isUserIdField(a.string())).toBe(false);
        expect(isUserIdField(a.string().required())).toBe(false);
    });

    it("a.email() is NOT detected as userId", () => {
        expect(isUserIdField(a.email())).toBe(false);
    });
});
