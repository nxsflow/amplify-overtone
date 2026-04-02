import type {
    ConstructFactory,
    ResourceProvider,
} from "@aws-amplify/plugin-types";
import type { IFunction } from "aws-cdk-lib/aws-lambda";

// ---------------------------------------------------------------------------
// Sender configuration
// ---------------------------------------------------------------------------

/**
 * Sender configuration when a custom domain is set on `defineEmail()`.
 *
 * The full "From" address is built as `"${displayName}" <${senderPrefix}@${domain}>`,
 * where `domain` comes from the `defineEmail()` configuration.
 *
 * @example
 * ```ts
 * defineEmail({
 *   domain: "mail.nxsflow.com",
 *   senders: {
 *     noreply: { senderPrefix: "noreply", displayName: "NexusFlow" },
 *     support: { senderPrefix: "support", displayName: "NexusFlow Support" },
 *   },
 * });
 * // → "NexusFlow" <noreply@mail.nxsflow.com>
 * // → "NexusFlow Support" <support@mail.nxsflow.com>
 * ```
 */
export interface SenderWithPrefix {
    /**
     * Prefix of the sender email address — the portion before the `@` sign.
     *
     * Combined with the `domain` from `defineEmail()` to form the full sender
     * address (e.g., `noreply` + `mail.nxsflow.com` → `noreply@mail.nxsflow.com`).
     *
     * @example "noreply"
     * @example "support"
     */
    senderPrefix: string;

    /**
     * Display name shown in email clients.
     *
     * Appears as the sender name in the recipient's inbox (e.g., "NexusFlow").
     * Also used as the brand name in the built-in email template header.
     *
     * @example "NexusFlow" → "NexusFlow" <noreply@mail.nxsflow.com>
     */
    displayName: string;
}

/**
 * Sender configuration when no custom domain is set on `defineEmail()`.
 *
 * Requires a full email address. The construct registers this address as a
 * verified SES identity, and SES sends a verification email that must be
 * confirmed before the application can send from this address.
 *
 * @example
 * ```ts
 * defineEmail({
 *   senders: {
 *     noreply: { senderEmail: "noreply@gmail.com", displayName: "MyApp" },
 *   },
 * });
 * // → "MyApp" <noreply@gmail.com>
 * // → noreply@gmail.com is created as a verified SES identity
 * ```
 */
export interface SenderWithEmail {
    /**
     * Full email address to send from (e.g., `noreply@gmail.com`).
     *
     * The construct creates an SES `EmailIdentity` for this address so SES
     * can send from it. A verification email is sent to this address — it
     * must be confirmed before the application can send emails.
     *
     * @example "noreply@gmail.com"
     * @example "notifications@mycompany.com"
     */
    senderEmail: string;

    /**
     * Display name shown in email clients.
     *
     * Appears as the sender name in the recipient's inbox (e.g., "MyApp").
     * Also used as the brand name in the built-in email template header.
     *
     * @example "MyApp" → "MyApp" <noreply@gmail.com>
     */
    displayName: string;
}

/**
 * Sender configuration — either prefix-based (with custom domain) or
 * full email (without custom domain).
 */
export type SenderConfig = SenderWithPrefix | SenderWithEmail;

// ---------------------------------------------------------------------------
// EmailProps — discriminated union
// ---------------------------------------------------------------------------

/**
 * Shared properties available in all `defineEmail()` configurations.
 */
interface EmailPropsBase {
    /**
     * Key from the `senders` map to use when no sender is explicitly specified.
     *
     * Must match a key in `senders`. If `senders` is omitted, this defaults to
     * `"noreply"` (matching the auto-created default sender).
     *
     * @default "noreply"
     */
    defaultSender?: string;

    /**
     * Email addresses to register as verified SES identities.
     *
     * Use this when your SES account is in sandbox mode — SES can only send to
     * verified addresses. Each address receives a verification email from AWS
     * that must be confirmed before it can receive emails from your application.
     *
     * Has no effect when the SES account is in production mode.
     *
     * @example ["tester@example.com", "qa@example.com"]
     */
    sandboxRecipients?: string[];

