import { emailAction } from "./email-action.js";
import { userId } from "./field-types.js";

/**
 * The `n` namespace — Overtone's extensions for Amplify.
 *
 * @example
 * ```ts
 * import { a } from "@aws-amplify/backend";
 * import { n } from "@nxsflow/amplify-overtone";
 *
 * const schema = a.schema({
 *   sendInvite: n.email({ sender: "noreply" })
 *     .arguments({ recipient: n.userId(), name: a.string().required() })
 *     .template({
 *       subject: ({ name }) => `Hello ${name}`,
 *       header: "Welcome",
 *       body: ({ name }) => `Hi ${name}, welcome!`,
 *     })
 *     .authorization(allow => [allow.authenticated()])
 * });
 * ```
 */
export const n = {
    email: emailAction,
    userId,
} as const;
