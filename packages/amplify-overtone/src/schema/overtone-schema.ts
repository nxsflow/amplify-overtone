import { Code, FunctionRuntime } from "aws-cdk-lib/aws-appsync";
import type { IFunction } from "aws-cdk-lib/aws-lambda";
import { generateGraphqlSchema } from "./graphql-generator.js";
import { generateResolverCode } from "./resolver-generator.js";
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
     * Extends the GraphQL schema, creates a shared Lambda data source
     * for the email Lambda, and adds a JS resolver for each action.
     */
    addToBackend(backend: {
        data: {
            resources: {
                cfnResources: {
                    cfnGraphqlSchema: { definition: string };
                };
            };
            addLambdaDataSource(id: string, fn: IFunction, ...args: unknown[]): unknown;
            addResolver(id: string, props: unknown): unknown;
        };
        email: {
            resources: { lambda: IFunction; senderKeys: string[] };
        };
    }): void {
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

        const dataSource = backend.data.addLambdaDataSource(
            "OvertoneEmailDS",
            backend.email.resources.lambda,
        );

        for (const action of this.emailActions) {
            backend.data.addResolver(`${action.name}Resolver`, {
                typeName: "Mutation",
                fieldName: action.name,
                dataSource,
                runtime: FunctionRuntime.JS_1_0_0,
                code: Code.fromInline(generateResolverCode(action)),
            });
        }
    }
}
