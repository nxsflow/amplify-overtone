import { AppsyncFunction, Code, FunctionRuntime } from "aws-cdk-lib/aws-appsync";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import type { IFunction } from "aws-cdk-lib/aws-lambda";
import type { Construct } from "constructs";
import { generateGraphqlSchema } from "./graphql-generator.js";
import {
    generateEmailInvokeCode,
    generateUserLookupCode,
    hasUserIdArgs,
} from "./resolver-generator.js";
import type { CompiledEmailAction } from "./types.js";

/**
 * Compiled schema with email actions ready for CDK wiring.
 *
 * Use `addToBackend(backend)` in your backend.ts to wire
 * email actions to the AppSync API.
 */
export class OvertoneSchema {
    readonly emailActions: CompiledEmailAction[];
    readonly graphqlSchema: string;

    constructor(emailActions: CompiledEmailAction[]) {
        this.emailActions = emailActions;
        this.graphqlSchema = generateGraphqlSchema(emailActions);
    }

    /**
     * Wire email actions into an Amplify Gen 2 backend.
     *
     * Extends the GraphQL schema, creates Lambda data sources for the
     * send-email and (when needed) user-lookup Lambdas, and adds a
     * JS resolver for each action.
     *
     * Actions that include `n.userId()` arguments get a **pipeline resolver**
     * with two AppSync functions:
     *   1. User-lookup function — resolves Cognito user data
     *   2. Email-invoke function — interpolates template and invokes SES Lambda
     *
     * Actions without `n.userId()` arguments get a **single-function resolver**.
     *
     * @param backend - The Amplify backend object (or compatible mock).
     * @param options - Optional configuration.
     * @param options.userPoolId - Cognito user pool ID, required when any action uses `n.userId()`.
     */
    addToBackend(
        backend: {
            data: {
                resources: {
                    graphqlApi?: unknown;
                    cfnResources: {
                        cfnGraphqlSchema: { definition: string };
                    };
                };
                addLambdaDataSource(id: string, fn: IFunction, ...args: unknown[]): unknown;
                addResolver(id: string, props: unknown): unknown;
            };
            email: {
                resources: {
                    lambda: IFunction;
                    userLookupLambda: IFunction;
                    senderKeys: string[];
                };
            };
        },
        options?: { userPoolId?: string },
    ): void {
        // Validate sender keys
        const validSenders = backend.email.resources.senderKeys;
        for (const action of this.emailActions) {
            if (!validSenders.includes(action.config.sender)) {
                throw new Error(
                    `Email action "${action.name}" references sender "${action.config.sender}" ` +
                        `which is not defined in defineEmail(). Available senders: ${validSenders.join(", ")}`,
                );
            }
        }

        const schema = backend.data.resources.cfnResources.cfnGraphqlSchema;
        schema.definition = `${schema.definition}\n\n${this.graphqlSchema}`;

        // Determine if any action needs userId resolution
        const anyUsesUserId = this.emailActions.some(hasUserIdArgs);

        // Create the send-email data source (always needed)
        const emailDS = backend.data.addLambdaDataSource(
            "OvertoneEmailDS",
            backend.email.resources.lambda,
        );

        // Create the user-lookup data source only when needed
        let userLookupDS: unknown;
        if (anyUsesUserId) {
            userLookupDS = backend.data.addLambdaDataSource(
                "OvertoneUserLookupDS",
                backend.email.resources.userLookupLambda,
            );

            // Add USER_POOL_ID to user-lookup Lambda environment if provided
            if (options?.userPoolId) {
                const fn = backend.email.resources.userLookupLambda;
                if ("addEnvironment" in fn && typeof fn.addEnvironment === "function") {
                    (fn as { addEnvironment(key: string, value: string): void }).addEnvironment(
                        "USER_POOL_ID",
                        options.userPoolId,
                    );
                }

                // Grant AdminGetUser permission
                if ("addToRolePolicy" in fn && typeof fn.addToRolePolicy === "function") {
                    (fn as { addToRolePolicy(policy: unknown): void }).addToRolePolicy(
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: ["cognito-idp:AdminGetUser"],
                            resources: [
                                `arn:aws:cognito-idp:*:*:userpool/${options.userPoolId}`,
                            ],
                        }),
                    );
                }
            }
        }

        // Get the underlying GraphQL API if available (needed for AppsyncFunction)
        const api = (backend.data.resources as Record<string, unknown>).graphqlApi;

        for (const action of this.emailActions) {
            if (hasUserIdArgs(action) && api && userLookupDS) {
                // Pipeline resolver: user-lookup → email-invoke
                // Use the api as the CDK scope for the AppsyncFunction constructs
                const scope = api as Construct;

                const lookupFn = new AppsyncFunction(scope, `${action.name}LookupFn`, {
                    name: `${action.name}LookupFn`,
                    api: api as never,
                    dataSource: userLookupDS as never,
                    runtime: FunctionRuntime.JS_1_0_0,
                    code: Code.fromInline(generateUserLookupCode(action)),
                });

                const invokeFn = new AppsyncFunction(scope, `${action.name}InvokeFn`, {
                    name: `${action.name}InvokeFn`,
                    api: api as never,
                    dataSource: emailDS as never,
                    runtime: FunctionRuntime.JS_1_0_0,
                    code: Code.fromInline(generateEmailInvokeCode(action)),
                });

                backend.data.addResolver(`${action.name}Resolver`, {
                    typeName: "Mutation",
                    fieldName: action.name,
                    pipelineConfig: [lookupFn, invokeFn],
                    runtime: FunctionRuntime.JS_1_0_0,
                    code: Code.fromInline(
                        "export function request(ctx) { return {}; }\nexport function response(ctx) { return ctx.prev.result; }",
                    ),
                });
            } else {
                // Single-function resolver (no userId args, or no graphqlApi available)
                backend.data.addResolver(`${action.name}Resolver`, {
                    typeName: "Mutation",
                    fieldName: action.name,
                    dataSource: emailDS,
                    runtime: FunctionRuntime.JS_1_0_0,
                    code: Code.fromInline(generateEmailInvokeCode(action)),
                });
            }
        }
    }
}