    /**
     * Timeout for the send-email Lambda in seconds.
     *
     * @default 15
     */
    timeoutSeconds?: number;
}

/**
 * Configuration without a custom domain.
 *
 * SES requires each sender address to be individually verified. Senders must
 * provide a full email address via `senderEmail`. The construct creates an
 * SES identity for each sender and sends a verification email.
 *
 * @example
 * ```ts
 * const email = defineEmail({
 *   senders: {
 *     noreply: { senderEmail: "noreply@gmail.com", displayName: "MyApp" },
 *   },
 * });
 * ```
 */
interface EmailPropsNoDomain extends EmailPropsBase {
    /** Custom mail domain for sending — omit to use individual sender verification instead. */
    domain?: undefined;
    /** Route 53 hosted zone ID — only applicable when `domain` is set. */
    hostedZoneId?: undefined;
    /** Root domain of the hosted zone — only applicable when `domain` is set. */
    hostedZoneDomain?: undefined;

    /**
     * Named email senders with full email addresses.
     *
     * Each sender requires `senderEmail` (a full email address) since there is
     * no custom domain. The construct verifies each address as an SES identity.
     *
     * When omitted, you must verify sender addresses manually in the SES console.
     *
     * @example
     * ```ts
     * senders: {
     *   noreply: { senderEmail: "noreply@gmail.com", displayName: "MyApp" },
     * }
     * ```
     */
    senders?: Record<string, SenderWithEmail>;
}

/**
 * Configuration with a custom domain but no Route 53 hosted zone.
 *
 * The construct creates the SES domain identity and generates DKIM tokens,
 * but does NOT create DNS records. The required DNS records (DKIM, SPF,
 * DMARC, MX) are output as CloudFormation outputs for manual creation
 * at your DNS provider (Cloudflare, Namecheap, etc.).
 *
 * @example
 * ```ts
 * const email = defineEmail({
 *   domain: "mail.example.com",
 *   senders: { noreply: { senderPrefix: "noreply", displayName: "MyApp" } },
 * });
 * // → Check stack outputs for DNS records to add at your DNS provider
 * ```
 */
interface EmailPropsDomainOnly extends EmailPropsBase {
    /** Custom mail domain for sending (e.g., `"mail.nxsflow.com"`). */
    domain: string;
    /** Route 53 hosted zone ID — omit to manage DNS records manually at your DNS provider. */
    hostedZoneId?: undefined;
    /** Root domain of the hosted zone — omit to manage DNS records manually. */
    hostedZoneDomain?: undefined;

    /**
     * Named email senders with prefix-based addresses.
     *
     * Each sender uses `senderPrefix` which is combined with the custom `domain`
     * to form the full email address (e.g., `noreply` → `noreply@mail.nxsflow.com`).
     *
     * When omitted, a single `"noreply"` sender is created with an empty display name.
     *
     * @example
     * ```ts
     * senders: {
     *   noreply: { senderPrefix: "noreply", displayName: "NexusFlow" },
     *   support: { senderPrefix: "support", displayName: "NexusFlow Support" },
     * }
     * ```
     */
    senders?: Record<string, SenderWithPrefix>;
}

/**
 * Configuration with a custom domain and Route 53 hosted zone.
 *
 * The construct creates the SES domain identity AND automatically provisions
 * all required DNS records (3 DKIM CNAMEs, SPF TXT, DMARC TXT, MX) in the
 * specified Route 53 hosted zone.
 *
 * The hosted zone must be in the same AWS account. For cross-account hosted
 * zones or external DNS providers, omit `hostedZoneId` and `hostedZoneDomain`
 * and create the DNS records manually from the stack outputs.
 *
 * @example
 * ```ts
 * const email = defineEmail({
 *   domain: "mail.nxsflow.com",
 *   hostedZoneId: "Z0123456789ABCDEFGHIJ",
 *   hostedZoneDomain: "nxsflow.com",
 *   senders: { noreply: { senderPrefix: "noreply", displayName: "NexusFlow" } },
 * });
 * ```
 */
