import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Annotations, CfnOutput, Duration, Fn, Stack } from "aws-cdk-lib";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import {
    CnameRecord,
    HostedZone,
    type IHostedZone,
    MxRecord,
    TxtRecord,
} from "aws-cdk-lib/aws-route53";
import {
    CloudWatchDimensionSource,
    ConfigurationSet,
    DkimIdentity,
    EmailIdentity,
    EmailSendingEvent,
    EventDestination,
    Identity,
} from "aws-cdk-lib/aws-ses";
import {
    AwsCustomResource,
    AwsCustomResourcePolicy,
    PhysicalResourceId,
} from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import type { EmailProps, EmailResources, SenderWithEmail, SenderWithPrefix } from "./types.js";

// Find the package root by walking up from this file's directory until we find package.json.
// Works regardless of whether we're loaded from src/ (tsx) or dist/ (compiled),
// and regardless of symlinks (pnpm workspace, file: deps).
function findPackageRoot(startDir: string): string {
    let dir = startDir;
    while (dir !== path.dirname(dir)) {
        const pkgPath = path.join(dir, "package.json");
        if (existsSync(pkgPath)) {
            const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
            if (pkg.name === "@nxsflow/amplify-overtone") {
                return dir;
            }
        }
        dir = path.dirname(dir);
    }
    throw new Error("Could not find @nxsflow/amplify-overtone package root");
}

const PACKAGE_ROOT = findPackageRoot(path.dirname(fileURLToPath(import.meta.url)));
const HANDLER_DIR = path.join(PACKAGE_ROOT, "src", "email", "functions", "send");

/**
 * Internal sender representation passed to the Lambda as SENDERS_CONFIG.
 * The Lambda uses `email` to build the From address regardless of mode.
 */
interface NormalizedSender {
    email: string;
    displayName: string;
}

/**
 * CDK construct that provisions email infrastructure for an Amplify backend.
 *
 * Three configuration modes:
 *
 * **Mode 1 — No domain** (`domain` is undefined):
 *   - Senders provide `senderEmail` (full address)
 *   - Each sender email is verified as an SES identity
 *   - Warning about sender verification
 *
 * **Mode 2 — Domain only** (`domain` set, no `hostedZoneId`):
 *   - Senders provide `senderPrefix` (combined with domain)
 *   - SES EmailIdentity with EasyDKIM
 *   - DNS records output as CfnOutput for manual creation
 *   - Warning annotation about manual DNS setup
 *
 * **Mode 3 — Domain + Route 53** (`domain` + `hostedZoneId` + `hostedZoneDomain`):
 *   - Senders provide `senderPrefix` (combined with domain)
 *   - SES EmailIdentity with EasyDKIM
 *   - Automatic Route 53 DNS records (3 DKIM CNAMEs, SPF, DMARC, MX)
 */
export class AmplifyEmail extends Construct {
    public readonly resources: EmailResources;

