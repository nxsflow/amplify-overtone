// src/schema/resolver-wiring.ts
import { Code, FunctionRuntime } from "aws-cdk-lib/aws-appsync";
import type { IFunction } from "aws-cdk-lib/aws-lambda";
import { generateEmailInvokeCode, type ResolverAction } from "./resolver-generator.js";
import { OVERTONE_EMAIL_META, type OvertoneEmailMeta } from "./types.js";

export interface ExtractedEmailAction {
    name: string;
    meta: OvertoneEmailMeta;
}

/**
 * Scans schema entries for objects tagged with OVERTONE_EMAIL_META.
 * Pass the schema definition object (the argument to `a.schema()`).
 */
export function extractEmailActions(
    schemaEntries: Record<string, unknown>,
): ExtractedEmailAction[] {
    const actions: ExtractedEmailAction[] = [];

    for (const [name, entry] of Object.entries(schemaEntries)) {
        // biome-ignore lint/suspicious/noExplicitAny: symbol indexing on unknown Amplify schema object
        const meta = (entry as any)?.[OVERTONE_EMAIL_META] as OvertoneEmailMeta | undefined;
        if (meta) {
            actions.push({ name, meta });
        }
    }

    return actions;
}

/**
 * Wires email action resolvers into an Amplify Gen 2 backend.
 *
 * Call after `defineBackend()`. Creates AppSync resolvers for each
 * extracted email action. Actions with n.userId() args get pipeline
 * resolvers; others get single-function resolvers.
 */
export function addEmailResolvers(
    backend: {
        data: {
            addLambdaDataSource(id: string, fn: IFunction, ...args: unknown[]): unknown;
            addResolver(id: string, props: unknown): unknown;
        };
        email: {
            resources: {
                sendLambda: IFunction;
                userLookupLambda: IFunction;
                senderKeys: string[];
            };
        };
    },
    emailActions: ExtractedEmailAction[],
    options?: { userPoolId?: string },
): void {
    if (emailActions.length === 0) return;

    // Validate senders
    const validSenders = backend.email.resources.senderKeys;
    for (const action of emailActions) {
        if (action.meta.sender && !validSenders.includes(action.meta.sender)) {
            throw new Error(
                `Email action "${action.name}" references sender "${action.meta.sender}" ` +
                    `which is not defined in defineEmail(). Available senders: ${validSenders.join(", ")}`,
            );
        }
    }

    // Create email Lambda data source
    const emailDS = backend.data.addLambdaDataSource(
        "OvertoneEmailDS",
        backend.email.resources.sendLambda,
    );

    // Check if any action needs userId resolution
    const hasAnyUserIdArgs = emailActions.some((a) => a.meta.userIdArgNames.length > 0);

    if (hasAnyUserIdArgs) {
        const _userLookupDS = backend.data.addLambdaDataSource(
            "OvertoneUserLookupDS",
            backend.email.resources.userLookupLambda,
        );

        if (options?.userPoolId) {
            const fn = backend.email.resources.userLookupLambda;
            // biome-ignore lint/suspicious/noExplicitAny: IFunction from CDK doesn't expose addEnvironment in types
            (fn as any).addEnvironment?.("USER_POOL_ID", options.userPoolId);
        }
    }

    // Create resolvers
    for (const action of emailActions) {
        const template = action.meta.compiledTemplate;
        if (!template) continue;

        // Build resolver action for code generation
        const resolverAction: ResolverAction = {
            name: action.name,
            config: action.meta.sender !== undefined ? { sender: action.meta.sender } : {},
            compiledTemplate: template,
            userIdArgNames: action.meta.userIdArgNames,
            hasRecipientUserId: action.meta.hasRecipientUserId,
        };

        backend.data.addResolver(`${action.name}Resolver`, {
            typeName: "Mutation",
            fieldName: action.name,
            dataSource: emailDS,
            runtime: FunctionRuntime.JS_1_0_0,
            code: Code.fromInline(generateEmailInvokeCode(resolverAction)),
        });
    }
}
