import { EOL } from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { execa, type ResultPromise } from "execa";
import { killExecaProcess } from "./execa_process_killer.js";
import { ActionType } from "./predicated_action.js";
import { PredicatedActionBuilder } from "./predicated_action_queue_builder.js";

export class ProcessController {
    private readonly interactions: PredicatedActionBuilder = new PredicatedActionBuilder();

    constructor(
        private readonly command: string,
        private readonly args: string[] = [],
        private readonly options?: { cwd?: string; env?: Record<string, string> },
    ) {}

    do = (interactions: PredicatedActionBuilder) => {
        this.interactions.append(interactions);
        return this;
    };

    run = async () => {
        const interactionQueue = this.interactions.getPredicatedActionQueue();
        const execaProcess = execa(this.command, this.args, {
            reject: false,
            all: true,
            ...this.options,
        });
        let errorThrownFromActions: unknown;
        let expectKilled = false;

        if (typeof execaProcess.pid !== "number") {
            throw new Error("Could not determine child process id");
        }

        if (process.stdout) {
            execaProcess.stdout?.pipe(process.stdout);
        }
        if (process.stderr) {
            execaProcess.stderr?.pipe(process.stderr);
        }

        if (!execaProcess.stdout) {
            throw new Error("Child process does not have stdout stream");
        }

        const reader = readline.createInterface(execaProcess.all!);

        for await (const line of reader) {
            const currentInteraction = interactionQueue[0];
            try {
                if (currentInteraction?.ifThis.predicate(line)) {
                    switch (currentInteraction.then?.actionType) {
                        case ActionType.SEND_INPUT_TO_PROCESS:
                            await currentInteraction.then.action(
                                execaProcess as unknown as ResultPromise,
                            );
                            break;
                        case ActionType.KILL_PROCESS:
                            expectKilled = true;
                            await currentInteraction.then.action(
                                execaProcess as unknown as ResultPromise,
                            );
                            break;
                        case ActionType.UPDATE_FILE_CONTENT:
                            await currentInteraction.then.action();
                            break;
                        case ActionType.ASSERT_ON_PROCESS_OUTPUT:
                            currentInteraction.then.action(line);
                            break;
                        default:
                            break;
                    }
                } else {
                    continue;
                }
            } catch (error) {
                await killExecaProcess(execaProcess as unknown as ResultPromise);
                execaProcess.stdin?.write("N");
                errorThrownFromActions = error;
            }
            interactionQueue.shift();
        }

        const result = await execaProcess;

        if (errorThrownFromActions) {
            throw errorThrownFromActions;
        }
        if (result.failed && !expectKilled) {
            throw new Error(
                `stdout:${EOL}${result.stdout}${EOL}${EOL}stderr:${EOL}${result.stderr}`,
            );
        }
    };
}

// Resolve the ampx binary from the integration-tests package's node_modules/.bin/,
// not from the test project directory (which has a minimal package.json).
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const integrationTestsRoot = path.resolve(currentDir, "..", "..");
const ampxBin = path.join(integrationTestsRoot, "node_modules", ".bin", "ampx");

export const ampxCli = (
    args: string[] = [],
    dir: string,
    options?: { env?: Record<string, string> },
): ProcessController => {
    return new ProcessController(ampxBin, args, {
        cwd: dir,
        ...(options?.env !== undefined ? { env: options.env } : {}),
    });
};
