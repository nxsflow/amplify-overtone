import assert from "node:assert";
import fsp from "node:fs/promises";
import {
    type CloudFormationClient,
    CloudFormationServiceException,
    DescribeStacksCommand,
} from "@aws-sdk/client-cloudformation";
import {
    confirmDeleteSandbox,
    waitForSandboxDeploymentToPrintTotalTime,
} from "../process-controller/predicated_action_macros.js";
import { ampxCli } from "../process-controller/process_controller.js";

export abstract class TestProjectBase {
    abstract readonly sourceProjectAmplifyDirURL: URL;

    constructor(
        readonly name: string,
        readonly projectDirPath: string,
        readonly projectAmplifyDirPath: string,
        protected readonly cfnClient: CloudFormationClient,
    ) {}

    async deploy(environment?: Record<string, string>) {
        await ampxCli(["sandbox", "--once"], this.projectDirPath, {
            ...(environment
                ? { env: { ...process.env, ...environment } as Record<string, string> }
                : {}),
        })
            .do(waitForSandboxDeploymentToPrintTotalTime())
            .run();
    }

    async tearDown() {
        await ampxCli(["sandbox", "delete"], this.projectDirPath).do(confirmDeleteSandbox()).run();
    }

    async assertPostDeployment(): Promise<void> {
        const outputsPath = `${this.projectDirPath}/amplify_outputs.json`;
        const stat = await fsp.stat(outputsPath);
        assert.ok(stat.isFile(), "amplify_outputs.json should exist");
    }

    async getAmplifyOutputs(): Promise<Record<string, unknown>> {
        const outputsPath = `${this.projectDirPath}/amplify_outputs.json`;
        const content = await fsp.readFile(outputsPath, "utf-8");
        return JSON.parse(content) as Record<string, unknown>;
    }

    async waitForStackDeletion(stackName: string, timeoutMs = 3 * 60 * 1000): Promise<boolean> {
        let attempts = 0;
        let totalWaitedMs = 0;
        const maxIntervalMs = 32_000;

        while (totalWaitedMs < timeoutMs) {
            attempts++;
            const intervalMs = Math.min(2 ** attempts * 1000, maxIntervalMs);
            console.log(`waiting: ${intervalMs} milliseconds`);
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
            totalWaitedMs += intervalMs;

            try {
                const status = await this.cfnClient.send(
                    new DescribeStacksCommand({ StackName: stackName }),
                );
                if (!status.Stacks || status.Stacks.length === 0) {
                    console.log(`Stack ${stackName} deleted successfully.`);
                    return true;
                }
            } catch (e) {
                if (
                    e instanceof CloudFormationServiceException &&
                    e.message.includes("does not exist")
                ) {
                    console.log(`Stack ${stackName} deleted successfully.`);
                    return true;
                }
                throw e;
            }
        }
        console.error(`Stack ${stackName} did not delete within ${timeoutMs / 1000} seconds.`);
        return false;
    }

    async reset() {
        await fsp.rm(this.projectAmplifyDirPath, { recursive: true, force: true });
        await fsp.cp(this.sourceProjectAmplifyDirURL, this.projectAmplifyDirPath, {
            recursive: true,
        });
    }
}
