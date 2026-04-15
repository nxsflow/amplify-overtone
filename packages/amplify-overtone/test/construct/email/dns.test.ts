import assert from "node:assert";
import { describe, it } from "node:test";
import { createDomainOnlyTemplate, createEmailTemplate } from "./helpers.js";

// ---------------------------------------------------------------------------
// DNS record tests
// ---------------------------------------------------------------------------

void describe("DNS — Mode 3 (domain + Route 53)", () => {
    const template = createEmailTemplate();

    void it("creates 3 DKIM CNAME records", () => {
        const records = template.findResources("AWS::Route53::RecordSet", {
            Properties: { Type: "CNAME" },
        });
        assert.strictEqual(Object.keys(records).length, 3);
    });

    void it("creates an SPF TXT record", () => {
        template.hasResourceProperties("AWS::Route53::RecordSet", {
            Type: "TXT",
            ResourceRecords: ['"v=spf1 include:amazonses.com ~all"'],
        });
    });

    void it("creates a DMARC TXT record", () => {
        template.hasResourceProperties("AWS::Route53::RecordSet", {
            Type: "TXT",
            ResourceRecords: ['"v=DMARC1; p=quarantine; adkim=s; aspf=s;"'],
        });
    });

    void it("creates an MX record", () => {
        template.hasResourceProperties("AWS::Route53::RecordSet", {
            Type: "MX",
        });
    });
});

void describe("DNS — Mode 2 (domain only, no Route 53)", () => {
    const template = createDomainOnlyTemplate();

    void it("does NOT create Route 53 records", () => {
        template.resourceCountIs("AWS::Route53::RecordSet", 0);
    });

    void it("outputs DKIM CNAME records as CfnOutput", () => {
        const outputs = template.toJSON().Outputs ?? {};
        const dkimOutputs = Object.keys(outputs).filter((k) => k.includes("DkimCname"));
        // 3 DKIM records x 2 outputs each (name + value) = 6
        assert.strictEqual(dkimOutputs.length, 6);
    });

    void it("outputs SPF record as CfnOutput", () => {
        const outputs = template.toJSON().Outputs ?? {};
        const spfOutputs = Object.keys(outputs).filter((k) => k.includes("SpfRecord"));
        assert.ok(spfOutputs.length >= 1);
    });

    void it("outputs DMARC record as CfnOutput", () => {
        const outputs = template.toJSON().Outputs ?? {};
        const dmarcOutputs = Object.keys(outputs).filter((k) => k.includes("DmarcRecord"));
        assert.ok(dmarcOutputs.length >= 1);
    });

    void it("outputs MX record as CfnOutput", () => {
        const outputs = template.toJSON().Outputs ?? {};
        const mxOutputs = Object.keys(outputs).filter((k) => k.includes("MxRecord"));
        assert.ok(mxOutputs.length >= 1);
    });
});
