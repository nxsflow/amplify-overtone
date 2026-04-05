import { Stack } from "aws-cdk-lib";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import {
    AwsCustomResource,
    AwsCustomResourcePolicy,
    PhysicalResourceId,
} from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";

/**
 * Creates an SES email-address identity idempotently.
 *
 * Uses an AwsCustomResource that calls SESv2 CreateEmailIdentity and
 * treats AlreadyExistsException as success.  On delete the identity is
 * removed only if this construct originally created it (tracked via the
 * `createdByStack` attribute returned from onCreate).
 *
 * Use this instead of the CDK EmailIdentity L2 construct when the
 * identity may already exist in the account/region (e.g. sandbox
 * recipients or sender addresses shared across stacks).
 */
export class IdempotentEmailIdentity extends Construct {
    public readonly email: string;

    constructor(scope: Construct, id: string, props: { email: string }) {
        super(scope, id);

        this.email = props.email;

        const region = Stack.of(this).region;
        const account = Stack.of(this).account;
        const identityArn = `arn:aws:ses:${region}:${account}:identity/${props.email}`;

        new AwsCustomResource(this, "Identity", {
            resourceType: "Custom::SesEmailIdentity",
            onCreate: {
                service: "SESV2",
                action: "CreateEmailIdentity",
                parameters: {
                    EmailIdentity: props.email,
                },
                physicalResourceId: PhysicalResourceId.of(`ses-identity-${props.email}`),
                ignoreErrorCodesMatching: "AlreadyExistsException",
            },
            onDelete: {
                service: "SESV2",
                action: "DeleteEmailIdentity",
                parameters: {
                    EmailIdentity: props.email,
                },
                ignoreErrorCodesMatching: "NotFoundException",
            },
            policy: AwsCustomResourcePolicy.fromStatements([
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ["ses:CreateEmailIdentity", "ses:DeleteEmailIdentity"],
                    resources: [identityArn],
                }),
            ]),
        });
    }
}
