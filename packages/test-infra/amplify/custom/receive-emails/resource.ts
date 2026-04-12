import { Fn, Stack } from "aws-cdk-lib";
import { Effect, PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { type IFunction, Function as LambdaFunction } from "aws-cdk-lib/aws-lambda";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { CnameRecord, HostedZone, MxRecord } from "aws-cdk-lib/aws-route53";
import { Bucket, type IBucket } from "aws-cdk-lib/aws-s3";
import {
    CfnReceiptRule,
    CfnReceiptRuleSet,
    DkimIdentity,
    EmailIdentity,
    Identity,
} from "aws-cdk-lib/aws-ses";
import {
    AwsCustomResource,
    AwsCustomResourcePolicy,
    PhysicalResourceId,
} from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";

interface ReceiveEmailsProps {
    recipientDomain?: string;
    hostedZoneId?: string;
    hostedZoneDomain?: string;
    emailBucket: IBucket;
    emailRouter: IFunction;
}

export class ReceiveEmails extends Construct {
    constructor(scope: Construct, id: string, props: ReceiveEmailsProps) {
        super(scope, id);
        const { recipientDomain, hostedZoneDomain, hostedZoneId } = props;

        if (!recipientDomain || !hostedZoneId || !hostedZoneDomain)
            throw new Error(
                "Missing required context. Provide recipientDomain, hostedZoneId, and hostedZoneDomain.",
            );

        if (!(props.emailBucket instanceof Bucket))
            throw new Error("emailBucket is not an instance of Bucket");

        if (!(props.emailRouter instanceof LambdaFunction))
            throw new Error("emailRouter is not an instance of Function (Lambda)");

        const { account, region } = Stack.of(this);

        const hostedZone = HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
            hostedZoneId,
            zoneName: hostedZoneDomain,
        });

        // ── Email Receipt Infrastructure ──────────────────────────────────

        const emailBucket = props.emailBucket as Bucket;
        emailBucket.addToResourcePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                principals: [new ServicePrincipal("ses.amazonaws.com")],
                actions: ["s3:PutObject"],
                resources: [emailBucket.arnForObjects("*")],
                conditions: {
                    StringEquals: {
                        "AWS:SourceAccount": account,
                    },
                },
            }),
        );

        // SES requires the recipient domain to be a verified identity for inbound email.
        // DKIM records in Route 53 complete the domain verification automatically.
        const recipientIdentity = new EmailIdentity(this, "RecipientDomainIdentity", {
            identity: Identity.domain(recipientDomain),
            dkimIdentity: DkimIdentity.easyDkim(),
        });

        const mailSubdomain = recipientDomain.replace(`.${hostedZoneDomain}`, "");
        const dkimTokens = [
            {
                name: recipientIdentity.dkimDnsTokenName1,
                value: recipientIdentity.dkimDnsTokenValue1,
            },
            {
                name: recipientIdentity.dkimDnsTokenName2,
                value: recipientIdentity.dkimDnsTokenValue2,
            },
            {
                name: recipientIdentity.dkimDnsTokenName3,
                value: recipientIdentity.dkimDnsTokenValue3,
            },
        ];

        for (const [i, { name, value }] of dkimTokens.entries()) {
            const tokenHash = Fn.select(0, Fn.split(".", name));
            new CnameRecord(this, `RecipientDkimCname${i + 1}`, {
                zone: hostedZone,
                recordName: Fn.join(".", [tokenHash, "_domainkey", mailSubdomain]),
                domainName: value,
            });
        }

        const ruleSet = new CfnReceiptRuleSet(this, "ReceiptRuleSet", {
            ruleSetName: `overtone-test-infra-${recipientDomain.replace(/\./g, "-")}`,
        });

        const emailRouter = props.emailRouter as LambdaFunction;
        // Allow SES to invoke the email router Lambda
        emailRouter.addPermission("AllowSES", {
            principal: new ServicePrincipal("ses.amazonaws.com"),
            sourceAccount: account,
        });

        const receiptRule = new CfnReceiptRule(this, "ReceiptRule", {
            ruleSetName: ruleSet.ruleSetName!,
            rule: {
                name: `receive-${recipientDomain.replace(/\./g, "-")}`,
                enabled: true,
                recipients: [recipientDomain],
                actions: [
                    {
                        // First: store raw email in S3
                        s3Action: {
                            bucketName: emailBucket.bucketName,
                            objectKeyPrefix: "raw/",
                        },
                    },
                    {
                        // Then: route to structured path
                        lambdaAction: {
                            functionArn: emailRouter.functionArn,
                            invocationType: "Event",
                        },
                    },
                ],
            },
        });

        receiptRule.node.addDependency(emailBucket.policy!);

        // Activate the receipt rule set (only one can be active per account/region)
        new AwsCustomResource(this, "ActivateReceiptRuleSet", {
            onCreate: {
                service: "SES",
                action: "setActiveReceiptRuleSet",
                parameters: { RuleSetName: ruleSet.ruleSetName },
                physicalResourceId: PhysicalResourceId.of("ActivateReceiptRuleSet"),
            },
            onUpdate: {
                service: "SES",
                action: "setActiveReceiptRuleSet",
                parameters: { RuleSetName: ruleSet.ruleSetName },
                physicalResourceId: PhysicalResourceId.of("ActivateReceiptRuleSet"),
            },
            onDelete: {
                service: "SES",
                action: "setActiveReceiptRuleSet",
                parameters: {},
            },
            policy: AwsCustomResourcePolicy.fromStatements([
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ["ses:SetActiveReceiptRuleSet"],
                    resources: ["*"],
                }),
            ]),
            logRetention: RetentionDays.ONE_WEEK,
        });

        new MxRecord(this, "RecipientMxRecord", {
            zone: hostedZone,
            recordName: recipientDomain,
            values: [{ priority: 10, hostName: `inbound-smtp.${region}.amazonaws.com` }],
        });
    }
}
