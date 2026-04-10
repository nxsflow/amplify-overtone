/**
 * @nxsflow/amplify-overtone-client
 *
 * Client runtime for Amplify Overtone.
 *
 * Currently a thin re-export of Amplify's `generateClient` from `aws-amplify/data`.
 * Since `n.email()` actions are standard Amplify mutations (via `a.mutation()`),
 * the generated client already includes typed methods for all email actions.
 *
 * @example
 * ```ts
 * import { generateClient } from "@nxsflow/amplify-overtone-client";
 * import type { Schema } from "../amplify/data/resource";
 *
 * const client = generateClient<Schema>();
 *
 * const { data } = await client.mutations.sendInvite({
 *     recipient: "user-sub-123",
 *     invitedBy: "user-sub-456",
 *     projectName: "MyProject",
 * });
 *
 * console.log(data?.messageId);
 * ```
 */
export { generateClient } from "aws-amplify/data";
