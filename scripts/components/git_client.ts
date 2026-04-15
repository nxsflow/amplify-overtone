import { writeFile } from "node:fs/promises";
import { EOL } from "node:os";
import * as path from "node:path";
import { $ as chainableExeca } from "execa";

/**
 * Client for programmatically interacting with the local git CLI.
 */
export class GitClient {
    private isConfigured = false;
    private readonly gitignorePath: string;

    /**
     * execaCommand that allows us to capture stdout
     */
    private readonly exec;

    /**
     * execaCommand that pipes buffers to process buffers
     */
    private readonly execWithIO;

    /**
     * Initialize with an optional directory to operate in.
     * Defaults to the process cwd.
     */
    constructor(cwd?: string) {
        this.exec = chainableExeca({ cwd });
        this.execWithIO = this.exec({ stdio: "inherit" });
        this.gitignorePath = cwd ? path.join(cwd, ".gitignore") : ".gitignore";
    }

    init = async () => {
        await this.exec`git init`;
        await writeFile(this.gitignorePath, `node_modules${EOL}`);
    };

    /**
     * Throws if there are uncommitted changes in the repo.
     */
    ensureWorkingTreeIsClean = async () => {
        const { stdout } = await this.exec`git status --porcelain`;
        const isDirty = stdout.trim();
        if (isDirty) {
            throw new Error("Dirty working tree detected. Commit or stash changes to continue.");
        }
    };

    getCurrentBranch = async () => {
        const { stdout: currentBranch } = await this.exec`git branch --show-current`;
        return currentBranch;
    };

    /**
     * Gets the names of files modified between startRef and endRef.
     * endRef defaults to HEAD.
     */
    getChangedFiles = async (startRef: string, endRef = "HEAD") => {
        const { stdout: filenameDiffOutput } = await this
            .exec`git --no-pager diff --name-only ${startRef} ${endRef}`;
        return filenameDiffOutput.toString().split(EOL);
    };

    /**
     * Switches to branchName. Creates the branch if it does not exist.
     */
    switchToBranch = async (branchName: string) => {
        const { stdout: branchResult } = await this.exec`git branch -l ${branchName}`;
        const branchExists = branchResult.trim().length > 0;
        if (branchExists) {
            await this.execWithIO`git switch ${branchName}`;
        } else {
            await this.execWithIO`git switch -c ${branchName}`;
        }
    };

    /**
     * Stages and commits all current changes.
     */
    commitAllChanges = async (message: string) => {
        await this.configure();
        await this.execWithIO`git add .`;
        await this.execWithIO`git commit --message ${message} --allow-empty`;
    };

    /**
     * Push to the remote.
     */
    push = async ({ force }: { force: boolean } = { force: false }) => {
        await this.configure();
        await this.execWithIO`git push ${force ? "--force" : ""}`;
    };

    fetchTags = async () => {
        await this.execWithIO`git fetch --tags`;
    };

    checkout = async (ref: string, paths: string[] = []) => {
        const additionalArgs = paths.length > 0 ? ["--", ...paths] : [];
        await this.execWithIO`git checkout ${ref} ${additionalArgs}`;
    };

    status = async () => {
        await this.execWithIO`git status`;
    };

    /**
     * Returns a list of tags that point to the given commit.
     */
    getTagsAtCommit = async (commitHash: string) => {
        const { stdout: tagsString } = await this.exec`git tag --points-at ${commitHash}`;
        return tagsString.split(EOL).filter((line) => line.trim().length > 0);
    };

    /**
     * Get commit hash at HEAD for the current branch.
     */
    getHashForCurrentCommit = async () => {
        const { stdout: currentCommitHash } = await this.exec`git rev-parse HEAD`;
        return currentCommitHash;
    };

    /**
     * Modify local git config to work in CI environments.
     * A best effort is made to restore the config to its original state.
     */
    private configure = async () => {
        if (this.isConfigured) {
            return;
        }

        const userEmailKey = "user.email";
        const userNameKey = "user.name";
        const autoSetupRemoteKey = "push.autoSetupRemote";

        const originalEmail = await this.getConfigSafe(userEmailKey);
        const originalName = await this.getConfigSafe(userNameKey);
        const originalAutoSetupRemote = await this.getConfigSafe(autoSetupRemoteKey);

        await this
            .exec`git config --replace-all ${userEmailKey} "github-actions[bot]@users.noreply.github.com"`;
        await this.exec`git config --replace-all ${userNameKey} "github-actions[bot]"`;
        await this.exec`git config --replace-all ${autoSetupRemoteKey} true`;

        this.registerCleanup(async () => {
            if (originalEmail) {
                await this.exec`git config --replace-all ${userEmailKey} ${originalEmail}`;
            }
            if (originalName) {
                await this.exec`git config --replace-all ${userNameKey} ${originalName}`;
            }
            if (originalAutoSetupRemote) {
                await this
                    .exec`git config --replace-all ${autoSetupRemoteKey} ${originalAutoSetupRemote}`;
            }
        });
        this.isConfigured = true;
    };

    private registerCleanup = (cleanupCallback: () => void | Promise<void>) => {
        const cb = cleanupCallback as () => void;
        process.once("SIGINT", cb);
        process.once("beforeExit", cb);
        process.once("SIGTERM", cb);
        process.once("uncaughtException", cb);
        process.once("unhandledRejection", cb);
    };

    private getConfigSafe = async (configKey: string) => {
        try {
            const { stdout } = await this.exec`git config ${configKey}`;
            return stdout;
        } catch {
            return undefined;
        }
    };
}
