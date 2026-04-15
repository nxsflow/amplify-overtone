import assert from "node:assert";
import { describe, it } from "node:test";
import { escapeHtml, renderEmail } from "../../../src/email/templates/renderer.js";

void describe("escapeHtml", () => {
    void it('escapes <script>alert("xss")</script> correctly', () => {
        const result = escapeHtml(`<script>alert("xss")</script>`);
        assert.strictEqual(result, "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
    });

    void it("passes through 'hello world' unchanged", () => {
        assert.strictEqual(escapeHtml("hello world"), "hello world");
    });

    void it("escapes & before < and > to avoid double-escaping", () => {
        assert.strictEqual(escapeHtml("a & b < c > d"), "a &amp; b &lt; c &gt; d");
    });
});

void describe("renderEmail", () => {
    void it("renders core fields into HTML with base layout", () => {
        const result = renderEmail({ header: "Welcome", body: "Hello there." }, "TestBrand");
        assert.ok(result.html.includes("<!DOCTYPE html>"));
        assert.ok(result.html.includes("Welcome"));
        assert.ok(result.html.includes("Hello there."));
        assert.ok(result.html.includes("TestBrand"));
    });

    void it("renders plain text", () => {
        const result = renderEmail({ header: "Welcome", body: "Hello there." }, "TestBrand");
        assert.ok(result.text.includes("Welcome"));
        assert.ok(result.text.includes("Hello there."));
    });

    void it("renders CTA button in HTML", () => {
        const result = renderEmail(
            {
                header: "Invite",
                body: "You are invited.",
                callToActionLabel: "Accept",
                callToActionHref: "https://example.com",
            },
            "TestBrand",
        );
        assert.ok(result.html.includes('href="https://example.com"'));
        assert.ok(result.html.includes("Accept"));
    });

    void it("renders footer", () => {
        const result = renderEmail(
            { header: "Hi", body: "Content.", footer: "Unsubscribe info." },
            "TestBrand",
        );
        assert.ok(result.html.includes("Unsubscribe info."));
        assert.ok(result.text.includes("Unsubscribe info."));
    });

    void it("escapes HTML in all data values", () => {
        const result = renderEmail(
            { header: "<script>xss</script>", body: "Safe content." },
            "TestBrand",
        );
        assert.ok(!result.html.includes("<script>xss</script>"));
        assert.ok(result.html.includes("&lt;script&gt;"));
    });

    void it("throws when header is missing", () => {
        assert.throws(() => renderEmail({ body: "Content." }, "Test"));
    });

    void it("throws when body is missing", () => {
        assert.throws(() => renderEmail({ header: "Hi" }, "Test"));
    });
});
