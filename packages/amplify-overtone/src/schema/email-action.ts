import { a } from "@aws-amplify/data-schema";
import { isUserIdField } from "./field-types.js";
import { compileTemplateField } from "./template-compiler.js";
import {
    OVERTONE_EMAIL_META,
    type CompiledTemplate,
    type EmailTemplateInput,
    type OvertoneEmailMeta,
} from "./types.js";

/**
 * Creates an email action compatible with `a.schema()`.
 *
 * Wraps `a.mutation()` and adds:
 * - `.template()` — compiles callbacks into {{variable}} strings
 * - Detects `n.userId()` arguments for pipeline resolver wiring
 * - Stores metadata on OVERTONE_EMAIL_META symbol
 */
export function emailAction(config: { sender?: string }) {
    // Start with a real Amplify mutation with default return type
    const mutation = (a.mutation() as any).returns(
        a.customType({ messageId: a.string() }),
    ) as any;

    const meta: OvertoneEmailMeta = {
        sender: config.sender,
        userIdArgNames: [],
        hasRecipientUserId: false,
    };

    function wrapWithProxy(target: any): any {
        const proxy = new Proxy(target, {
            get(t, prop, receiver) {
                // Return metadata when symbol is accessed
                if (prop === OVERTONE_EMAIL_META) {
                    return meta;
                }

                // Intercept .arguments() to detect n.userId() fields
                if (prop === "arguments") {
                    return (args: Record<string, unknown>) => {
                        meta.userIdArgNames = [];
                        for (const [name, field] of Object.entries(args)) {
                            if (isUserIdField(field)) {
                                meta.userIdArgNames.push(name);
                            }
                        }
                        meta.hasRecipientUserId =
                            meta.userIdArgNames.includes("recipient");

                        // Pass through to Amplify
                        const result = t.arguments(args);
                        return wrapWithProxy(result);
                    };
                }

                // Add .template() method
                if (prop === "template") {
                    return (templateInput: EmailTemplateInput) => {
                        meta.templateInput = templateInput;
                        meta.compiledTemplate = compileTemplate(
                            templateInput,
                            meta.userIdArgNames,
                        );
                        return proxy; // Return same proxy (template doesn't change Amplify state)
                    };
                }

                // Pass through all other methods (.authorization, .returns, .handler, etc.)
                const value = Reflect.get(t, prop, receiver);
                if (typeof value === "function") {
                    return (...fnArgs: unknown[]) => {
                        const result = value.apply(t, fnArgs);
                        // If the method returns a new object (chaining), wrap it too
                        if (result && typeof result === "object" && result !== t) {
                            return wrapWithProxy(result);
                        }
                        return result;
                    };
                }

                return value;
            },
        });

        return proxy;
    }

    return wrapWithProxy(mutation);
}

function compileTemplate(
    input: EmailTemplateInput,
    userIdArgNames: string[],
): CompiledTemplate {
    // Build a minimal args map for the template compiler
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
