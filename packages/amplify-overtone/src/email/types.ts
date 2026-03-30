import type { IFunction } from "aws-cdk-lib/aws-lambda";

/**
 * Configuration for a named email sender.
 *
 * Senders are referenced by key in schema-defined email actions (Spec B).
 * The full "From" address is built as: `"${displayName}" <${localPart}@${domain}>`.
 *
 * @example
 * ```ts
 * const senders = {
 *   noreply: { localPart: "noreply", displayName: "NexusFlow" },
 *   support: { localPart: "support", displayName: "NexusFlow Support" },
 * };
 * ```
 */
export interface SenderConfig {
    /**
     * Local part of the email address — the portion before the `@` sign.
     *
     * Combined with the `domain` from `defineEmail()` to form the full sender
     * address. When no custom domain is configured, this is used as-is with
     * the SES default domain.
     *
     * @example "noreply" → noreply@notifications.nxsflowemail.com
     */
    localPart: string;

    /**
     * Display name shown in email clients (e.g., "NexusFlow").
     *
     * Appears as the sender name in the recipient's inbox. Also used as the
     * brand name in the built-in email template header.
     *
     * @example "NexusFlow" → "NexusFlow" <noreply@notifications.nxsflowemail.com>
     */
    displayName: string;
}

/**
 * Shared properties available in all `defineEmail()` configurations.
 */
interface EmailPropsBase {
    /**
     * Named email senders.
     *
     * Keys are identifiers referenced by schema-defined email actions (Spec B).
     * Values configure the sender address and display name.
     *
     * When omitted, a single `"noreply"` sender is created with an empty display name.
     *
     * @default `{ noreply: { localPart: "noreply", displayName: "" } }`
     *
     * @example
     * ```ts
     * senders: {
     *   noreply: { localPart: "noreply", displayName: "NexusFlow" },
     *   support: { localPart: "support", displayName: "NexusFlow Support" },
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

/**
 * Configuration without a custom domain.
 *
 * SES uses its default `amazonses.com` MAIL FROM domain. No DNS setup required.
 * Emails are sent but lack custom DKIM/DMARC alignment.
 *
 * @example
 * ```ts
 * const email = defineEmail({});
 * const email = defineEmail({ senders: { noreply: { localPart: "noreply", displayName: "MyApp" } } });
 * ```
 */
interface EmailPropsNoDomain extends EmailPropsBase {
    domain?: undefined;
    hostedZoneId?: undefined;
    hostedZoneDomain?: undefined;
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
 *   senders: { noreply: { localPart: "noreply", displayName: "MyApp" } },
 * });
 * // → Check stack outputs for DNS records to add at your DNS provider
 * ```
 */
interface EmailPropsDomainOnly extends EmailPropsBase {
    /** Custom mail domain for sending (e.g., "mail.nxsflow.com"). */
    domain: string;
    hostedZoneId?: undefined;
    hostedZoneDomain?: undefined;
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
 *   senders: { noreply: { localPart: "noreply", displayName: "NexusFlow" } },
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
}

/**
 * Props for `defineEmail()`.
 *
 * Three configuration modes:
 * 1. **No domain** — SES default, no DNS needed
 * 2. **Domain only** — SES identity created, DNS records output for manual creation
 * 3. **Domain + Route 53** — SES identity + automatic DNS record creation
 */
export type EmailProps =
    | EmailPropsNoDomain
    | EmailPropsDomainOnly
    | EmailPropsDomainWithRoute53;

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