    constructor(scope: Construct, id: string, props: EmailProps) {
        super(scope, id);

        const region = Stack.of(this).region;
        const account = Stack.of(this).account;

        const defaultSender = props.defaultSender ?? "noreply";
        const timeoutSeconds = props.timeoutSeconds ?? 15;
        const sandboxRecipients = props.sandboxRecipients ?? [];
        const domain = props.domain;

        // -----------------------------------------------------------------
        // Normalize senders to { email, displayName } for the Lambda
        // -----------------------------------------------------------------

        const normalizedSenders: Record<string, NormalizedSender> = {};

        if (domain) {
            // Mode 2 or 3: senders use senderPrefix + domain
            const senders: Record<string, SenderWithPrefix> = props.senders ?? {
                noreply: { senderPrefix: "noreply", displayName: "" },
            };
            for (const [key, sender] of Object.entries(senders)) {
                normalizedSenders[key] = {
                    email: `${sender.senderPrefix}@${domain}`,
                    displayName: sender.displayName,
                };
            }
        } else {
            // Mode 1: senders use senderEmail
            const senders = props.senders as Record<string, SenderWithEmail> | undefined;
            if (senders) {
                for (const [key, sender] of Object.entries(senders)) {
                    normalizedSenders[key] = {
                        email: sender.senderEmail,
                        displayName: sender.displayName,
                    };
                }
            }
        }

        // -----------------------------------------------------------------
        // SES ConfigurationSet (always created — tracks send/delivery/bounce)
        // -----------------------------------------------------------------

        const configurationSet = new ConfigurationSet(this, "ConfigurationSet", {
            reputationMetrics: true,
        });

        const dimensionDefault = domain ? domain.replace(/\./g, "-") : "ses-default";

        configurationSet.addEventDestination("CloudWatch", {
            destination: EventDestination.cloudWatchDimensions([
                {
                    name: "Domain",
                    source: CloudWatchDimensionSource.EMAIL_HEADER,
                    defaultValue: dimensionDefault,
                },
            ]),
            events: [
                EmailSendingEvent.SEND,
                EmailSendingEvent.DELIVERY,
                EmailSendingEvent.BOUNCE,
                EmailSendingEvent.COMPLAINT,
                EmailSendingEvent.REJECT,
                EmailSendingEvent.DELIVERY_DELAY,
            ],
        });

        // -----------------------------------------------------------------
        // Send-email Lambda
        // -----------------------------------------------------------------

        const sendFn = new NodejsFunction(this, "SendEmailFunction", {
            entry: path.join(HANDLER_DIR, "handler.ts"),
            handler: "handler",
            runtime: Runtime.NODEJS_22_X,
            timeout: Duration.seconds(timeoutSeconds),
            bundling: {
                externalModules: ["@aws-sdk/*"],
            },
            environment: {
                SENDERS_CONFIG: JSON.stringify(normalizedSenders),
                DEFAULT_SENDER: defaultSender,
                ...(domain ? { EMAIL_DOMAIN: domain } : {}),
            },
        });

        // -----------------------------------------------------------------
        // SES identity + DNS records (depends on mode)
        // -----------------------------------------------------------------

        let sesIdentityArn: string | undefined;

        if (domain && props.hostedZoneId && props.hostedZoneDomain) {
            // Mode 3: Domain + Route 53
            sesIdentityArn = this.setupDomainWithRoute53({
                sendFn,
                configurationSet,
                domain,
                hostedZoneId: props.hostedZoneId,
                hostedZoneDomain: props.hostedZoneDomain,
                sandboxRecipients,
                region,
                account,
            });
        } else if (domain) {
            // Mode 2: Domain only (manual DNS)
            sesIdentityArn = this.setupDomainOnly({
                sendFn,
                configurationSet,
                domain,
                sandboxRecipients,
                region,
                account,
            });
        } else {
            // Mode 1: No domain — verify individual sender addresses
            const senderEmails = Object.values(normalizedSenders).map((s) => s.email);

            for (const [key, sender] of Object.entries(normalizedSenders)) {
                new EmailIdentity(this, `SenderIdentity-${key}`, {
                    identity: Identity.email(sender.email),
                });
            }

            sendFn.addToRolePolicy(
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ["ses:SendEmail", "ses:SendRawEmail"],
                    resources: [
                        ...senderEmails.map(
                            (email) => `arn:aws:ses:${region}:${account}:identity/${email}`,
                        ),
                        ...sandboxRecipients.map(
                            (email) => `arn:aws:ses:${region}:${account}:identity/${email}`,
                        ),
                        `arn:aws:ses:${region}:${account}:configuration-set/${configurationSet.configurationSetName}`,
                    ],
                }),
            );

