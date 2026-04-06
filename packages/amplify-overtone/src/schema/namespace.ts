import { emailAction } from "./email-action.js";
import { schema } from "./schema-builder.js";

/**
 * The `n` namespace — Overtone's schema builder.
 *
 * @example
 * ```ts
 * import { n } from "@nxsflow/amplify-overtone";
 *
 * const emailSchema = n.schema({
 *   inviteEmail: n.email({ sender: "noreply", template: "invite" })
 *     .arguments({ recipientEmail: { typeName: "AWSEmail", required: true, isList: false } })
 *     .authorization(allow => [allow.authenticated()])
 * });
 * ```
 */
export const n = {
    email: emailAction,
    schema,
} as const;
