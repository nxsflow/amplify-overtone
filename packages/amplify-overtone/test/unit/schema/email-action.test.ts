import assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { a } from "@aws-amplify/backend";
import { clearActionRegistry, getRegisteredActions } from "../../../src/schema/action-registry.js";
import { emailAction } from "../../../src/schema/email-action.js";
import { userId } from "../../../src/schema/field-types.js";
import type { OvertoneEmailMeta } from "../../../src/schema/types.js";
import { OVERTONE_EMAIL_META } from "../../../src/schema/types.js";

function getMeta(action: unknown): OvertoneEmailMeta {
    // biome-ignore lint/suspicious/noExplicitAny: accessing symbol from opaque proxy in test
    return (action as any)[OVERTONE_EMAIL_META];
}

void describe("action registry", () => {
    beforeEach(() => {
        clearActionRegistry();
    });

    afterEach(() => {
        clearActionRegistry();
    });

    void it("starts empty after clear", () => {
        assert.strictEqual(getRegisteredActions().length, 0);
    });

    void it("registers an action when .template() is called", () => {
        emailAction({ sender: "noreply" })
            .arguments({ name: a.string().required() })
            .template({ subject: "Hello", header: "Hi", body: "Welcome." });

        const actions = getRegisteredActions();
        assert.strictEqual(actions.length, 1);
    });

    void it("assigns unique IDs to multiple actions", () => {
        emailAction({ sender: "noreply" })
            .arguments({ name: a.string().required() })
            .template({ subject: "Hello", header: "Hi", body: "Welcome." });

        emailAction({ sender: "support" })
            .arguments({ name: a.string().required() })
            .template({ subject: "Support", header: "Hello", body: "Contact us." });

        const actions = getRegisteredActions();
        assert.strictEqual(actions.length, 2);

        const ids = actions.map((a) => a.id);
        assert.strictEqual(new Set(ids).size, 2);
        for (const id of ids) {
            assert.match(id, /^email-action-\d+$/);
        }
    });

    void it("stores compiled template in registry entry", () => {
        emailAction({ sender: "noreply" })
            .arguments({ recipient: userId(), projectName: a.string().required() })
            .template({
                // biome-ignore lint/suspicious/noExplicitAny: template args typed via Proxy at runtime
                subject: ({ projectName }: Record<string, any>) => `Invite to ${projectName}`,
                header: "Invitation",
                body: "You have been invited.",
            });

        const actions = getRegisteredActions();
        assert.strictEqual(actions.length, 1);

        const { meta } = actions[0]!;
        assert.strictEqual(meta.compiledTemplate?.subject, "Invite to {{projectName}}");
        assert.strictEqual(meta.compiledTemplate?.header, "Invitation");
        assert.strictEqual(meta.sender, "noreply");
        assert.ok(meta.userIdArgNames.includes("recipient"));
        assert.strictEqual(meta.hasRecipientUserId, true);
    });

    void it("writes a resolver file to the temp directory", () => {
        emailAction({ sender: "noreply" })
            .arguments({ name: a.string().required() })
            .template({ subject: "Hello", header: "Hi", body: "Welcome." });

        const actions = getRegisteredActions();
        assert.strictEqual(actions.length, 1);

        const actionId = actions[0]!.id;
        const expectedPath = path.join(os.tmpdir(), "overtone-resolvers", `${actionId}.js`);
        assert.ok(fs.existsSync(expectedPath));

        const content = fs.readFileSync(expectedPath, "utf8");
        assert.ok(content.includes(`actionId: "${actionId}"`));
        assert.ok(content.includes("export function request(ctx)"));
        assert.ok(content.includes("export function response(ctx)"));
    });
});

void describe("n.email()", () => {
    void it("is accepted by a.schema() as a mutation", () => {
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
        assert.notStrictEqual(schema, undefined);
    });

    void it("stores sender in Overtone metadata", () => {
        const emailOp = emailAction({ sender: "support" });
        assert.strictEqual(getMeta(emailOp).sender, "support");
    });

    void it("stores compiled template after .template() call", () => {
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
        assert.strictEqual(
            meta.compiledTemplate?.subject,
            "{{invitedByGivenName}} invited you to {{projectName}}",
        );
        assert.strictEqual(meta.compiledTemplate?.header, "Invitation");
        assert.strictEqual(meta.compiledTemplate?.body, "You are invited.");
    });

    void it("detects n.userId() arguments", () => {
        const emailOp = emailAction({ sender: "noreply" }).arguments({
            recipient: userId(),
            invitedBy: userId(),
            projectName: a.string().required(),
        });

        const meta = getMeta(emailOp);
        assert.ok(meta.userIdArgNames.includes("recipient"));
        assert.ok(meta.userIdArgNames.includes("invitedBy"));
        assert.ok(!meta.userIdArgNames.includes("projectName"));
    });

    void it("detects recipient convention", () => {
        const withRecipient = emailAction({ sender: "noreply" }).arguments({ recipient: userId() });
        assert.strictEqual(getMeta(withRecipient).hasRecipientUserId, true);

        const withoutRecipient = emailAction({ sender: "noreply" }).arguments({
            invitedBy: userId(),
        });
        assert.strictEqual(getMeta(withoutRecipient).hasRecipientUserId, false);
    });

    void it("passes .authorization() through to Amplify mutation", () => {
        const emailOp = emailAction({ sender: "noreply" })
            .arguments({ name: a.string().required() })
            .template({ subject: "Hi", header: "Hi", body: "Body." })
            // biome-ignore lint/suspicious/noExplicitAny: Amplify authorization callback type not publicly exported
            .authorization((allow: any) => [allow.authenticated()]);

        const schema = a.schema({ sendEmail: emailOp });
        assert.notStrictEqual(schema, undefined);
    });

    void it("transform() called twice produces consistent output", () => {
        const emailOp = emailAction({ sender: "noreply" })
            .arguments({ name: a.string().required() })
            .template({ subject: "Hi", header: "Hi", body: "Body." })
            // biome-ignore lint/suspicious/noExplicitAny: Amplify authorization callback type not publicly exported
            .authorization((allow: any) => [allow.authenticated()]);

        const schema = a.schema({ sendEmail: emailOp });
        // biome-ignore lint/suspicious/noExplicitAny: testing internal Amplify schema processing
        const result1 = (schema as any).transform();
        // biome-ignore lint/suspicious/noExplicitAny: testing internal Amplify schema processing
        const result2 = (schema as any).transform();

        // Both calls should produce the same schema string
        assert.strictEqual(result1.schema, result2.schema);

        // Log for debugging
        console.log("transform schema output:", result1.schema?.slice(0, 300));
    });

    void it("survives schema.transform() with plain args (CDK synthesis)", () => {
        const emailOp = emailAction({ sender: "noreply" })
            .arguments({ name: a.string().required() })
            .template({ subject: "Hi", header: "Hi", body: "Body." })
            // biome-ignore lint/suspicious/noExplicitAny: Amplify authorization callback type not publicly exported
            .authorization((allow: any) => [allow.authenticated()]);

        const schema = a.schema({ sendEmail: emailOp });
        // biome-ignore lint/suspicious/noExplicitAny: testing internal Amplify schema processing
        const result = (schema as any).transform();
        assert.notStrictEqual(result, undefined);
    });

    void it("survives schema.transform() with n.userId() args (CDK synthesis)", () => {
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
        assert.notStrictEqual(result, undefined);
    });
});