interface EmailPropsDomainWithRoute53 extends EmailPropsBase {
    /** Custom mail domain for sending (e.g., "mail.nxsflow.com"). */
    domain: string;
    /**
     * Route 53 hosted zone ID for automatic DNS record creation.
     *
     * Must be provided together with `hostedZoneDomain`. The hosted zone
     * must be in the same AWS account as the deployment.
     */
    hostedZoneId: string;
    /**
     * Root domain of the hosted zone (e.g., "nxsflow.com").
     *
     * Used to compute relative record names. For example, if `domain` is
     * `"mail.nxsflow.com"` and `hostedZoneDomain` is `"nxsflow.com"`,
     * DKIM records are created under `_domainkey.mail` within the zone.
     */
    hostedZoneDomain: string;

    /**
     * Named email senders with prefix-based addresses.
     *
     * Each sender uses `senderPrefix` which is combined with the custom `domain`
     * to form the full email address (e.g., `noreply` → `noreply@mail.nxsflow.com`).
     *
     * When omitted, a single `"noreply"` sender is created with an empty display name.
     *
     * @example
     * ```ts
     * senders: {
     *   noreply: { senderPrefix: "noreply", displayName: "NexusFlow" },
     *   support: { senderPrefix: "support", displayName: "NexusFlow Support" },
     * }
     * ```
     */
    senders?: Record<string, SenderWithPrefix>;
}

/**
 * Props for `defineEmail()`.
 *
 * Three configuration modes:
 * 1. **No domain** — senders provide full `senderEmail`, each verified as SES identity
 * 2. **Domain only** — senders use `senderPrefix` + domain, DNS records output for manual creation
 * 3. **Domain + Route 53** — senders use `senderPrefix` + domain, DNS records created automatically
 */
export type EmailProps = EmailPropsNoDomain | EmailPropsDomainOnly | EmailPropsDomainWithRoute53;

// ---------------------------------------------------------------------------
// Lambda payload types (shared across packages)
// ---------------------------------------------------------------------------

/**
 * Built-in email template keys.
 */
export type EmailTemplateName =
    | "confirmation-code"
    | "password-reset"
    | "invite"
    | "getting-started";

/**
 * Payload for the send-email Lambda function.
 *
 * Used by integration tests, schema action resolvers (Spec B), and
 * any code that invokes the Lambda directly.
 *
 * @example
 * ```ts
 * const payload: SendEmailPayload = {
 *   template: "invite",
 *   to: "colleague@example.com",
 *   data: {
 *     inviterName: "Alice",
 *     inviteLink: "https://app.example.com/invite/abc",
 *   },
 * };
 * ```
 */
export interface SendEmailPayload {
    /** Built-in template to render. */
    template: EmailTemplateName;
    /** Full recipient email address. */
    to: string;
    /** Key from the senders map. Defaults to the `defaultSender` configured on `defineEmail()`. */
    sender?: string;
    /** Template-specific data values. All values are HTML-escaped before rendering. */
    data: Record<string, string>;
}

/**
 * Response from the send-email Lambda function.
 */
export interface SendEmailResult {
    /** SES message ID. */
    messageId: string | undefined;
}

// ---------------------------------------------------------------------------
// Resources exposed after construct instantiation
// ---------------------------------------------------------------------------

export interface EmailResources {
    /** The send-email Lambda function (for grantInvoke, addEnvironment). */
    lambda: IFunction;

    /**
     * The custom mail domain, or `undefined` when no domain is configured.
     *
     * @example "mail.nxsflow.com"
     */
    emailDomain: string | undefined;

    /**
     * SES domain identity ARN, or `undefined` when no custom domain is configured.
     *
     * Use as Cognito `emailConfiguration.sourceArn` to send auth emails from
     * your custom domain.
     *
     * @example "arn:aws:ses:us-east-1:123456789012:identity/mail.nxsflow.com"
     */
    sesIdentityArn: string | undefined;

    /** Send-email Lambda function name — used in Amplify outputs for client discovery. */
    lambdaFunctionName: string;
}

/**
 * Return type of {@link defineEmail}.
 *
 * Pass this to `defineBackend()` to include email in your Amplify backend.
 * This type is opaque — consumers do not need `@aws-amplify/plugin-types`
 * installed to use it.
 */
export type EmailDefinition = ConstructFactory<
    ResourceProvider<EmailResources>
>;
