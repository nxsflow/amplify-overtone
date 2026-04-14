import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { a } from "@aws-amplify/backend";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearActionRegistry, getRegisteredActions } from "../../../src/schema/action-registry.js";
import { emailAction } from "../../../src/schema/email-action.js";
import { userId } from "../../../src/schema/field-types.js";
import type { OvertoneEmailMeta } from "../../../src/schema/types.js";
import { OVERTONE_EMAIL_META } from "../../../src/schema/types.js";

function getMeta(action: unknown): OvertoneEmailMeta {
    // biome-ignore lint/suspicious/noExplicitAny: accessing symbol from opaque proxy in test
    return (action as any)[OVERTONE_EMAIL_META];
}

describe("action registry", () => {
    beforeEach(() => {
        clearActionRegistry();
    });

    afterEach(() => {
        clearActionRegistry();
    });

    it("starts empty after clear", () => {
        expect(getRegisteredActions()).toHaveLength(0);
    });

    it("registers an action when .template() is called", () => {
        emailAction({ sender: "noreply" })
            .arguments({ name: a.string().required() })
            .template({ subject: "Hello", header: "Hi", body: "Welcome." });

        const actions = getRegisteredActions();
        expect(actions).toHaveLength(1);
    });

    it("assigns unique IDs to multiple actions", () => {
        emailAction({ sender: "noreply" })
            .arguments({ name: a.string().required() })
            .template({ subject: "Hello", header: "Hi", body: "Welcome." });

        emailAction({ sender: "support" })
            .arguments({ name: a.string().required() })
            .template({ subject: "Support", header: "Hello", body: "Contact us." });

        const actions = getRegisteredActions();
        expect(actions).toHaveLength(2);

        const ids = actions.map((a) => a.id);
        expect(new Set(ids).size).toBe(2);
        for (const id of ids) {
            expect(id).toMatch(/^email-action-\d+$/);
        }
    });

    it("stores compiled template in registry entry", () => {
        emailAction({ sender: "noreply" })
            .arguments({ recipient: userId(), projectName: a.string().required() })
            .template({
                // biome-ignore lint/suspicious/noExplicitAny: template args typed via Proxy at runtime
                subject: ({ projectName }: Record<string, any>) => `Invite to ${projectName}`,
                header: "Invitation",
                body: "You have been invited.",
            });

        const actions = getRegisteredActions();
        expect(actions).toHaveLength(1);

        const { meta } = actions[0]!;
        expect(meta.compiledTemplate?.subject).toBe("Invite to {{projectName}}");
        expect(meta.compiledTemplate?.header).toBe("Invitation");
        expect(meta.sender).toBe("noreply");
        expect(meta.userIdArgNames).toContain("recipient");
        expect(meta.hasRecipientUserId).toBe(true);
    });

    it("writes a resolver file to the temp directory", () => {
        emailAction({ sender: "noreply" })
            .arguments({ name: a.string().required() })
            .template({ subject: "Hello", header: "Hi", body: "Welcome." });

        const actions = getRegisteredActions();
        expect(actions).toHaveLength(1);

        const actionId = actions[0]!.id;
        const expectedPath = path.join(os.tmpdir(), "overtone-resolvers", `${actionId}.js`);
        expect(fs.existsSync(expectedPath)).toBe(true);

        const content = fs.readFileSync(expectedPath, "utf8");
        expect(content).toContain(`actionId: "${actionId}"`);
        expect(content).toContain("export function request(ctx)");
        expect(content).toContain("export function response(ctx)");
    });
});

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

    it("survives schema.transform() with plain args (CDK synthesis)", () => {
        const emailOp = emailAction({ sender: "noreply" })
            .arguments({ name: a.string().required() })
            .template({ subject: "Hi", header: "Hi", body: "Body." })
            // biome-ignore lint/suspicious/noExplicitAny: Amplify authorization callback type not publicly exported
            .authorization((allow: any) => [allow.authenticated()]);

        const schema = a.schema({ sendEmail: emailOp });
        // biome-ignore lint/suspicious/noExplicitAny: testing internal Amplify schema processing
        const result = (schema as any).transform();
        expect(result).toBeDefined();
    });

    it("survives schema.transform() with n.userId() args (CDK synthesis)", () => {
        const emailOp = emailAction({ sender: "noreply" })
            .arguments({
                recipient: userId(),
                invitedBy: userId(),
                projectName: a.string().required(),
            })
            .template({
                subject: ({ invitedBy, projectName }: any) =>
                    `${invitedBy.givenName} invited you to ${projectName}`,
                header: ({ invitedBy }: any) => `${invitedBy.name} wants to collaborate`,
                body: ({ invitedBy, recipient, projectName }: any) =>
                    `${invitedBy.givenName} ${invitedBy.familyName} invited ${recipient.name} to ${projectName}.`,
                footer: "Footer text",
            })
            // biome-ignore lint/suspicious/noExplicitAny: Amplify authorization callback type not publicly exported
            .authorization((allow: any) => [allow.authenticated()]);

        const schema = a.schema({ sendInvite: emailOp });
        // biome-ignore lint/suspicious/noExplicitAny: testing internal Amplify schema processing
        const result = (schema as any).transform();
        expect(result).toBeDefined();
    });
});
