import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { CustomResource, Stack } from "aws-cdk-lib";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Provider } from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";

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
const HANDLER_DIR = path.join(PACKAGE_ROOT, "src", "email", "functions", "idempotent-identity");

/**
 * Creates an SES email-address identity idempotently.
 *
 * Uses a Lambda-backed CustomResource that calls SESv2 CreateEmailIdentity
 * and treats AlreadyExistsException as success, recording whether the
 * identity pre-existed. On delete, the identity is removed only if this
 * construct originally created it (tracked via the physical resource ID).
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

        const handler = new NodejsFunction(this, "Handler", {
            entry: path.join(HANDLER_DIR, "handler.ts"),
            handler: "handler",
            runtime: Runtime.NODEJS_22_X,
            bundling: { externalModules: ["@aws-sdk/*"] },
        });

        handler.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ["ses:CreateEmailIdentity", "ses:DeleteEmailIdentity"],
                resources: [identityArn],
            }),
        );

        const provider = new Provider(this, "Provider", {
            onEventHandler: handler,
        });

        new CustomResource(this, "Identity", {
            serviceToken: provider.serviceToken,
            resourceType: "Custom::SesEmailIdentity",
            properties: {
                Email: props.email,
                // Force an Update call on every deploy so the handler can
                // re-create the identity if it was deleted externally (drift).
                DeployToken: new Date().toISOString(),
            },
        });
    }
}
