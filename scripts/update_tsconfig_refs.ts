import { execFileSync } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { globSync } from "glob";
import { readPackageJson } from "./components/package_json.js";

/*
 * In a monorepo where packages depend on each other, TypeScript needs to know
 * the build order. It does this via the "references" field in each tsconfig.json.
 * As inter-package dependencies are added or removed, these references must be
 * kept in sync.
 *
 * This script automates those updates.
 *
 * See https://www.typescriptlang.org/docs/handbook/project-references.html
 */

type PackageInfo = {
    packagePath: string;
    packageJson: Record<string, unknown>;
    tsconfigPath: string;
    tsconfig: Record<string, unknown>;
    /** Relative path from another package's tsconfig to this package, e.g. "../amplify-overtone" */
    relativeReferencePath: string;
};

const packagePaths = globSync("./packages/*");

// Collect information about all packages in the repo.
const repoPackagesInfoRecord: Record<string, PackageInfo> = {};

for (const packagePath of packagePaths) {
    const tsconfigPath = path.resolve(packagePath, "tsconfig.json");
    const packageJsonPath = path.resolve(packagePath, "package.json");
    if (!fs.existsSync(tsconfigPath) || !fs.existsSync(packageJsonPath)) {
        // Skip packages that don't have a tsconfig or package.json.
        continue;
    }

    const packageJson = await readPackageJson(packagePath);
    const packageDirName = packagePath.split(path.sep).at(-1) as string;
    const relativeReferencePath = path.posix.join("..", packageDirName);

    let tsconfigObject: Record<string, unknown>;
    try {
        tsconfigObject = JSON.parse(fs.readFileSync(tsconfigPath, "utf-8")) as Record<
            string,
            unknown
        >;
    } catch (err) {
        throw new Error(`Failed to parse tsconfig at ${tsconfigPath}`, { cause: err });
    }

    repoPackagesInfoRecord[packageJson.name as string] = {
        packagePath,
        packageJson,
        tsconfigPath,
        tsconfig: tsconfigObject,
        relativeReferencePath,
    };
}

// Iterate over all packages and update their tsconfig references.
const updatePromises = Object.values(repoPackagesInfoRecord).map(
    async ({ packageJson, tsconfig, tsconfigPath }) => {
        // Collect all declared dependencies for the package.
        const allDeps = Array.from(
            new Set([
                ...Object.keys((packageJson.dependencies as Record<string, string>) || {}),
                ...Object.keys((packageJson.devDependencies as Record<string, string>) || {}),
                ...Object.keys((packageJson.peerDependencies as Record<string, string>) || {}),
            ]),
        );

        // Build the references array from inter-repo dependencies only.
        tsconfig.references = allDeps
            .filter((dep) => dep in repoPackagesInfoRecord)
            .map((dep) => ({ path: repoPackagesInfoRecord[dep]!.relativeReferencePath }));

        await fsp.writeFile(tsconfigPath, `${JSON.stringify(tsconfig, null, 4)}\n`);
    },
);

await Promise.all(updatePromises);

// Run Biome format on all written tsconfig files so the output is canonical
// (JSON.stringify formatting differs from Biome, e.g. single-element arrays).
const tsconfigPaths = Object.values(repoPackagesInfoRecord).map((p) => p.tsconfigPath);
execFileSync("npx", ["biome", "format", "--write", ...tsconfigPaths], { stdio: "inherit" });

console.log("tsconfig references updated.");
