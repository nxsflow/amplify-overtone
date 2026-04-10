// packages/amplify-overtone/src/schema/types.ts

/** Symbol used to tag n.userId() fields for Overtone detection. */
export const OVERTONE_USER_ID: unique symbol = Symbol("overtone.userId");

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
export type TemplateField = string | ((args: Record<string, string | CognitoUserFields>) => string);

/** Call-to-action definition — each field is a TemplateField. */
export interface CallToActionInput {
    label: TemplateField;
    href: TemplateField;
}

/** User-facing template definition passed to .template(). */
export interface EmailTemplateInput {
    subject: TemplateField;
    header: TemplateField;
    body: TemplateField;
    callToAction?: CallToActionInput;
    footer?: TemplateField;
}

export interface CompiledCallToAction {
    label: string;
    href: string;
}

/** Compiled template — all callbacks resolved to {{variable}} strings. */
export interface CompiledTemplate {
    subject: string;
    header: string;
    body: string;
    callToAction?: CompiledCallToAction;
    footer?: string;
}

/**
 * Configuration passed to `n.email()`.
 */
export interface EmailActionConfig {
    /** Key from `defineEmail()` senders map. */
    sender?: string;
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
    compiledTemplate?: CompiledTemplate;
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
    template(def: EmailTemplateInput): EmailActionBuilder;
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
