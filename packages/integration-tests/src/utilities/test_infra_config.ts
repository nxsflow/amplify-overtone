import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

export interface TestInfraConfig {
    userPoolId: string;
    userPoolClientId: string;
    identityPoolId: string;
    authRoleArn: string;
    unauthRoleArn: string;
    receiptS3Bucket: string;
    testUsers: Record<string, { email: string; password: string }>;
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "..", "..", "..", "..");
const configPath = path.join(repoRoot, "packages", "test-infra", "amplify_outputs.json");

let cached: TestInfraConfig | undefined;

/**
 * Reads `amplify_outputs.json` from the test-infra package and fetches
 * test user credentials from Secrets Manager.
 * Caches the result for the lifetime of the process.
 *
 * @throws If the file does not exist (run `pnpm test-infra:deploy` first)
 */
export async function loadTestInfraConfig(): Promise<TestInfraConfig> {
    if (cached) return cached;

    let content: string;
    try {
        content = await fsp.readFile(configPath, "utf-8");
    } catch {
        throw new Error(
            `amplify_outputs.json not found at ${configPath}. ` +
                "Run `pnpm test-infra:deploy` to deploy test infrastructure first.",
        );
    }

    const outputs = JSON.parse(content) as {
        auth: {
            user_pool_id: string;
            user_pool_client_id: string;
            identity_pool_id: string;
        };
        storage: { bucket_name: string };
        custom: {
            test_infra: {
                auth_role_arn: string;
                unauth_role_arn: string;
                test_users_secret_name: string;
            };
        };
    };

    const secretName = outputs.custom.test_infra.test_users_secret_name;
    const sm = new SecretsManagerClient({});
    const secret = await sm.send(new GetSecretValueCommand({ SecretId: secretName }));

    if (!secret.SecretString) {
        throw new Error(
            `Secret '${secretName}' has no value. ` +
                "Run `pnpm test-infra:deploy` to create test users.",
        );
    }

    const testUsers = JSON.parse(secret.SecretString) as Record<
        string,
        { email: string; password: string }
    >;

    cached = {
        userPoolId: outputs.auth.user_pool_id,
        userPoolClientId: outputs.auth.user_pool_client_id,
        identityPoolId: outputs.auth.identity_pool_id,
        authRoleArn: outputs.custom.test_infra.auth_role_arn,
        unauthRoleArn: outputs.custom.test_infra.unauth_role_arn,
        receiptS3Bucket: outputs.storage.bucket_name,
        testUsers,
    };

    return cached;
}
