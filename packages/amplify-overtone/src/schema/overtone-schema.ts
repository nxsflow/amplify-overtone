import { generateGraphqlSchema } from "./graphql-generator.js";
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
}
