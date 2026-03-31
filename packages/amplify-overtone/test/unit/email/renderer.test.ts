import { describe, expect, it } from "vitest";
import { escapeHtml, renderTemplate } from "../../../src/email/templates/renderer.js";

describe("escapeHtml", () => {
    it('escapes <script>alert("xss")</script> correctly', () => {
        const result = escapeHtml(`<script>alert("xss")</script>`);
        expect(result).toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
    });

    it("passes through 'hello world' unchanged", () => {
        const result = escapeHtml("hello world");
        expect(result).toBe("hello world");
    });

    it("escapes & before < and > to avoid double-escaping", () => {
        const result = escapeHtml("a & b < c > d");
        expect(result).toBe("a &amp; b &lt; c &gt; d");
    });
});

describe("renderTemplate — confirmation-code", () => {
    it("returns correct subject, html containing code, and text containing code", () => {
        const result = renderTemplate("confirmation-code", { code: "123456" }, "TestBrand");
        expect(result.subject).toBe("Your confirmation code");
        expect(result.html).toContain("123456");
        expect(result.text).toContain("123456");
        expect(result.text).toContain("Your confirmation code is: 123456");
    });

    it("includes expiry text when expiresInMinutes is provided", () => {
        const result = renderTemplate(
            "confirmation-code",
            { code: "123456", expiresInMinutes: "15" },
            "TestBrand",
        );
        expect(result.html).toContain("15");
        expect(result.text).toContain("15 minutes");
    });
});

describe("renderTemplate — password-reset", () => {
    it("returns html with a link to the reset URL", () => {
        const result = renderTemplate(
            "password-reset",
            { resetLink: "https://example.com/reset" },
            "TestBrand",
        );
        expect(result.subject).toBe("Reset your password");
        expect(result.html).toContain("https://example.com/reset");
        expect(result.text).toContain("https://example.com/reset");
    });
});

describe("renderTemplate — invite", () => {
    it("returns html containing the inviter name", () => {
        const result = renderTemplate(
            "invite",
            { inviterName: "Alice", inviteLink: "https://example.com/invite" },
            "TestBrand",
        );
        expect(result.subject).toBe("You've been invited to collaborate");
        expect(result.html).toContain("Alice");
        expect(result.text).toContain("Alice");
    });

    it("includes optional resourceName when provided", () => {
        const result = renderTemplate(
            "invite",
            {
                inviterName: "Alice",
                inviteLink: "https://example.com/invite",
                resourceName: "ProjectX",
            },
            "TestBrand",
        );
        expect(result.html).toContain("ProjectX");
        expect(result.text).toContain("ProjectX");
    });
});

describe("renderTemplate — getting-started", () => {
    it("returns html when all data is optional (empty data)", () => {
        const result = renderTemplate("getting-started", {}, "TestBrand");
        expect(result.subject).toBe("Welcome — get started");
        expect(result.html).toBeTruthy();
        expect(result.text).toBeTruthy();
    });

    it("returns html containing userName when provided", () => {
        const result = renderTemplate(
            "getting-started",
            { userName: "Bob", dashboardLink: "https://example.com" },
            "TestBrand",
        );
        expect(result.html).toContain("Bob");
        expect(result.text).toContain("Bob");
        expect(result.html).toContain("https://example.com");
    });
});

describe("renderTemplate — XSS protection", () => {
    it("escapes HTML in data values — html should contain &lt;script&gt; not <script>", () => {
        const result = renderTemplate(
            "invite",
            { inviterName: "<script>xss</script>", inviteLink: "https://x.com" },
            "Test",
        );
        expect(result.html).not.toContain("<script>xss</script>");
        expect(result.html).toContain("&lt;script&gt;");
    });
});

describe("renderTemplate — error handling", () => {
    it("throws for unknown template key", () => {
        expect(() => renderTemplate("nonexistent", {}, "Test")).toThrow();
    });

    it("throws when required data is missing — confirmation-code without code", () => {
        expect(() => renderTemplate("confirmation-code", {}, "Test")).toThrow();
    });

    it("throws when required data is missing — password-reset without resetLink", () => {
        expect(() => renderTemplate("password-reset", {}, "Test")).toThrow();
    });

    it("throws when required data is missing — invite without inviterName", () => {
        expect(() => renderTemplate("invite", { inviteLink: "https://x.com" }, "Test")).toThrow();
    });

    it("throws when required data is missing — invite without inviteLink", () => {
        expect(() => renderTemplate("invite", { inviterName: "Alice" }, "Test")).toThrow();
    });
});

describe("renderTemplate — base HTML layout", () => {
    it("includes brand name in the HTML output", () => {
        const result = renderTemplate("confirmation-code", { code: "999" }, "MyBrand");
        expect(result.html).toContain("MyBrand");
    });

    it("returns a complete HTML document with DOCTYPE", () => {
        const result = renderTemplate("getting-started", {}, "AnyBrand");
        expect(result.html).toContain("<!DOCTYPE html>");
        expect(result.html).toContain("</html>");
    });
});
