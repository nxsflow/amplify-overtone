import type { FieldDef } from "./types.js";

/**
 * Declares a Cognito user ID argument.
 *
 * At runtime, the user-lookup Lambda resolves this user ID to Cognito attributes.
 * Derived fields become available in `.template()` using the pattern `{argName}{Attribute}`:
 * - `{argName}Name` — Cognito `name`
 * - `{argName}Email` — Cognito `email`
 * - `{argName}GivenName` — Cognito `given_name`
 * - `{argName}FamilyName` — Cognito `family_name`
 *
 * If the argument is named `recipient`, the resolved email is automatically
 * used as the To address.
 */
export function userId(): FieldDef {
    return { typeName: "String", required: true, isList: false, resolveType: "cognitoUser" };
}
