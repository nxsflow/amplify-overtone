// packages/amplify-overtone/src/schema/subject-compiler.ts
import type { EmailSubject } from "./types.js";

/**
 * Compiles an email subject into a template string with `{{variable}}` placeholders.
 *
 * - `undefined` → `""`
 * - `string` → passed through as-is
 * - `function` → called with a Proxy that records property accesses as `{{propName}}`
 */
export function compileSubject(subject: EmailSubject | undefined): string {
    if (subject === undefined) return "";
    if (typeof subject === "string") return subject;

    const proxy = new Proxy({} as Record<string, string>, {
        get: (_, prop) => `{{${String(prop)}}}`,
    });
    return subject(proxy);
}
