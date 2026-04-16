export type {
    EmailDefinition,
    EmailProps,
    EmailResources,
    SendEmailPayload,
    SendEmailResult,
    SenderConfig,
    SenderWithEmail,
    SenderWithPrefix,
} from "./email/index.js";
export { defineEmail } from "./email/index.js";
export type {
    CallToActionInput,
    CognitoUserFields,
    CompiledCallToAction,
    CompiledTemplate,
    EmailTemplateInput,
    OvertoneEmailMeta,
    TemplateField,
} from "./schema/index.js";
export {
    emailAction,
    isUserIdField,
    n,
    OVERTONE_EMAIL_META,
    OVERTONE_USER_ID,
    userId,
} from "./schema/index.js";
