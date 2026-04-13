import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { AddLifeCycleRule } from "./custom/add-storage-lifecycle-rule/resource";
import { CreateTestUsers } from "./custom/create-users/resource";
import { ReceiveEmails } from "./custom/receive-emails/resource";
import { createUser } from "./functions/create-user/resource";
import { routeEmail } from "./functions/route-email/resource";
import { storage } from "./storage/resource";

export const backend = defineBackend({
    auth,
    createUser,
    routeEmail,
    storage,
});

backend.auth.resources.cfnResources.cfnUserPool.addPropertyOverride(
    "AdminCreateUserConfig.AllowAdminCreateUserOnly",
    true,
);

backend.auth.resources.cfnResources.cfnUserPoolClient.addPropertyOverride(
    "ExplicitAuthFlows",
    [
        "ALLOW_CUSTOM_AUTH",
        "ALLOW_USER_SRP_AUTH",
        "ALLOW_REFRESH_TOKEN_AUTH",
        "ALLOW_USER_PASSWORD_AUTH",
    ],
);

const testUsersSecretName = "overtone-test-users";

new AddLifeCycleRule(backend.storage.stack, "StorageLifecycle", {
    s3Bucket: backend.storage.resources.bucket,
    expirationInDays: 7,
});

new CreateTestUsers(backend.auth.stack, "CreateTestUsers", {
    createUserFn: backend.createUser.resources.lambda,
    userPool: backend.auth.resources.userPool,
    recipientDomain: process.env.TEST_RECIPIENT_DOMAIN,
    secretName: testUsersSecretName,
});

new ReceiveEmails(backend.createStack("receive-emails"), "ReceiveEmails", {
    emailBucket: backend.storage.resources.bucket,
    emailRouter: backend.routeEmail.resources.lambda,
    hostedZoneDomain: process.env.TEST_RECIPIENT_HOSTED_ZONE_DOMAIN,
    hostedZoneId: process.env.TEST_RECIPIENT_HOSTED_ZONE_ID,
    recipientDomain: process.env.TEST_RECIPIENT_DOMAIN,
});

backend.addOutput({
    custom: {
        test_infra: {
            auth_role_arn: backend.auth.resources.authenticatedUserIamRole.roleArn,
            unauth_role_arn: backend.auth.resources.unauthenticatedUserIamRole.roleArn,
            test_users_secret_name: testUsersSecretName,
        },
    },
});
