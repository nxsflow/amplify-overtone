import { writeFile } from "node:fs/promises";
import { EOL } from "node:os";
import * as path from "node:path";
import { $ as chainableExeca } from "execa";
import { releaseTagToNameAndVersion } from "./release_tag_to_name_and_version.js";

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
     * If packagesToSkip is provided, tags for those packages are filtered out.
     */
    getTagsAtCommit = async (
        commitHash: string,
        packagesToSkip?: Set<string>,
    ): Promise<string[]> => {
        const { stdout: tagsString } = await this.exec`git tag --points-at ${commitHash}`;
        let tags = String(tagsString)
            .split(EOL)
            .filter((line: string) => line.trim().length > 0);
        if (packagesToSkip) {
            tags = tags.filter(
                (tag: string) => !packagesToSkip.has(tag.substring(0, tag.lastIndexOf("@"))),
            );
        }
        return tags;
    };

    /**
     * Gets the most recent release commit that is reachable from the input commitHash.
     * If no commitHash is specified, HEAD is used as the default.
     * By default, the input commitHash is considered in the search (ie if commitHash is a release commit, that commit will be returned).
     * To search for the most recent release commit EXCLUDING commitHash, set inclusive=false.
     */
    getNearestReleaseCommit = async (
        commitHash = "HEAD",
        { inclusive }: { inclusive: boolean } = { inclusive: true },
    ): Promise<string> => {
        const suffix = inclusive ? "" : "^";
        // get the most recent tag before (or at if inclusive=false) the current release tag
        const { stdout: previousReleaseTag } = await this
            .exec`git describe ${commitHash + suffix} --abbrev=0`;

        // get the commit hash associated with the previous release tag
        const previousReleaseTagStr = String(previousReleaseTag);
        const { stdout: previousReleaseCommitHash } = await this
            .exec`git log -1 ${previousReleaseTagStr} --pretty=%H`;

        const commitHashStr = String(previousReleaseCommitHash);

        // run some sanity checks on the release commit
        await this.validateReleaseCommitHash(commitHashStr);

        return commitHashStr;
    };

    /**
     * Given a release commit hash A that has tags for one or more package versions,
     * walk through release history and find the previous release tags of all of the packages that were released in commit A.
     *
     * Note that this does not mean just looking up the previous release tags.
     * It may be the case that package-A was released in release-5 but the previous release of package-A happened in release-2.
     * This method will walk through past release tags until it finds the previous version of all of the input package versions.
     * If a previous version of some package cannot be found, an error is thrown.
     */
    getPreviousReleaseTags = async (releaseCommitHash: string, packagesToSkip: Set<string>) => {
        await this.validateReleaseCommitHash(releaseCommitHash);
        const releaseTags = await this.getTagsAtCommit(releaseCommitHash, packagesToSkip);

        // create a set of just the package names (strip off the version suffix) associated with this release commit
        const packageNamesRemaining = new Set(
            releaseTags
                .map(releaseTagToNameAndVersion)
                .map((nameAndVersion) => nameAndVersion.packageName),
        );

        let releaseCommitCursor = releaseCommitHash;

        // the method return value that we will append release tags to in the loop
        const previousReleaseTags: string[] = [];

        try {
            while (packageNamesRemaining.size > 0) {
                releaseCommitCursor = await this.getNearestReleaseCommit(releaseCommitCursor, {
                    inclusive: false,
                });
                const releaseTagsAtCursor = await this.getTagsAtCommit(
                    releaseCommitCursor,
                    packagesToSkip,
                );
                releaseTagsAtCursor.forEach((releaseTag) => {
                    const { packageName } = releaseTagToNameAndVersion(releaseTag);
                    if (packageNamesRemaining.has(packageName)) {
                        // found the previous version of this package — add it and remove from search set
                        previousReleaseTags.push(releaseTag);
                        packageNamesRemaining.delete(packageName);
                    }
                });
            }
        } catch (e) {
            // In case error was thrown, print out remaining packages.
            for (const packageName of packageNamesRemaining) {
                console.log(`Unable to resolve previous release tags for ${packageName}`);
            }
            throw e;
        }

        return previousReleaseTags;
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

    private validateReleaseCommitHash = async (releaseCommitHash: string) => {
        // check that the hash points to a valid commit
        const { stdout: hashTypeRaw } = await this.exec`git cat-file -t ${releaseCommitHash}`;
        const hashType = String(hashTypeRaw);
        if (hashType !== "commit") {
            throw new Error(`Hash ${releaseCommitHash} does not point to a commit in the git tree`);
        }

        // check that the commit hash points to a release commit
        const { stdout: commitMessageRaw } = await this
            .exec`git log -1 --pretty="%s" ${releaseCommitHash}`;
        const commitMessage = String(commitMessageRaw);
        if (!commitMessage.includes("Version Packages")) {
            throw new Error(`
        Expected release commit message to include "Version Packages".
        Instead found ${commitMessage}.
        Make sure commit ${releaseCommitHash} points to a release commit.
      `);
        }

        // check that this commit was made by the github-actions bot
        const { stdout: commitAuthorRaw } = await this
            .exec`git log -1 --pretty="%an" ${releaseCommitHash}`;
        const commitAuthor = String(commitAuthorRaw);
        if (!commitAuthor.includes("github-actions[bot]")) {
            throw new Error(`
        Expected release commit to be authored by github-actions[bot].
        Instead found ${commitAuthor}.
        Make sure commit ${releaseCommitHash} points to a release commit.
      `);
        }

        // get the release tags associated with the commit
        const releaseTags = await this.getTagsAtCommit(releaseCommitHash);

        if (releaseTags.length === 0) {
            throw new Error(`
        Expected release commit to have associated git tags but none found.
        Make sure commit ${releaseCommitHash} points to a release commit.
      `);
        }
    };
}
