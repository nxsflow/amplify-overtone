import * as cdk from "aws-cdk-lib";
import { OvertoneTestInfraStack } from "../lib/overtone-test-infra-stack.js";

const app = new cdk.App();

const recipientDomain = app.node.tryGetContext("recipientDomain");
const hostedZoneId = app.node.tryGetContext("hostedZoneId");
const hostedZoneDomain = app.node.tryGetContext("hostedZoneDomain");

if (!recipientDomain || !hostedZoneId || !hostedZoneDomain) {
    throw new Error(
        "Missing required CDK context. Provide recipientDomain, hostedZoneId, and hostedZoneDomain. " +
            "Run via: pnpm deploy (reads from .env) or pass --context flags directly.",
    );
}

new OvertoneTestInfraStack(app, "OvertoneTestInfraStack", {
    recipientDomain,
    hostedZoneId,
    hostedZoneDomain,
});
