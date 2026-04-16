import fsp from "node:fs/promises";
import { EOL } from "node:os";

type ValidationResult = {
    status: "pass" | "fail";
    jsonPath: string;
    failureMessage?: string;
};

/**
 * Validates package lock file.
 */
export class PackageLockValidator {
    /**
     * A dictionary of functions that validate certain keys.
     */
    private readonly validationRules: Record<
        string,
        (jsonPath: string, value: unknown) => ValidationResult
    > = {
        resolved: (jsonPath: string, value: unknown): ValidationResult => {
            if (typeof value !== "string") {
                return {
                    status: "fail",
                    jsonPath,
                    failureMessage: `The ${jsonPath} property must be string, got ${typeof value}`,
                };
            }
            if (value.includes("localhost") || value.includes("127.0.0.1")) {
                return {
                    status: "fail",
                    jsonPath,
                    failureMessage: `The ${jsonPath} property value ${value} seems to point to localhost. Run 'npm stop:npm-proxy && npm ci' to recover`,
                };
            }
            return { status: "pass", jsonPath };
        },
    };

    /**
     * Creates package lock validator.
     */
    constructor(private packageLockPath: string) {}

    validate = async (): Promise<void> => {
        const packageLockContent = JSON.parse(await fsp.readFile(this.packageLockPath, "utf-8"));
        const validationResults = this.walkTree(packageLockContent, "$root");
        const violations = validationResults.filter((result) => result.status === "fail");
        if (violations.length > 0) {
            throw new Error(violations.map((violation) => violation.failureMessage).join(EOL));
        }
    };

    /**
     * Walks the tree and validates nodes.
     * @returns array of validation results.
     */
    private walkTree = (
        node: Record<string, unknown>,
        keyPrefix: string,
    ): Array<ValidationResult> => {
        const validationResults: Array<ValidationResult> = [];
        for (const [key, value] of Object.entries(node)) {
            const jsonPath = `${keyPrefix}.${key}`;
            const validationResult = this.validationRules[key]?.(jsonPath, value);
            if (validationResult) {
                validationResults.push(validationResult);
            }
            if (typeof value === "object" && value !== null) {
                for (const result of this.walkTree(value as Record<string, unknown>, jsonPath)) {
                    validationResults.push(result);
                }
            }
        }
        return validationResults;
    };
}
