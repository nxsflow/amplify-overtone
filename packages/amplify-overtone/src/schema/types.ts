// packages/amplify-overtone/src/schema/types.ts

/** Shape of a resolved n.userId() argument in template callbacks. */
export interface CognitoUserFields {
    name: string;
    email: string;
    givenName: string;
    familyName: string;
}

/**
 * A template field: static string or callback that receives all arguments.
 * n.userId() args are typed as CognitoUserFields, plain args as string.
 */
export type TemplateField =
    | string
    | ((args: Record<string, string | CognitoUserFields>) => string);

/**
 * Static or dynamic subject for an email action.
 *
 * - String: used as-is (e.g., `"Your confirmation code"`)
 * - Function: called at build time with a Proxy to produce a template string.
 *   Only simple template literal interpolation is supported.
 *
 * @example
 * subject: "Welcome!"
 * subject: ({ inviter }) => `${inviter} has invited you`
 */
export type EmailSubject = string | ((args: Record<string, string>) => string);

/**
 * Configuration passed to `n.email()`.
 */
export interface EmailActionConfig {
    /** Key from `defineEmail()` senders map. */
    sender: string;
    /** Built-in or user-provided template key. */
    template: string;
    /** Static string or template function for the email subject. */
    subject?: EmailSubject;
}

/**
 * Field definition for email action arguments and return types.
 * Uses a simplified field type system for GraphQL generation.
 */
export interface FieldDef {
    typeName: string;
    required: boolean;
    isList: boolean;
    /** When set, indicates this field needs runtime resolution. */
    resolveType?: "cognitoUser";
}

/**
 * Argument definitions for an email action.
 */
export type ArgumentsDef = Record<string, FieldDef>;

/**
 * Return type definition — inline custom type with fields.
 */
export type ReturnTypeDef = Record<string, FieldDef>;

/**
 * Authorization rule for email actions.
 */
export type AuthRule =
    | { strategy: "authenticated" }
    | { strategy: "owner" }
    | { strategy: "public"; provider?: "apiKey" | "iam" }
    | { strategy: "group"; groups: string[] };

/**
 * Compiled email action — all builder steps resolved.
 */
export interface CompiledEmailAction {
    name: string;
    config: EmailActionConfig;
    subjectTemplate: string;
    arguments: ArgumentsDef;
    returnType: ReturnTypeDef;
    authRules: AuthRule[];
}

/**
 * Schema definition passed to `n.schema()`.
 */
export type OvertoneSchemaDefinition = Record<string, EmailActionBuilder>;

/**
 * The EmailActionBuilder interface — returned by `n.email()`.
 */
export interface EmailActionBuilder {
    arguments(args: ArgumentsDef): EmailActionBuilder;
    returns(returnType: ReturnTypeDef): EmailActionBuilder;
    authorization(
        callback: (allow: AuthorizationAllow) => AuthRule | AuthRule[],
    ): EmailActionBuilder;
    /** @internal */
    _compile(name: string): CompiledEmailAction;
}

/**
 * Helper passed to authorization callback.
 */
export interface AuthorizationAllow {
    authenticated(): AuthRule;
    owner(): AuthRule;
    publicApiKey(): AuthRule;
    groups(groups: string[]): AuthRule;
}
