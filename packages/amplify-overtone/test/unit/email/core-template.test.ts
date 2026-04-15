import assert from "node:assert";
import { describe, it } from "node:test";
import { coreTemplate } from "../../../src/email/templates/defaults/core.js";

void describe("coreTemplate", () => {
    void describe("renderHtml", () => {
        void it("renders header and body", () => {
            const html = coreTemplate.renderHtml(
                { header: "Welcome", body: "Hello there." },
                "TestBrand",
            );
            assert.ok(html.includes("Welcome"));
            assert.ok(html.includes("Hello there."));
        });

        void it("renders callToAction as a button when label and href provided", () => {
            const html = coreTemplate.renderHtml(
                {
                    header: "Invite",
                    body: "You are invited.",
                    callToActionLabel: "Accept",
                    callToActionHref: "https://example.com/accept",
                },
                "TestBrand",
            );
            assert.ok(html.includes("Accept"));
            assert.ok(html.includes('href="https://example.com/accept"'));
        });

        void it("omits callToAction section when no label/href provided", () => {
            const html = coreTemplate.renderHtml(
                { header: "Info", body: "Just a message." },
                "TestBrand",
            );
            assert.ok(!html.includes("<a "));
        });

        void it("omits callToAction when only label provided without href", () => {
            const html = coreTemplate.renderHtml(
                { header: "Hi", body: "Content.", callToActionLabel: "Click" },
                "TestBrand",
            );
            assert.ok(!html.includes("<a "));
        });

        void it("renders footer when provided", () => {
            const html = coreTemplate.renderHtml(
                { header: "Hi", body: "Content.", footer: "Unsubscribe info." },
                "TestBrand",
            );
            assert.ok(html.includes("Unsubscribe info."));
        });

        void it("throws when header is missing", () => {
            assert.throws(() => coreTemplate.renderHtml({ body: "Content." }, "TestBrand"), {
                message: /requires data.header/,
            });
        });

        void it("throws when body is missing", () => {
            assert.throws(() => coreTemplate.renderHtml({ header: "Hi" }, "TestBrand"), {
                message: /requires data.body/,
            });
        });
    });

    void describe("renderText", () => {
        void it("renders header and body as plain text", () => {
            const text = coreTemplate.renderText(
                { header: "Welcome", body: "Hello there." },
                "TestBrand",
            );
            assert.ok(text.includes("Welcome"));
            assert.ok(text.includes("Hello there."));
        });

        void it("includes CTA as labeled link", () => {
            const text = coreTemplate.renderText(
                {
                    header: "Invite",
                    body: "You are invited.",
                    callToActionLabel: "Accept",
                    callToActionHref: "https://example.com/accept",
                },
                "TestBrand",
            );
            assert.ok(text.includes("Accept: https://example.com/accept"));
        });

        void it("includes footer", () => {
            const text = coreTemplate.renderText(
                { header: "Hi", body: "Content.", footer: "Unsubscribe." },
                "TestBrand",
            );
            assert.ok(text.includes("Unsubscribe."));
        });

        void it("throws when header is missing", () => {
            assert.throws(() => coreTemplate.renderText({ body: "Content." }, "TestBrand"), {
                message: /requires data.header/,
            });
        });

        void it("throws when body is missing", () => {
            assert.throws(() => coreTemplate.renderText({ header: "Hi" }, "TestBrand"), {
                message: /requires data.body/,
            });
        });
    });
});
