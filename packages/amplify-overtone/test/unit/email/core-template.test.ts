import { describe, expect, it } from "vitest";
import { coreTemplate } from "../../../src/email/templates/defaults/core.js";

describe("coreTemplate", () => {
    describe("renderHtml", () => {
        it("renders header and body", () => {
            const html = coreTemplate.renderHtml(
                { header: "Welcome", body: "Hello there." },
                "TestBrand",
            );
            expect(html).toContain("Welcome");
            expect(html).toContain("Hello there.");
        });

        it("renders callToAction as a button when label and href provided", () => {
            const html = coreTemplate.renderHtml(
                {
                    header: "Invite",
                    body: "You are invited.",
                    callToActionLabel: "Accept",
                    callToActionHref: "https://example.com/accept",
                },
                "TestBrand",
            );
            expect(html).toContain("Accept");
            expect(html).toContain('href="https://example.com/accept"');
        });

        it("omits callToAction section when no label/href provided", () => {
            const html = coreTemplate.renderHtml(
                { header: "Info", body: "Just a message." },
                "TestBrand",
            );
            expect(html).not.toContain("<a ");
        });

        it("omits callToAction when only label provided without href", () => {
            const html = coreTemplate.renderHtml(
                { header: "Hi", body: "Content.", callToActionLabel: "Click" },
                "TestBrand",
            );
            expect(html).not.toContain("<a ");
        });

        it("renders footer when provided", () => {
            const html = coreTemplate.renderHtml(
                { header: "Hi", body: "Content.", footer: "Unsubscribe info." },
                "TestBrand",
            );
            expect(html).toContain("Unsubscribe info.");
        });

        it("throws when header is missing", () => {
            expect(() => coreTemplate.renderHtml({ body: "Content." }, "TestBrand")).toThrow(
                "requires data.header",
            );
        });

        it("throws when body is missing", () => {
            expect(() => coreTemplate.renderHtml({ header: "Hi" }, "TestBrand")).toThrow(
                "requires data.body",
            );
        });
    });

    describe("renderText", () => {
        it("renders header and body as plain text", () => {
            const text = coreTemplate.renderText(
                { header: "Welcome", body: "Hello there." },
                "TestBrand",
            );
            expect(text).toContain("Welcome");
            expect(text).toContain("Hello there.");
        });

        it("includes CTA as labeled link", () => {
            const text = coreTemplate.renderText(
                {
                    header: "Invite",
                    body: "You are invited.",
                    callToActionLabel: "Accept",
                    callToActionHref: "https://example.com/accept",
                },
                "TestBrand",
            );
            expect(text).toContain("Accept: https://example.com/accept");
        });

        it("includes footer", () => {
            const text = coreTemplate.renderText(
                { header: "Hi", body: "Content.", footer: "Unsubscribe." },
                "TestBrand",
            );
            expect(text).toContain("Unsubscribe.");
        });

        it("throws when header is missing", () => {
            expect(() => coreTemplate.renderText({ body: "Content." }, "TestBrand")).toThrow(
                "requires data.header",
            );
        });

        it("throws when body is missing", () => {
            expect(() => coreTemplate.renderText({ header: "Hi" }, "TestBrand")).toThrow(
                "requires data.body",
            );
        });
    });
});
