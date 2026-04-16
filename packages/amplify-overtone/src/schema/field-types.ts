// src/schema/field-types.ts
import { a } from "@aws-amplify/backend";
import { OVERTONE_USER_ID } from "./types.js";

/**
 * Declares a Cognito user ID argument.
 *
 * Returns `a.string().required()` decorated with a hidden symbol.
 * Amplify sees `String!` for GraphQL. Overtone detects the symbol
 * to trigger pipeline resolver Cognito user resolution.
 *
 * Derived fields in `.template()` callbacks:
 * - `{argName}.name` — Cognito `name`
 * - `{argName}.email` — Cognito `email`
 * - `{argName}.givenName` — Cognito `given_name`
 * - `{argName}.familyName` — Cognito `family_name`
 *
 * If the argument is named `recipient`, the resolved email is
 * automatically used as the To address.
 *
 * @internal
 */
// biome-ignore lint/suspicious/noExplicitAny: return type is an opaque Amplify field builder
export function userId(): any {
    const field = a.string().required();
    // biome-ignore lint/suspicious/noExplicitAny: attaching a symbol to an opaque Amplify field builder
    (field as any)[OVERTONE_USER_ID] = true;
    return field;
}

/** Detects whether a field was created by n.userId(). */
export function isUserIdField(field: unknown): boolean {
    // biome-ignore lint/suspicious/noExplicitAny: symbol access on unknown field builder
    return (field as any)?.[OVERTONE_USER_ID] === true;
}
