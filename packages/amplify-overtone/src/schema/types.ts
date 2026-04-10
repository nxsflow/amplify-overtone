// src/schema/types.ts

// ── Symbols ──────────────────────────────────────────────────────────

/** Symbol used to tag n.userId() fields for Overtone detection. */
export const OVERTONE_USER_ID: unique symbol = Symbol("overtone.userId");

/** Symbol used to store Overtone email metadata on CustomOperation objects. */
export const OVERTONE_EMAIL_META: unique symbol = Symbol("overtone.emailMeta");

// ── Template types (unchanged) ───────────────────────────────────────

/** Shape of a resolved n.userId() argument in template callbacks. */
export interface CognitoUserFields {
    name: string;
    email: string;
    givenName: string;
    familyName: string;
}

export type TemplateField =
    | string
    | ((args: Record<string, string | CognitoUserFields>) => string);

export interface CallToActionInput {
    label: TemplateField;
    href: TemplateField;
}

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

export interface CompiledTemplate {
    subject: string;
    header: string;
    body: string;
    callToAction?: CompiledCallToAction;
    footer?: string;
}

// ── Compiled email action (used by resolver-generator) ───────────────

export interface ArgumentDefinition {
    typeName: string;
    required: boolean;
    isList: boolean;
    resolveType?: "cognitoUser";
}

/** Fully compiled action passed to resolver-generator functions. */
export interface CompiledEmailAction {
    name: string;
    config: { sender?: string };
    compiledTemplate?: CompiledTemplate;
    arguments: Record<string, ArgumentDefinition>;
    returnType: Record<string, ArgumentDefinition>;
    authRules: unknown[];
}

// ── Overtone email metadata ──────────────────────────────────────────

/** Metadata stored on n.email() CustomOperation via OVERTONE_EMAIL_META symbol. */
export interface OvertoneEmailMeta {
    /** Sender key from defineEmail() senders map. */
    sender?: string;
    /** User-facing template input (callbacks or strings). */
    templateInput?: EmailTemplateInput;
    /** Compiled template (all callbacks resolved to {{variable}} strings). */
    compiledTemplate?: CompiledTemplate;
    /** Argument names that are n.userId() fields (need Cognito resolution). */
    userIdArgNames: string[];
    /** Whether an argument named "recipient" is a userId field. */
    hasRecipientUserId: boolean;
}
