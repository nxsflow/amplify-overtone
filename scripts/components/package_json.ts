import { existsSync } from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

export type PackageJson = {
    name: string;
    version: string;
    private?: boolean;
    type?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
} & Record<string, unknown>;

/**
 * Reads content of package.json file.
 */
export const readPackageJson = async (packageDirectoryPath: string): Promise<PackageJson> => {
    const packageJsonPath = path.join(packageDirectoryPath, "package.json");
    return JSON.parse(await fsp.readFile(packageJsonPath, "utf-8")) as PackageJson;
};

/**
 * Returns true if the directory contains a package.json file.
 */
export const hasPackageJson = (directoryPath: string): boolean => {
    return existsSync(path.join(directoryPath, "package.json"));
};

/**
 * Writes package json content to file.
 */
export const writePackageJson = async (
    packageDirectoryPath: string,
    packageJson: PackageJson,
): Promise<void> => {
    const packageJsonPath = path.join(packageDirectoryPath, "package.json");
    await fsp.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
};
