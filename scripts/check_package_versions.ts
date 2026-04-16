import { glob } from "glob";
import { hasPackageJson, readPackageJson } from "./components/package_json.js";

/**
 * Verifies expected major versions for all packages in the repo.
 * This is to prevent accidental major version bumps.
 */

const packagePaths = (await glob("./packages/*")).filter(hasPackageJson);

const getExpectedMajorVersion = (packageName: string) => {
    switch (packageName) {
        case "@nxsflow/amplify-overtone":
        case "@nxsflow/amplify-overtone-client":
            return "0.";
        default:
            // Private packages (integration-tests, test-infra, etc.) are skipped below
            return "0.";
    }
};

for (const packagePath of packagePaths) {
    const { version, private: isPrivate, name } = await readPackageJson(packagePath);
    if (isPrivate) {
        continue;
    }
    const expectedMajorVersion = getExpectedMajorVersion(name);
    if (!version.startsWith(expectedMajorVersion)) {
        throw new Error(
            `Expected package ${name} version to start with "${expectedMajorVersion}" but found version ${version}.`,
        );
    }
}
