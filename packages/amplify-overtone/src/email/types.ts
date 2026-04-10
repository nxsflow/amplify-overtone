import type { ConstructFactory, ResourceProvider } from "@aws-amplify/plugin-types";
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
// EmailProps
// ---------------------------------------------------------------------------

/**
 * Props for `defineEmail()`.
 *
 * Three configuration modes:
 *
 * 1. **No domain** — omit `domain`; senders provide full `senderEmail`, each verified as SES identity.
 * 2. **Domain only** — set `domain`; senders use `senderPrefix` + domain, DNS records output for manual creation.
 * 3. **Domain + Route 53** — set `domain`, `hostedZoneId`, and `hostedZoneDomain`; DNS records created automatically.
 */
export interface EmailProps {
    /**
     * Custom mail domain for sending (e.g., `"mail.nxsflow.com"`).
     *
     * When set, the construct creates an SES domain identity with EasyDKIM.
     * Senders use `senderPrefix` which is combined with this domain to form
     * the full email address (e.g., `noreply` + `mail.nxsflow.com` → `noreply@mail.nxsflow.com`).
     *
     * When omitted, senders must provide a full `senderEmail` address and
     * each address is individually verified as an SES identity.
     *
     * @example "mail.nxsflow.com"
     */
    domain?: string;

    /**
     * Route 53 hosted zone ID for automatic DNS record creation.
     *
     * When provided together with `hostedZoneDomain`, the construct automatically
     * creates all required DNS records (3 DKIM CNAMEs, SPF TXT, DMARC TXT, MX)
     * in the specified Route 53 hosted zone.
     *
     * The hosted zone must be in the same AWS account as the deployment.
     * Requires `domain` to be set.
     *
     * When omitted, DNS records are output as CloudFormation outputs for
     * manual creation at your DNS provider (Cloudflare, Namecheap, etc.).
     *
     * @example "Z0123456789ABCDEFGHIJ"
     */
    hostedZoneId?: string;

    /**
     * Root domain of the Route 53 hosted zone (e.g., `"nxsflow.com"`).
     *
     * Used to compute relative DNS record names. For example, if `domain` is
     * `"mail.nxsflow.com"` and `hostedZoneDomain` is `"nxsflow.com"`,
     * DKIM records are created under `_domainkey.mail` within the zone.
     *
     * Must be provided together with `hostedZoneId`. Requires `domain` to be set.
     *
     * @example "nxsflow.com"
     */
    hostedZoneDomain?: string;

    /**
     * Named email senders.
     *
     * - **With `domain`**: each sender uses {@link SenderWithPrefix} — `senderPrefix`
     *   is combined with the domain to form the full address.
     * - **Without `domain`**: each sender uses {@link SenderWithEmail} — `senderEmail`
     *   is a full email address, verified as an SES identity.
     *
     * When omitted with a domain, a single `"noreply"` sender is created.
     * When omitted without a domain, you must verify sender addresses manually in the SES console.
     *
     * @example With domain
     * ```ts
     * senders: {
     *   noreply: { senderPrefix: "noreply", displayName: "NexusFlow" },
     *   support: { senderPrefix: "support", displayName: "NexusFlow Support" },
     * }
     * ```
     *
     * @example Without domain
     * ```ts
     * senders: {
     *   noreply: { senderEmail: "noreply@gmail.com", displayName: "MyApp" },
     * }
     * ```
     */
    senders?: Record<string, SenderConfig>;

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

// ---------------------------------------------------------------------------
// Lambda payload types (shared across packages)
// ---------------------------------------------------------------------------

/**
 * Payload for the send-email Lambda function.
 *
 * Contains pre-resolved core email fields. The AppSync resolver interpolates
 * user arguments into these fields before invoking the Lambda.
 */
export interface SendEmailPayload {
    /** Full recipient email address. */
    to: string;
    /** Key from the senders map. Defaults to the `defaultSender` configured on `defineEmail()`. */
    sender?: string;
    /** Email subject line (pre-interpolated by the resolver). */
    subject: string;
    /** Header text rendered at the top of the email. */
    header: string;
    /** Body text — the main content of the email. */
    body: string;
    /** Optional call-to-action button. */
    callToAction?: { label: string; href: string };
    /** Optional footer text rendered below the body. */
    footer?: string;
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

    /** The user-lookup Lambda (for n.userId() Cognito resolution). */
    userLookupLambda: IFunction;

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

    /** User-lookup Lambda function name. */
    userLookupFunctionName: string;

    /** Configured sender keys (e.g., ["noreply", "support"]). Used by addToBackend() for validation. */
    senderKeys: string[];
}

/**
 * Return type of {@link defineEmail}.
 *
 * Pass this to `defineBackend()` to include email in your Amplify backend.
 * This type is opaque — consumers do not need `@aws-amplify/plugin-types`
 * installed to use it.
 */
export type EmailDefinition = ConstructFactory<ResourceProvider<EmailResources>>;
