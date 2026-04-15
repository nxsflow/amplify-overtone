// test/unit/schema/field-types.test.ts

import assert from "node:assert";
import { describe, it } from "node:test";
import { a } from "@aws-amplify/backend";
import { isUserIdField, userId } from "../../../src/schema/field-types.js";
import { OVERTONE_USER_ID } from "../../../src/schema/types.js";

void describe("n.userId()", () => {
    void it("returns an Amplify field type (has .data property)", () => {
        const field = userId();
        assert.ok("data" in (field as object));
    });

    void it("is tagged with the OVERTONE_USER_ID symbol", () => {
        const field = userId();
        // biome-ignore lint/suspicious/noExplicitAny: reading symbol from opaque Amplify field builder in test
        assert.strictEqual((field as any)[OVERTONE_USER_ID], true);
    });

    void it("is detected by isUserIdField()", () => {
        assert.strictEqual(isUserIdField(userId()), true);
    });

    void it("plain a.string() is NOT detected as userId", () => {
        assert.strictEqual(isUserIdField(a.string()), false);
        assert.strictEqual(isUserIdField(a.string().required()), false);
    });

    void it("a.email() is NOT detected as userId", () => {
        assert.strictEqual(isUserIdField(a.email()), false);
    });
});
