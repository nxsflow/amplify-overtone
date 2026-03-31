import fsp from "node:fs/promises";
import path from "node:path";
import { CloudFormationClient } from "@aws-sdk/client-cloudformation";
import { execaSync } from "execa";
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

        await fsp.writeFile(
            path.join(projectDir, "package.json"),
            JSON.stringify(
                {
                    name: "default-email-test",
                    type: "module",
                    dependencies: {
                        "@aws-amplify/backend": "^1.21.0",
                        "@nxsflow/amplify-overtone": "file:../../../packages/amplify-overtone",
                    },
                },
                null,
                2,
            ),
        );

        execaSync("npm", ["install"], { cwd: projectDir, stdio: "inherit" });

        return new DefaultEmailTestProject(
            "default-email",
            projectDir,
            amplifyDir,
            new CloudFormationClient({}),
        );
    },
};
