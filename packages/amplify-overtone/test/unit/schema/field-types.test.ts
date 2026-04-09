import { describe, expect, it } from "vitest";
import { userId } from "../../../src/schema/field-types.js";

describe("n.userId()", () => {
    it("returns a required String FieldDef with resolveType 'cognitoUser'", () => {
        const field = userId();
        expect(field).toEqual({
            typeName: "String",
            required: true,
            isList: false,
            resolveType: "cognitoUser",
        });
    });

    it("is distinguishable from a plain string FieldDef", () => {
        const plain = { typeName: "String", required: true, isList: false };
        expect(userId().resolveType).toBe("cognitoUser");
        expect(plain).not.toHaveProperty("resolveType");
    });
});
