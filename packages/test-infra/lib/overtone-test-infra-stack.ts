import {
    CfnOutput,
    CustomResource,
    Duration,
    RemovalPolicy,
    Stack,
    type StackProps,
} from "aws-cdk-lib";
import { UserPool, UserPoolClient } from "aws-cdk-lib/aws-cognito";
import { Effect, PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { HostedZone, MxRecord } from "aws-cdk-lib/aws-route53";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import { CfnReceiptRule, CfnReceiptRuleSet } from "aws-cdk-lib/aws-ses";
import { Provider } from "aws-cdk-lib/custom-resources";
import type { Construct } from "constructs";

export interface OvertoneTestInfraStackProps extends StackProps {
    recipientDomain: string;
    hostedZoneId: string;
    hostedZoneDomain: string;
}

export class OvertoneTestInfraStack extends Stack {
    constructor(scope: Construct, id: string, props: OvertoneTestInfraStackProps) {
        super(scope, id, props);

        const { recipientDomain, hostedZoneId, hostedZoneDomain } = props;
        const region = Stack.of(this).region;
        const account = Stack.of(this).account;

        // ── Email Receipt Infrastructure ──────────────────────────────────

        const emailBucket = new Bucket(this, "EmailBucket", {
            encryption: BucketEncryption.S3_MANAGED,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            lifecycleRules: [
                {
                    expiration: Duration.days(7),
                    enabled: true,
                },
            ],
        });

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

        const ruleSet = new CfnReceiptRuleSet(this, "ReceiptRuleSet", {
            ruleSetName: `overtone-test-infra-${recipientDomain.replace(/\./g, "-")}`,
        });

        const receiptRule = new CfnReceiptRule(this, "ReceiptRule", {
            ruleSetName: ruleSet.ruleSetName!,
            rule: {
                name: `receive-${recipientDomain.replace(/\./g, "-")}`,
                enabled: true,
                recipients: [recipientDomain],
                actions: [
                    {
                        s3Action: {
                            bucketName: emailBucket.bucketName,
                            objectKeyPrefix: "emails/",
                        },
                    },
                ],
            },
        });

        receiptRule.node.addDependency(emailBucket.policy!);

        const hostedZone = HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
            hostedZoneId,
            zoneName: hostedZoneDomain,
        });

        new MxRecord(this, "RecipientMxRecord", {
            zone: hostedZone,
            recordName: recipientDomain,
            values: [{ priority: 10, hostName: `inbound-smtp.${region}.amazonaws.com` }],
        });

        // ── Cognito Test Users ────────────────────────────────────────────

        const userPool = new UserPool(this, "TestUserPool", {
            userPoolName: "overtone-test-users",
            selfSignUpEnabled: false,
            signInAliases: { email: true },
            autoVerify: { email: true },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true,
            },
            removalPolicy: RemovalPolicy.DESTROY,
        });

        const userPoolClient = new UserPoolClient(this, "TestUserPoolClient", {
            userPool,
            userPoolClientName: "overtone-test-client",
            authFlows: {
                userPassword: true,
            },
        });

        const secretName = "overtone-test-users";

        const testUsersHandler = new NodejsFunction(this, "TestUsersHandler", {
            entry: new URL("./test-users-provider.ts", import.meta.url).pathname,
            handler: "handler",
            runtime: Runtime.NODEJS_22_X,
            timeout: Duration.minutes(2),
            logRetention: RetentionDays.ONE_WEEK,
        });

        testUsersHandler.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    "cognito-idp:AdminCreateUser",
                    "cognito-idp:AdminSetUserPassword",
                    "cognito-idp:AdminDeleteUser",
                ],
                resources: [userPool.userPoolArn],
            }),
        );

        testUsersHandler.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    "secretsmanager:CreateSecret",
                    "secretsmanager:UpdateSecret",
                    "secretsmanager:DeleteSecret",
                    "secretsmanager:PutSecretValue",
                ],
                resources: [`arn:aws:secretsmanager:${region}:${account}:secret:${secretName}-*`],
            }),
        );

        const testUsersProvider = new Provider(this, "TestUsersProvider", {
            onEventHandler: testUsersHandler,
            logRetention: RetentionDays.ONE_WEEK,
        });

        const testUsersResource = new CustomResource(this, "TestUsers", {
            serviceToken: testUsersProvider.serviceToken,
            properties: {
                UserPoolId: userPool.userPoolId,
                RecipientDomain: recipientDomain,
                SecretName: secretName,
                // Force update on every deploy to regenerate passwords
                DeployTimestamp: Date.now().toString(),
            },
        });

        // ── Stack Outputs ─────────────────────────────────────────────────

        new CfnOutput(this, "UserPoolId", {
            value: userPool.userPoolId,
            description: "Cognito user pool for test authentication",
        });

        new CfnOutput(this, "UserPoolClientId", {
            value: userPoolClient.userPoolClientId,
            description: "Cognito user pool client for test auth flows",
        });

        new CfnOutput(this, "ReceiptS3BucketName", {
            value: emailBucket.bucketName,
            description: "S3 bucket for captured test emails",
        });

        new CfnOutput(this, "RecipientDomain", {
            value: recipientDomain,
            description: "Domain for inbound test emails",
        });

        new CfnOutput(this, "TestUsersSecretArn", {
            value: testUsersResource.getAttString("SecretArn"),
            description: "Secrets Manager ARN containing test user credentials",
        });
    }
}
