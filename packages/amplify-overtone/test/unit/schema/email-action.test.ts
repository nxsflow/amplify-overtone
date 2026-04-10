import { a } from "@aws-amplify/data-schema";
import { describe, expect, it } from "vitest";
import { emailAction } from "../../../src/schema/email-action.js";
import { userId } from "../../../src/schema/field-types.js";
import type { OvertoneEmailMeta } from "../../../src/schema/types.js";
import { OVERTONE_EMAIL_META } from "../../../src/schema/types.js";

function getMeta(action: unknown): OvertoneEmailMeta {
    // biome-ignore lint/suspicious/noExplicitAny: accessing symbol from opaque proxy in test
    return (action as any)[OVERTONE_EMAIL_META];
}

describe("n.email()", () => {
    it("is accepted by a.schema() as a mutation", () => {
        const emailOp = emailAction({ sender: "noreply" })
            .arguments({ name: a.string().required() })
            .template({
                subject: "Hello",
                header: "Hi",
                body: "Welcome.",
            })
            // biome-ignore lint/suspicious/noExplicitAny: Amplify authorization callback type not publicly exported
            .authorization((allow: any) => [allow.authenticated()]);

        // Should not throw — a.schema() accepts it as a CustomOperation
        const schema = a.schema({ sendEmail: emailOp });
        expect(schema).toBeDefined();
    });

    it("stores sender in Overtone metadata", () => {
        const emailOp = emailAction({ sender: "support" });
        expect(getMeta(emailOp).sender).toBe("support");
    });

    it("stores compiled template after .template() call", () => {
        const emailOp = emailAction({ sender: "noreply" })
            .arguments({
                invitedBy: userId(),
                projectName: a.string().required(),
            })
            .template({
                // biome-ignore lint/suspicious/noExplicitAny: template args typed via Proxy at runtime
                subject: ({ invitedBy, projectName }: Record<string, any>) =>
                    `${invitedBy.givenName} invited you to ${projectName}`,
                header: "Invitation",
                body: "You are invited.",
            });

        const meta = getMeta(emailOp);
        expect(meta.compiledTemplate?.subject).toBe(
            "{{invitedByGivenName}} invited you to {{projectName}}",
        );
        expect(meta.compiledTemplate?.header).toBe("Invitation");
        expect(meta.compiledTemplate?.body).toBe("You are invited.");
    });

    it("detects n.userId() arguments", () => {
        const emailOp = emailAction({ sender: "noreply" }).arguments({
            recipient: userId(),
            invitedBy: userId(),
            projectName: a.string().required(),
        });

        const meta = getMeta(emailOp);
        expect(meta.userIdArgNames).toContain("recipient");
        expect(meta.userIdArgNames).toContain("invitedBy");
        expect(meta.userIdArgNames).not.toContain("projectName");
    });

    it("detects recipient convention", () => {
        const withRecipient = emailAction({ sender: "noreply" }).arguments({ recipient: userId() });
        expect(getMeta(withRecipient).hasRecipientUserId).toBe(true);

        const withoutRecipient = emailAction({ sender: "noreply" }).arguments({
            invitedBy: userId(),
        });
        expect(getMeta(withoutRecipient).hasRecipientUserId).toBe(false);
    });

    it("passes .authorization() through to Amplify mutation", () => {
        const emailOp = emailAction({ sender: "noreply" })
            .arguments({ name: a.string().required() })
            .template({ subject: "Hi", header: "Hi", body: "Body." })
            // biome-ignore lint/suspicious/noExplicitAny: Amplify authorization callback type not publicly exported
            .authorization((allow: any) => [allow.authenticated()]);

        const schema = a.schema({ sendEmail: emailOp });
        expect(schema).toBeDefined();
    });
});
