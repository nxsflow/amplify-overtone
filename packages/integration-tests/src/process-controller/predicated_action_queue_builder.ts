import fs from "node:fs/promises";
import os from "node:os";
import type { ResultPromise } from "execa";
import stripANSI from "strip-ansi";
import { killExecaProcess } from "./execa_process_killer.js";
import { ActionType, type PredicatedAction, PredicateType } from "./predicated_action.js";
import type { CopyDefinition } from "./types.js";

export const CONTROL_C = "\x03";

export class PredicatedActionBuilder {
    private readonly predicatedActionQueue: PredicatedAction[] = [];

    append = (builder: PredicatedActionBuilder) => {
        this.predicatedActionQueue.push(...builder.getPredicatedActionQueue());
        return this;
    };

    waitForLineIncludes = (str: string) => {
        this.predicatedActionQueue.push({
            ifThis: {
                predicateType: PredicateType.MATCHES_STRING_PREDICATE,
                predicate: (line) => line.includes(str),
            },
        });
        return this;
    };

    send = (str: string) => {
        this.getLastPredicatedAction().then = {
            actionType:
                str === CONTROL_C ? ActionType.KILL_PROCESS : ActionType.SEND_INPUT_TO_PROCESS,
            action: async (execaProcess: ResultPromise) => {
                if (str === CONTROL_C) {
                    await killExecaProcess(execaProcess);
                } else {
                    execaProcess.stdin?.write(str);
                }
            },
        };
        return this;
    };

    replaceFiles = (replacements: CopyDefinition[]) => {
        this.getLastPredicatedAction().then = {
            actionType: ActionType.UPDATE_FILE_CONTENT,
            action: async () => {
                for (const { source, destination } of replacements) {
                    await fs.cp(source, destination, { recursive: true });
                }
            },
        };
        return this;
    };

    ensureDeploymentTimeLessThan = (seconds: number) => {
        this.getLastPredicatedAction().then = {
            actionType: ActionType.ASSERT_ON_PROCESS_OUTPUT,
            action: (strWithDeploymentTime: string) => {
                const regex = /Deployment completed in (\d*\.*\d*) seconds.*$/;
                const cleaned = stripANSI(strWithDeploymentTime);
                const deploymentTime = cleaned.match(regex);
                if (
                    deploymentTime &&
                    deploymentTime.length > 1 &&
                    !Number.isNaN(+deploymentTime[1]!)
                ) {
                    if (+deploymentTime[1]! <= seconds) {
                        return;
                    }
                    throw new Error(
                        `Deployment time ${+deploymentTime[1]!} seconds exceeds threshold of ${seconds}`,
                    );
                }
                throw new Error(`Could not determine the deployment time. String was ${cleaned}`);
            },
        };
        return this;
    };

    sendLine = (line: string) => {
        this.send(`${line}${os.EOL}`);
        return this;
    };

    sendNo = () => {
        this.sendLine("N");
        return this;
    };

    sendYes = () => {
        this.sendLine("Y");
        return this;
    };

    sendCtrlC = () => {
        this.send(CONTROL_C);
        return this;
    };

    getPredicatedActionQueue = (): PredicatedAction[] => {
        return this.predicatedActionQueue;
    };

    getLastPredicatedAction = () => {
        if (this.predicatedActionQueue.length === 0) {
            throw new Error("Must have a predicate to execute the action");
        }
        const lastPredicatedAction = this.predicatedActionQueue.at(-1)!;
        if (lastPredicatedAction.then !== undefined) {
            throw new Error("An action is already registered to the last predicate in the queue.");
        }
        return lastPredicatedAction;
    };
}
