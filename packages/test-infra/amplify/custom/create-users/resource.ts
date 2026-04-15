import { CfnOutput, CustomResource, Stack } from "aws-cdk-lib";
import { type IUserPool, UserPool } from "aws-cdk-lib/aws-cognito";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { type IFunction, Function as LambdaFunction } from "aws-cdk-lib/aws-lambda";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { Provider } from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";

interface CreateTestUsersProps {
    createUserFn: IFunction;
    userPool: IUserPool;
    recipientDomain?: string;
    secretName: string;
}

export class CreateTestUsers extends Construct {
    constructor(scope: Construct, id: string, props: CreateTestUsersProps) {
        super(scope, id);

        if (!(props.createUserFn instanceof LambdaFunction))
            throw new Error("createUserFn is not an instance of Function (Lambda)");
        if (!(props.userPool instanceof UserPool))
            throw new Error("userPool is not an instance of UserPool");
        if (!props.recipientDomain)
            throw new Error(
                "Missing required context. Provide recipientDomain, hostedZoneId, and hostedZoneDomain.",
            );

        const { account, region } = Stack.of(this);
        const createUserFn = props.createUserFn as LambdaFunction;
        const { secretName } = props;

        createUserFn.addToRolePolicy(
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

        const testUsersProvider = new Provider(this, "CreateTestUsersProvider", {
            onEventHandler: createUserFn,
            logRetention: RetentionDays.ONE_WEEK,
        });

        const userPool = props.userPool as UserPool;

        const testUsersResource = new CustomResource(this, "CreateTestUsers", {
            serviceToken: testUsersProvider.serviceToken,
            properties: {
                UserPoolId: userPool.userPoolId,
                RecipientDomain: props.recipientDomain,
                SecretName: secretName,
                // Force update on every deploy to regenerate passwords
                DeployTimestamp: Date.now().toString(),
            },
        });

        new CfnOutput(this, "CreateTestUsersSecretArn", {
            value: testUsersResource.getAttString("SecretArn"),
            description: "Secrets Manager ARN containing test user credentials",
        });
    }
}
