import fsp from "node:fs/promises";
import path from "node:path";
import { CloudFormationClient } from "@aws-sdk/client-cloudformation";
import { TestProjectBase } from "../../test-project-setup/test_project_base.js";
import type { TestProjectCreator } from "../../test-project-setup/test_project_creator.js";

const sourceAmplifyDir = new URL("./amplify/", import.meta.url);

class DefaultEmailTestProject extends TestProjectBase {
    readonly sourceProjectAmplifyDirURL = sourceAmplifyDir;
}

export const defaultEmailTestProjectCreator: TestProjectCreator = {
    name: "default-email",
    createProject: async (e2eProjectDir: string) => {
        const projectDir = path.join(e2eProjectDir, "default-email");
        const amplifyDir = path.join(projectDir, "amplify");

        await fsp.mkdir(projectDir, { recursive: true });
        await fsp.cp(sourceAmplifyDir, amplifyDir, { recursive: true });

        // Minimal package.json — dependencies resolve from the monorepo's node_modules
        // (Node walks up the directory tree to find them)
        await fsp.writeFile(
            path.join(projectDir, "package.json"),
            JSON.stringify({ name: "default-email-test", type: "module" }, null, 2),
        );

        return new DefaultEmailTestProject(
            "default-email",
            projectDir,
            amplifyDir,
            new CloudFormationClient({}),
        );
    },
};
