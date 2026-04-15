import fsp from "node:fs/promises";
import { EOL } from "node:os";
import path from "node:path";
import { execa } from "execa";
import type { PackageJson } from "../package_json.js";
import { readPackageJson, writePackageJson } from "../package_json.js";
import { parseApiReport } from "./api_report_parser.js";
import { ApiUsageGenerator } from "./api_usage_generator.js";

/**
 * Validates changes between two versions of a package.
 *
 * The validation procedure involves:
 * 1. Test TypeScript project is created
 * 2. Test project depends on latest version of package under test and its dependencies and peer dependencies
 * 3. Usage snippets are generated in test project using baseline API.api.md file (this should come from version we compare to)
 * 4. Test project is compiled to detect potential breaks.
 */
export class ApiChangesValidator {
    private readonly testProjectPath: string;
    private readonly latestPackageDirectoryName: string;

    /**
     * Creates api changes validator.
     */
    constructor(
        private readonly latestPackagePath: string,
        private readonly baselinePackageApiReportPath: string,
        readonly workingDirectory: string,
        private readonly excludedTypes: Array<string> = [],
        private readonly latestPackageDependencyDeclarationStrategy:
            | "npmRegistry"
            | "npmLocalLink" = "npmRegistry",
    ) {
        this.latestPackageDirectoryName = path.basename(latestPackagePath);
        this.testProjectPath = path.join(workingDirectory, this.latestPackageDirectoryName);
    }

    validate = async (): Promise<void> => {
        await fsp.rm(this.testProjectPath, { recursive: true, force: true });
        await fsp.mkdir(this.testProjectPath, { recursive: true });
        const latestPackageJson = await readPackageJson(this.latestPackagePath);
        if (latestPackageJson.private) {
            console.log(
                `Skipping ${latestPackageJson.name} because it's private and not published to npm`,
            );
            return;
        }
        await this.createTestProject(latestPackageJson);
        const compilationResult = await execa("npx", ["tsc", "--build"], {
            cwd: this.testProjectPath,
            all: true,
            reject: false,
        });
        if (compilationResult.exitCode !== 0) {
            throw new Error(
                `Validation of ${latestPackageJson.name} failed, compiler output:${EOL}${compilationResult.all ?? ""}`,
            );
        }
    };

    private createTestProject = async (latestPackageJson: PackageJson): Promise<void> => {
        const dependencies: Record<string, string> = {};
        if (this.latestPackageDependencyDeclarationStrategy === "npmRegistry") {
            dependencies[latestPackageJson.name] = latestPackageJson.version;
        }
        dependencies.typescript = "5.9.x";
        dependencies["@types/node"] = "^18.15.11";
        // Add the latest dependencies and peer dependencies as public API might use them
        if (latestPackageJson.dependencies) {
            for (const [key, value] of Object.entries(latestPackageJson.dependencies)) {
                dependencies[key] = value;
            }
        }
        if (latestPackageJson.peerDependencies) {
            for (const [key, value] of Object.entries(latestPackageJson.peerDependencies)) {
                dependencies[key] = value;
            }
        }

        const packageJsonContent: PackageJson = {
            name: `api-changes-validation-${this.latestPackageDirectoryName}`,
            version: "1.0.0",
            type: "module",
            dependencies,
        };
        await writePackageJson(this.testProjectPath, packageJsonContent);
        const apiReportContent = await fsp.readFile(this.baselinePackageApiReportPath, "utf-8");
        const apiReportAST = parseApiReport(apiReportContent);
        const usage = new ApiUsageGenerator(
            latestPackageJson.name,
            apiReportAST,
            this.excludedTypes,
        ).generate();
        await fsp.writeFile(path.join(this.testProjectPath, "index.ts"), usage);
        await execa("npm", ["install"], { cwd: this.testProjectPath });
        if (this.latestPackageDependencyDeclarationStrategy === "npmLocalLink") {
            await execa("npm", ["link", this.latestPackagePath], {
                cwd: this.testProjectPath,
            });
        }
        const tscArgs = [
            "tsc",
            "--init",
            "--resolveJsonModule",
            "true",
            "--module",
            "node16",
            "--moduleResolution",
            "node16",
            "--types",
            "node",
            "--target",
            "es2022",
            "--noEmit",
            "--verbatimModuleSyntax",
            "false",
            "--exactOptionalPropertyTypes",
            "false",
        ];
        await execa("npx", tscArgs, { cwd: this.testProjectPath });
    };
}
