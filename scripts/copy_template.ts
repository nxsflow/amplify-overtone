import { cp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

/**
 * Copies a template directory to a new package directory under packages/,
 * substituting placeholder tokens with the provided package name.
 *
 * Usage:
 *   npm run new -- --template=<template-name> --name=<package-name>
 *
 * Valid template names are the directory names under ./scripts/templates/.
 */

const { values } = parseArgs({
    options: {
        template: { type: "string" },
        name: { type: "string" },
    },
});

if (!values?.name || !values?.template) {
    throw new Error(
        "Specify a package template using --template=<string> and a new package name using --name=<string>. " +
            "Valid template names are the directory names under ./scripts/templates",
    );
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const sourcePath = path.resolve(scriptDir, "templates", values.template);
const destPath = path.resolve(repoRoot, "packages", values.name);

await cp(sourcePath, destPath, { recursive: true });

// Substitute the library name into the new package.json file.
const packageJsonPath = path.resolve(destPath, "package.json");
const tokenizedPackageJson = await readFile(packageJsonPath, "utf-8");
const newPackageJson = tokenizedPackageJson.replaceAll("{{libName}}", values.name);
await writeFile(packageJsonPath, newPackageJson);

console.log(`Created package '${values.name}' from template '${values.template}' at ${destPath}`);
