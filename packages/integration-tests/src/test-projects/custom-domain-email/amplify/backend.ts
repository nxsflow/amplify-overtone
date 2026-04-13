import { defineBackend, defineData, referenceAuth } from "@aws-amplify/backend";
import { addEmailResolvers, extractEmailActions } from "@nxsflow/amplify-overtone";
import { email } from "./email/resource.js";
import { schema, schemaDefinition } from "./schema/resource.js";

const userPoolId = process.env.TEST_USER_POOL_ID!;
const userPoolClientId = process.env.TEST_USER_POOL_CLIENT_ID!;
const identityPoolId = process.env.TEST_IDENTITY_POOL_ID!;
const authRoleArn = process.env.TEST_AUTH_ROLE_ARN!;
const unauthRoleArn = process.env.TEST_UNAUTH_ROLE_ARN!;

for (const [name, value] of Object.entries({
    TEST_USER_POOL_ID: userPoolId,
    TEST_USER_POOL_CLIENT_ID: userPoolClientId,
    TEST_IDENTITY_POOL_ID: identityPoolId,
    TEST_AUTH_ROLE_ARN: authRoleArn,
    TEST_UNAUTH_ROLE_ARN: unauthRoleArn,
})) {
    if (!value) {
        throw new Error(`Required env var ${name} is not set`);
    }
}

const auth = referenceAuth({
    userPoolId,
    userPoolClientId,
    identityPoolId,
    authRoleArn,
    unauthRoleArn,
});

const data = defineData({
    schema,
    authorizationModes: {
        defaultAuthorizationMode: "userPool",
    },
});

const backend = defineBackend({ auth, data, email });

const emailActions = extractEmailActions(schemaDefinition);
addEmailResolvers(backend, emailActions, { userPoolId });
