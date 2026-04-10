import { describe, expect, it } from "vitest";
import { escapeHtml, renderEmail } from "../../../src/email/templates/renderer.js";

describe("escapeHtml", () => {
    it('escapes <script>alert("xss")</script> correctly', () => {
        const result = escapeHtml(`<script>alert("xss")</script>`);
        expect(result).toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
    });

    it("passes through 'hello world' unchanged", () => {
        expect(escapeHtml("hello world")).toBe("hello world");
    });

    it("escapes & before < and > to avoid double-escaping", () => {
        expect(escapeHtml("a & b < c > d")).toBe("a &amp; b &lt; c &gt; d");
    });
});

describe("renderEmail", () => {
    it("renders core fields into HTML with base layout", () => {
        const result = renderEmail({ header: "Welcome", body: "Hello there." }, "TestBrand");
        expect(result.html).toContain("<!DOCTYPE html>");
        expect(result.html).toContain("Welcome");
        expect(result.html).toContain("Hello there.");
        expect(result.html).toContain("TestBrand");
    });

    it("renders plain text", () => {
        const result = renderEmail({ header: "Welcome", body: "Hello there." }, "TestBrand");
        expect(result.text).toContain("Welcome");
        expect(result.text).toContain("Hello there.");
    });

    it("renders CTA button in HTML", () => {
        const result = renderEmail(
            {
                header: "Invite",
                body: "You are invited.",
                callToActionLabel: "Accept",
                callToActionHref: "https://example.com",
            },
            "TestBrand",
        );
        expect(result.html).toContain('href="https://example.com"');
        expect(result.html).toContain("Accept");
    });

    it("renders footer", () => {
        const result = renderEmail(
            { header: "Hi", body: "Content.", footer: "Unsubscribe info." },
            "TestBrand",
        );
        expect(result.html).toContain("Unsubscribe info.");
        expect(result.text).toContain("Unsubscribe info.");
    });

    it("escapes HTML in all data values", () => {
        const result = renderEmail(
            { header: "<script>xss</script>", body: "Safe content." },
            "TestBrand",
        );
        expect(result.html).not.toContain("<script>xss</script>");
        expect(result.html).toContain("&lt;script&gt;");
    });

    it("throws when header is missing", () => {
        expect(() => renderEmail({ body: "Content." }, "Test")).toThrow();
    });

    it("throws when body is missing", () => {
        expect(() => renderEmail({ header: "Hi" }, "Test")).toThrow();
    });
});
