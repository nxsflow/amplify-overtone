import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type PackageJson, writePackageJson } from "./components/package_json.js";

/**
 * Scaffolds a minimal test project for validating API changes against the
 * published amplify-overtone packages. The test project is placed under
 * test-projects/<name>/ at the repo root.
 *
 * Usage:
 *   npm run setup:test-project <name>
 *
 * After creation:
 *   cd test-projects/<name>
 *   npm install       # install packages from local npm proxy (pnpm vend)
 *   npx tsc --noEmit  # verify types compile cleanly
 */

const projectName = process.argv[2];
if (!projectName) {
    throw new Error("Usage: npm run setup:test-project <name>");
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const testProjectDir = path.resolve(repoRoot, "test-projects", projectName);

await fsp.mkdir(testProjectDir, { recursive: true });

// Create a minimal package.json referencing both publishable packages.
const packageJson: PackageJson = {
    name: projectName,
    version: "1.0.0",
    type: "module",
    dependencies: {
        "@nxsflow/amplify-overtone": "latest",
        "@nxsflow/amplify-overtone-client": "latest",
    },
};

await writePackageJson(testProjectDir, packageJson);

// Create a minimal tsconfig.json that mirrors the repo's base config.
const tsConfig = {
    extends: "../../tsconfig.base.json",
    compilerOptions: {
        rootDir: "src",
        outDir: "lib",
        noEmit: true,
    },
    include: ["src"],
};

await fsp.writeFile(
    path.join(testProjectDir, "tsconfig.json"),
    `${JSON.stringify(tsConfig, null, 2)}\n`,
);

// Create an empty src directory with a placeholder index file.
const srcDir = path.join(testProjectDir, "src");
await fsp.mkdir(srcDir, { recursive: true });
await fsp.writeFile(path.join(srcDir, "index.ts"), "// Add API-change validation imports here\n");

console.log(`Test project '${projectName}' created at ${testProjectDir}`);
console.log("Next steps:");
console.log("  1. Start the local npm proxy: npm run vend");
console.log(`  2. cd test-projects/${projectName} && npm install`);
console.log("  3. Add your type assertions to src/index.ts");
console.log("  4. npx tsc --noEmit");
