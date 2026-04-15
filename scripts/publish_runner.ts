import { existsSync } from "node:fs";
import * as path from "node:path";
import { execa, type Options } from "execa";
import { NpmClient } from "./components/npm_client.js";
import { runVersion } from "./version_runner.js";

export type PublishOptions = {
    /**
     * Publish defaults to creating git tags for the packages being published.
     * Set false to disable this behavior.
     */
    includeGitTags?: boolean;
    /**
     * Defaults to publishing to the public npm registry.
     * Set true to publish to the local registry.
     */
    useLocalRegistry?: boolean;
    /**
     * Defaults to publishing a usual release.
     * Set true to publish a snapshot.
     * See https://github.com/changesets/changesets/blob/main/docs/snapshot-releases.md
     */
    snapshotRelease?: boolean;
};

const publishDefaults: PublishOptions = {
    includeGitTags: true,
    useLocalRegistry: false,
    snapshotRelease: false,
};

const snapshotTag = "test";

/**
 * Wrapper around `changeset publish` that exposes a few config options.
 * To keep behavior consistent, this wrapper should be the ONLY path by which we execute `changeset publish`.
 */
export const runPublish = async (props?: PublishOptions, cwd?: string) => {
    const options = {
        ...publishDefaults,
        ...props,
    };

    const execaOptions: Options = {
        stdio: "inherit",
        ...(cwd ? { cwd } : {}),
    };

    // if we are publishing to npm, we assume that the npmrc has already been configured properly by upstream code
    // (ie the changeset gh action automatically configures this)
    if (options.useLocalRegistry) {
        const npmClient = new NpmClient(null, cwd);
        await npmClient.configureNpmRc();
    }

    if (options.snapshotRelease) {
        if (existsSync(path.join(".changeset", "pre.json"))) {
            // Snapshot releases are not allowed in pre mode.
            await execa("npx", ["changeset", "pre", "exit"], execaOptions);
        }
        await runVersion(["--snapshot", snapshotTag], cwd);
    }

    const changesetArgs = ["changeset", "publish"];
    if (!options.includeGitTags) {
        changesetArgs.push("--no-git-tag");
    }
    if (options.snapshotRelease) {
        changesetArgs.push("--tag", snapshotTag);
    }

    const execaPublishOptions: Options = {
        ...execaOptions,
        ...(options.useLocalRegistry
            ? { env: { npm_config_registry: "http://localhost:4873/" } }
            : {}),
    };
    await execa("npx", changesetArgs, execaPublishOptions);
};
