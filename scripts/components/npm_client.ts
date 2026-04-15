import { writeFile } from "node:fs/promises";
import { EOL } from "node:os";
import * as path from "node:path";
import { $ as chainableExeca } from "execa";

/**
 * Type for the response of `npm show <package> --json`.
 */
export type PackageInfo = {
    // matches the output payload of `npm show`
    "dist-tags": Record<string, string>;
    deprecated?: string;
};

/**
 * Client for programmatically interacting with the local npm CLI.
 *
 * This class is not a singleton and should not store mutable internal state.
 */
export class NpmClient {
    private readonly exec;
    private readonly execWithIO;

    /**
     * Initialize the npm client with an optional directory to operate in.
     * Defaults to process.cwd().
     */
    constructor(
        private readonly npmToken: string | null,
        private readonly cwd: string = process.cwd(),
    ) {
        this.exec = chainableExeca({ cwd });
        this.execWithIO = this.exec({ stdio: "inherit" });
    }

    deprecatePackage = async (packageVersionSpecifier: string, deprecationMessage: string) => {
        await this.execWithIO`npm deprecate ${packageVersionSpecifier} ${deprecationMessage}`;
    };

    unDeprecatePackage = async (packageVersionSpecifier: string) => {
        // Passing an empty deprecation message is the official way to un-deprecate
        // see https://docs.npmjs.com/cli/v8/commands/npm-deprecate
        await this.execWithIO`npm deprecate ${packageVersionSpecifier} ${""}`;
    };

    setDistTag = async (packageVersionSpecifier: string, distTag: string) => {
        await this.execWithIO`npm dist-tag add ${packageVersionSpecifier} ${distTag}`;
    };

    getPackageInfo = async (packageVersionSpecifier: string) => {
        const { stdout: jsonString } = await this.exec`npm show ${packageVersionSpecifier} --json`;
        return JSON.parse(jsonString) as PackageInfo;
    };

    /**
     * Configure the .npmrc file with the provided npm token.
     * If no token is set, configures for a local npm proxy (verdaccio).
     */
    configureNpmRc = async () => {
        if (this.npmToken) {
            await writeFile(
                path.join(this.cwd, ".npmrc"),
                `//registry.npmjs.org/:_authToken=${this.npmToken}${EOL}`,
            );
        } else {
            // if there's no npm token, assume we are configuring for a local proxy
            await writeFile(path.join(this.cwd, ".npmrc"), npmrcLocalTemplate);
        }
    };
}

const npmrcLocalTemplate = `
# this is a test config file used to publish locally
//localhost:4873/:_authToken=garbage

# this prevents the script-shell setting set by setup:local from being overwritten when copying the localhost config
script-shell=bash
`;

/**
 * Loads the npm token from the NPM_TOKEN environment variable.
 * Throws if not present.
 */
export const loadNpmTokenFromEnvVar = () => {
    const npmToken = process.env.NPM_TOKEN;
    if (!npmToken) {
        throw new Error("The NPM access token must be set in the NPM_TOKEN environment variable.");
    }
    return npmToken;
};
