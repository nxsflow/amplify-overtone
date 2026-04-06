import { OvertoneSchema } from "./overtone-schema.js";
import type { EmailActionBuilder } from "./types.js";

/**
 * Collects email action definitions and produces an OvertoneSchema.
 */
export function schema(actions: Record<string, EmailActionBuilder>): OvertoneSchema {
    const compiled = Object.entries(actions).map(([name, builder]) => builder._compile(name));
    return new OvertoneSchema(compiled);
}
