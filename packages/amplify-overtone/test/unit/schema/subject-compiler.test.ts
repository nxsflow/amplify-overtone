// packages/amplify-overtone/test/unit/schema/subject-compiler.test.ts
import { describe, expect, it } from "vitest";
import { compileSubject } from "../../../src/schema/subject-compiler.js";

describe("compileSubject", () => {
    it("passes through a static string", () => {
        expect(compileSubject("Hello")).toBe("Hello");
    });

    it("compiles a single-variable template function", () => {
        const fn = ({ inviter }: Record<string, string>) => `${inviter} has invited you`;
        expect(compileSubject(fn)).toBe("{{inviter}} has invited you");
    });

    it("compiles a multi-variable template function", () => {
        const fn = ({ inviter, documentName }: Record<string, string>) =>
            `${inviter} shared ${documentName} with you`;
        expect(compileSubject(fn)).toBe("{{inviter}} shared {{documentName}} with you");
    });

    it("defaults to empty string when subject is undefined", () => {
        expect(compileSubject(undefined)).toBe("");
    });
});
