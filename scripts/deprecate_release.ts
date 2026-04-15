import { DistTagMover } from "./components/dist_tag_mover.js";
import { GitClient } from "./components/git_client.js";
import { GithubClient } from "./components/github_client.js";
import { loadNpmTokenFromEnvVar, NpmClient } from "./components/npm_client.js";
import { ReleaseDeprecator } from "./components/release_deprecator.js";

/**
 * Reads required inputs from environment variables.
 * When run in GitHub Actions, these are set via the `env:` section of the workflow step.
 */
const getRequiredEnv = (name: string): string => {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Required environment variable ${name} is not set.`);
    }
    return value;
};

const deprecationMessage = getRequiredEnv("DEPRECATION_MESSAGE");
const searchForReleaseStartingFrom = getRequiredEnv("SEARCH_FOR_RELEASE_STARTING_FROM");
const useNpmRegistry = getRequiredEnv("USE_NPM_REGISTRY") === "true";

if (useNpmRegistry) {
    console.log(
        "USE_NPM_REGISTRY is TRUE. This run will update package metadata on the public npm package registry.",
    );
} else {
    console.log(
        "USE_NPM_REGISTRY is FALSE. This run will update package metadata on a local npm proxy. No public changes will be made.",
    );
    await import("./start_npm_proxy.js");
}

const npmClient = new NpmClient(useNpmRegistry ? loadNpmTokenFromEnvVar() : null);

await npmClient.configureNpmRc();

const packagesToSkipJSON = getRequiredEnv("PACKAGES_TO_SKIP");
const packagesToSkip = new Set(JSON.parse(packagesToSkipJSON) as Array<string>);

const releaseDeprecator = new ReleaseDeprecator(
    searchForReleaseStartingFrom,
    deprecationMessage,
    packagesToSkip,
    new GithubClient(),
    new GitClient(),
    npmClient,
    new DistTagMover(npmClient),
);

try {
    await releaseDeprecator.deprecateRelease();
} catch (err) {
    console.error(err);
    process.exitCode = 1;
}
