import type { ArgumentsDef, TemplateField } from "./types.js";

/** Cognito attribute name → PascalCase suffix for the flattened variable name. */
const COGNITO_ATTR_MAP: Record<string, string> = {
    name: "Name",
    email: "Email",
    givenName: "GivenName",
    familyName: "FamilyName",
};

/**
 * Creates a nested Proxy for a `n.userId()` argument.
 * Property accesses like `invitedBy.givenName` produce `"{{invitedByGivenName}}"`.
 */
function createUserIdProxy(argName: string): Record<string, string> {
    return new Proxy({} as Record<string, string>, {
        get: (_, prop) => {
            const suffix = COGNITO_ATTR_MAP[String(prop)];
            if (suffix) {
                return `{{${argName}${suffix}}}`;
            }
            return `{{${argName}${capitalize(String(prop))}}}`;
        },
    });
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Creates the Proxy args object passed to template callbacks.
 *
 * - `n.userId()` args → nested Proxy with Cognito attribute properties
 * - Plain args → `"{{argName}}"` string
 */
function createTemplateProxy(args: ArgumentsDef): Record<string, unknown> {
    return new Proxy({} as Record<string, unknown>, {
        get: (_, prop) => {
            const argName = String(prop);
            const def = args[argName];
            if (def?.resolveType === "cognitoUser") {
                return createUserIdProxy(argName);
            }
            return `{{${argName}}}`;
        },
    });
}

/**
 * Compiles a template field (static string or callback) into a `{{variable}}` template string.
 *
 * - Static strings pass through as-is.
 * - Callbacks are invoked with a Proxy that captures property accesses as `{{variable}}` placeholders.
 */
export function compileTemplateField(
    field: TemplateField,
    args: ArgumentsDef,
): string {
    if (typeof field === "string") return field;
    const proxy = createTemplateProxy(args);
    return field(proxy as Record<string, string>);
}
