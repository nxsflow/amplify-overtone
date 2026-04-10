import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface TestInfraConfig {
    userPoolId: string;
    userPoolClientId: string;
    identityPoolId: string;
    authRoleArn: string;
    unauthRoleArn: string;
    receiptS3Bucket: string;
    recipientDomain: string;
    testUsers: Record<string, { email: string; password: string }>;
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "..", "..", "..", "..");
const configPath = path.join(repoRoot, "overtone_test_infra.json");

let cached: TestInfraConfig | undefined;

/**
 * Reads `overtone_test_infra.json` from the repo root.
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
            `overtone_test_infra.json not found at ${configPath}. ` +
                "Run `pnpm test-infra:deploy` to deploy test infrastructure first.",
        );
    }

    cached = JSON.parse(content) as TestInfraConfig;
    return cached;
}