            if (senderEmails.length > 0) {
                Annotations.of(this).addWarning(
                    `No custom domain configured. SES verification emails will be sent to: ${senderEmails.join(", ")}. ` +
                        "Each sender must confirm the verification email before the application can send from that address. " +
                        "To avoid per-address verification, configure a custom domain on defineEmail().",
                );
            } else {
                Annotations.of(this).addWarning(
                    "No custom domain and no senders configured. " +
                        "SES requires verified sender identities to send email. " +
                        "Either configure senders with senderEmail or set a custom domain.",
                );
            }
        }

        // -----------------------------------------------------------------
        // Sandbox recipients: verify individual addresses
        // -----------------------------------------------------------------

        if (sandboxRecipients.length > 0) {
            for (const [i, email] of sandboxRecipients.entries()) {
                new EmailIdentity(this, `SandboxRecipient${i}`, {
                    identity: Identity.email(email),
                });
            }

            Annotations.of(this).addWarning(
                `SES sandbox mode: ${sandboxRecipients.length} recipient(s) will receive verification emails. ` +
                    "Confirm each address before sending test emails. " +
                    "Request production access to remove sandbox restrictions: " +
                    "https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html",
            );
        }

        // -----------------------------------------------------------------
        // SES sandbox mode check (AwsCustomResource)
        // -----------------------------------------------------------------

        const sandboxCheck = new AwsCustomResource(this, "SesSandboxCheck", {
            onCreate: {
                service: "SESV2",
                action: "GetAccount",
                physicalResourceId: PhysicalResourceId.of("ses-sandbox-check"),
                parameters: {},
            },
            onUpdate: {
                service: "SESV2",
                action: "GetAccount",
                physicalResourceId: PhysicalResourceId.of("ses-sandbox-check"),
                parameters: {},
            },
            policy: AwsCustomResourcePolicy.fromStatements([
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ["ses:GetAccount"],
                    resources: ["*"],
                }),
            ]),
        });

        new CfnOutput(this, "SesSandboxWarning", {
            value: sandboxCheck.getResponseField("ProductionAccessEnabled"),
            description:
                "SES production access status. If 'false', the account is in sandbox mode " +
                "and can only send to verified addresses. Request production access: " +
                "https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html",
        });

        // -----------------------------------------------------------------
        // Expose resources
        // -----------------------------------------------------------------

        this.resources = {
            lambda: sendFn,
            emailDomain: domain,
            sesIdentityArn,
            lambdaFunctionName: sendFn.functionName,
        };
    }

    // -----------------------------------------------------------------
    // Private: Mode 3 — Domain + Route 53
    // -----------------------------------------------------------------

    private setupDomainWithRoute53(opts: {
        sendFn: NodejsFunction;
        configurationSet: ConfigurationSet;
        domain: string;
        hostedZoneId: string;
        hostedZoneDomain: string;
        sandboxRecipients: string[];
        region: string;
        account: string;
    }): string {
        const {
            sendFn,
            configurationSet,
            domain,
            hostedZoneId,
            hostedZoneDomain,
            sandboxRecipients,
            region,
            account,
        } = opts;

        const hostedZone: IHostedZone = HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
            hostedZoneId,
            zoneName: hostedZoneDomain,
        });

        const emailIdentity = new EmailIdentity(this, "EmailIdentity", {
            identity: Identity.domain(domain),
            dkimIdentity: DkimIdentity.easyDkim(),
            configurationSet,
        });

        // --- DKIM CNAME records x 3 ---
        const mailSubdomain = domain.replace(`.${hostedZoneDomain}`, "");
        const dkimTokens = [
            {
                name: emailIdentity.dkimDnsTokenName1,
                value: emailIdentity.dkimDnsTokenValue1,
            },
            {
                name: emailIdentity.dkimDnsTokenName2,
                value: emailIdentity.dkimDnsTokenValue2,
            },
            {
                name: emailIdentity.dkimDnsTokenName3,
                value: emailIdentity.dkimDnsTokenValue3,
            },
        ];

        for (const [i, { name, value }] of dkimTokens.entries()) {
            const tokenHash = Fn.select(0, Fn.split(".", name));
            new CnameRecord(this, `DkimCname${i + 1}`, {
                zone: hostedZone,
                recordName: Fn.join(".", [tokenHash, "_domainkey", mailSubdomain]),
                domainName: value,
            });
        }

        // --- MX record ---
        new MxRecord(this, "MxRecord", {
            zone: hostedZone,
            recordName: domain,
            values: [{ priority: 10, hostName: `inbound-smtp.${region}.amazonaws.com` }],
        });

        // --- SPF TXT record ---
        new TxtRecord(this, "SpfRecord", {
            zone: hostedZone,
            recordName: domain,
            values: ["v=spf1 include:amazonses.com ~all"],
        });

        // --- DMARC TXT record ---
        new TxtRecord(this, "DmarcRecord", {
            zone: hostedZone,
            recordName: `_dmarc.${domain}`,
            values: ["v=DMARC1; p=quarantine; adkim=s; aspf=s;"],
        });

        // --- IAM: scoped SES send permission ---
        sendFn.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ["ses:SendEmail", "ses:SendRawEmail"],
                resources: [
                    `arn:aws:ses:${region}:${account}:identity/${domain}`,
                    ...sandboxRecipients.map(
                        (email) => `arn:aws:ses:${region}:${account}:identity/${email}`,
                    ),
                    `arn:aws:ses:${region}:${account}:configuration-set/${configurationSet.configurationSetName}`,
                ],
            }),
        );

        return `arn:aws:ses:${region}:${account}:identity/${domain}`;
    }

    // -----------------------------------------------------------------
    // Private: Mode 2 — Domain only (manual DNS)
    // -----------------------------------------------------------------

    private setupDomainOnly(opts: {
        sendFn: NodejsFunction;
        configurationSet: ConfigurationSet;
        domain: string;
        sandboxRecipients: string[];
        region: string;
        account: string;
    }): string {
        const { sendFn, configurationSet, domain, sandboxRecipients, region, account } = opts;

        const emailIdentity = new EmailIdentity(this, "EmailIdentity", {
            identity: Identity.domain(domain),
            dkimIdentity: DkimIdentity.easyDkim(),
            configurationSet,
        });

        // Output DNS records for manual creation
        for (let i = 1; i <= 3; i++) {
            const tokenName = emailIdentity[
                `dkimDnsTokenName${i}` as keyof typeof emailIdentity
            ] as string;
            const tokenValue = emailIdentity[
                `dkimDnsTokenValue${i}` as keyof typeof emailIdentity
            ] as string;

            new CfnOutput(this, `DkimCname${i}Name`, {
                value: tokenName,
                description: `DKIM CNAME record ${i} — name`,
            });
            new CfnOutput(this, `DkimCname${i}Value`, {
                value: tokenValue,
                description: `DKIM CNAME record ${i} — value`,
            });
        }

        new CfnOutput(this, "SpfRecord", {
            value: `${domain} TXT "v=spf1 include:amazonses.com ~all"`,
            description: "SPF TXT record",
        });

        new CfnOutput(this, "DmarcRecord", {
            value: `_dmarc.${domain} TXT "v=DMARC1; p=quarantine; adkim=s; aspf=s;"`,
            description: "DMARC TXT record",
        });

        new CfnOutput(this, "MxRecord", {
            value: `${domain} MX 10 inbound-smtp.${region}.amazonaws.com`,
            description: "MX record",
        });

        Annotations.of(this).addWarning(
            `Custom domain "${domain}" requires manual DNS configuration. ` +
                "Check the stack outputs for the required DNS records (DKIM CNAMEs, SPF, DMARC, MX). " +
                "Add these records at your DNS provider to complete domain verification.",
        );

        // --- IAM: scoped SES send permission ---
        sendFn.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ["ses:SendEmail", "ses:SendRawEmail"],
                resources: [
                    `arn:aws:ses:${region}:${account}:identity/${domain}`,
                    ...sandboxRecipients.map(
                        (email) => `arn:aws:ses:${region}:${account}:identity/${email}`,
                    ),
                    `arn:aws:ses:${region}:${account}:configuration-set/${configurationSet.configurationSetName}`,
                ],
            }),
        );

        return `arn:aws:ses:${region}:${account}:identity/${domain}`;
    }
}
