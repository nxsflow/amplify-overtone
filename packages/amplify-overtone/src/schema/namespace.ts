import { emailAction } from "./email-action.js";
import { userId } from "./field-types.js";
import { schema } from "./schema-builder.js";

/**
 * The `n` namespace — Overtone's schema builder.
 *
 * @example
 * ```ts
 * import { n } from "@nxsflow/amplify-overtone";
 *
 * const emailSchema = n.schema({
 *   sendInvite: n.email({ sender: "noreply" })
 *     .arguments({
 *       recipient: n.userId(),
 *       projectName: { typeName: "String", required: true, isList: false },
 *     })
 *     .template({
 *       subject: ({ projectName }) => `Invite to ${projectName}`,
 *       header: "You've been invited!",
 *       body: ({ projectName }) => `Join us on ${projectName}.`,
 *     })
 *     .authorization(allow => [allow.authenticated()])
 * });
 * ```
 */
export const n = {
    email: emailAction,
    schema,
    userId,
} as const;
