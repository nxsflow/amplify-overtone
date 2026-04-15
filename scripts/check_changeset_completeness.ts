import { EOL } from "node:os";
import getReleasePlan from "@changesets/get-release-plan";
import type { ReleasePlan } from "@changesets/types";
import { GitClient } from "./components/git_client.js";
import { readPackageJson } from "./components/package_json.js";

/**
 * Checks that every modified non-private package has a corresponding changeset entry.
 */
const checkForMissingChangesets = async (
    releasePlan: ReleasePlan,
    gitClient: GitClient,
    baseRef: string,
) => {
    const packagesWithChangeset = new Set(releasePlan.releases.map((release) => release.name));

    const changedFiles = await gitClient.getChangedFiles(baseRef);
    const modifiedPackageDirs = new Set<string>();

    changedFiles
        .filter(
            (changedFile) =>
                changedFile.startsWith("packages/") && !changedFile.endsWith("test.ts"),
        )
        .forEach((changedPackageFile) => {
            modifiedPackageDirs.add(changedPackageFile.split("/").slice(0, 2).join("/"));
        });

    const packagesMissingChangesets = [];
    for (const modifiedPackageDir of modifiedPackageDirs) {
        const { name: modifiedPackageName, private: isPrivate } =
            await readPackageJson(modifiedPackageDir);
        if (isPrivate) {
            continue;
        }
        if (!packagesWithChangeset.has(modifiedPackageName)) {
            packagesMissingChangesets.push(modifiedPackageName);
        }
    }

    if (packagesMissingChangesets.length > 0) {
        throw new Error(
            `The following packages have changes but are not included in any changeset:${EOL}${EOL}${packagesMissingChangesets.join(
                EOL,
            )}${EOL}${EOL}Add a changeset using 'npx --package @changesets/cli -- changeset add'.`,
        );
    }
};

const gitClient = new GitClient();

const baseRef = process.argv[2];
if (baseRef === undefined) {
    throw new Error("No base ref specified for changeset completeness check");
}

const releasePlan = await getReleasePlan(process.cwd());

await checkForMissingChangesets(releasePlan, gitClient, baseRef);
