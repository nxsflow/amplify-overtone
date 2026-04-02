import { describe, expect, it } from "vitest";
import { createDomainOnlyTemplate, createEmailTemplate } from "./helpers.js";

// ---------------------------------------------------------------------------
// DNS record tests
// ---------------------------------------------------------------------------

describe("DNS — Mode 3 (domain + Route 53)", () => {
    const template = createEmailTemplate();

    it("creates 3 DKIM CNAME records", () => {
        const records = template.findResources("AWS::Route53::RecordSet", {
            Properties: { Type: "CNAME" },
        });
        expect(Object.keys(records)).toHaveLength(3);
    });

    it("creates an SPF TXT record", () => {
        template.hasResourceProperties("AWS::Route53::RecordSet", {
            Type: "TXT",
            ResourceRecords: ['"v=spf1 include:amazonses.com ~all"'],
        });
    });

    it("creates a DMARC TXT record", () => {
        template.hasResourceProperties("AWS::Route53::RecordSet", {
            Type: "TXT",
            ResourceRecords: ['"v=DMARC1; p=quarantine; adkim=s; aspf=s;"'],
        });
    });

    it("creates an MX record", () => {
        template.hasResourceProperties("AWS::Route53::RecordSet", {
            Type: "MX",
        });
    });
});

describe("DNS — Mode 2 (domain only, no Route 53)", () => {
    const template = createDomainOnlyTemplate();

    it("does NOT create Route 53 records", () => {
        template.resourceCountIs("AWS::Route53::RecordSet", 0);
    });

    it("outputs DKIM CNAME records as CfnOutput", () => {
        const outputs = template.toJSON().Outputs ?? {};
        const dkimOutputs = Object.keys(outputs).filter((k) => k.includes("DkimCname"));
        // 3 DKIM records x 2 outputs each (name + value) = 6
        expect(dkimOutputs.length).toBe(6);
    });

    it("outputs SPF record as CfnOutput", () => {
        const outputs = template.toJSON().Outputs ?? {};
        const spfOutputs = Object.keys(outputs).filter((k) => k.includes("SpfRecord"));
        expect(spfOutputs.length).toBeGreaterThanOrEqual(1);
    });

    it("outputs DMARC record as CfnOutput", () => {
        const outputs = template.toJSON().Outputs ?? {};
        const dmarcOutputs = Object.keys(outputs).filter((k) => k.includes("DmarcRecord"));
        expect(dmarcOutputs.length).toBeGreaterThanOrEqual(1);
    });

    it("outputs MX record as CfnOutput", () => {
        const outputs = template.toJSON().Outputs ?? {};
        const mxOutputs = Object.keys(outputs).filter((k) => k.includes("MxRecord"));
        expect(mxOutputs.length).toBeGreaterThanOrEqual(1);
    });
});
