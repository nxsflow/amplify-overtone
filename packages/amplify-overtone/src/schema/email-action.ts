import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { a } from "@aws-amplify/data-schema";
import { registerEmailAction } from "./action-registry.js";
import { isUserIdField } from "./field-types.js";
import { compileTemplateField } from "./template-compiler.js";
import {
    type CompiledTemplate,
    type EmailTemplateInput,
    OVERTONE_EMAIL_META,
    type OvertoneEmailMeta,
} from "./types.js";

let actionCounter = 0;

/**
 * Creates an email action compatible with `a.schema()`.
 *
 * Returns an object that wraps `a.mutation()` and delegates all builder
 * methods to it (`.arguments()`, `.authorization()`, `.returns()`, etc.).
 * Adds `.template()` for email-specific template compilation.
 *
 * Methods modify internal state and return `this` — same pattern as `a.model()`.
 * The underlying mutation object is exposed to `a.schema()` via symbol access.
 */
export function emailAction(config: { sender?: string }) {
    // biome-ignore lint/suspicious/noExplicitAny: Amplify mutation builder types are not publicly exposed
    let mutation: any = (a.mutation() as any).returns(a.customType({ messageId: a.string() }));

    const meta: OvertoneEmailMeta = {
        ...(config.sender !== undefined ? { sender: config.sender } : {}),
        userIdArgNames: [],
        hasRecipientUserId: false,
    };

    const emailBuilder = {
        /** Access the underlying mutation — used by a.schema() internals. */
        get data() {
            return mutation.data;
        },

        /** Overtone metadata symbol — used by the email factory. */
        [OVERTONE_EMAIL_META]: meta,

        /** Define mutation arguments. Detects n.userId() fields. */
        arguments(args: Record<string, unknown>) {
            meta.userIdArgNames = [];
            for (const [name, field] of Object.entries(args)) {
                if (isUserIdField(field)) {
                    meta.userIdArgNames.push(name);
                }
            }
            meta.hasRecipientUserId = meta.userIdArgNames.includes("recipient");
            mutation = mutation.arguments(args);
            return this;
        },

        /** Compile email template and wire handler. */
        template(templateInput: EmailTemplateInput) {
            meta.templateInput = templateInput;
            meta.compiledTemplate = compileTemplate(templateInput, meta.userIdArgNames);

            const actionId = `email-action-${++actionCounter}`;
            registerEmailAction(actionId, meta);

            const resolverFilePath = writeResolverFile(actionId);
            mutation = mutation.handler(
                a.handler.custom({
                    dataSource: "OvertoneEmailDS",
                    entry: resolverFilePath,
                }),
            );

            return this;
        },

        /** Pass through to Amplify mutation. */
        authorization(authFn: unknown) {
            mutation = mutation.authorization(authFn);
            return this;
        },

        /** Pass through to Amplify mutation. */
        returns(returnType: unknown) {
            mutation = mutation.returns(returnType);
            return this;
        },

        /** Pass through to Amplify mutation. */
        handler(handlerRef: unknown) {
            mutation = mutation.handler(handlerRef);
            return this;
        },
    };

    return emailBuilder;
}

function writeResolverFile(actionId: string): string {
    const resolversDir = path.join(os.tmpdir(), "overtone-resolvers");
    fs.mkdirSync(resolversDir, { recursive: true });

    const filePath = path.join(resolversDir, `${actionId}.js`);
    const content = `export function request(ctx) {
  return {
    operation: "Invoke",
    payload: {
      actionId: "${actionId}",
      fieldName: ctx.info.fieldName,
      arguments: ctx.args,
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    return util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result;
}
`;
    fs.writeFileSync(filePath, content, "utf8");
    return filePath;
}

function compileTemplate(input: EmailTemplateInput, userIdArgNames: string[]): CompiledTemplate {
    const fakeArgs: Record<string, { resolveType?: "cognitoUser" }> = {};
    for (const name of userIdArgNames) {
        fakeArgs[name] = { resolveType: "cognitoUser" };
    }

    const compiled: CompiledTemplate = {
        subject: compileTemplateField(input.subject, fakeArgs),
        header: compileTemplateField(input.header, fakeArgs),
        body: compileTemplateField(input.body, fakeArgs),
    };

    if (input.callToAction) {
        compiled.callToAction = {
            label: compileTemplateField(input.callToAction.label, fakeArgs),
            href: compileTemplateField(input.callToAction.href, fakeArgs),
        };
    }

    if (input.footer) {
        compiled.footer = compileTemplateField(input.footer, fakeArgs);
    }

    return compiled;
}
