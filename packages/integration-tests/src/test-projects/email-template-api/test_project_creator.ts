import fsp from "node:fs/promises";
import path from "node:path";
import { CloudFormationClient } from "@aws-sdk/client-cloudformation";
import { TestProjectBase } from "../../test-project-setup/test_project_base.js";
import type { TestProjectCreator } from "../../test-project-setup/test_project_creator.js";

const sourceAmplifyDir = new URL("./amplify/", import.meta.url);

class EmailTemplateApiTestProject extends TestProjectBase {
    readonly sourceProjectAmplifyDirURL = sourceAmplifyDir;
}

export const emailTemplateApiTestProjectCreator: TestProjectCreator = {
    name: "email-template-api",
    createProject: async (e2eProjectDir: string) => {
        const projectDir = path.join(e2eProjectDir, "email-template-api");
        const amplifyDir = path.join(projectDir, "amplify");

        await fsp.mkdir(projectDir, { recursive: true });
        await fsp.cp(sourceAmplifyDir, amplifyDir, { recursive: true });

        await fsp.writeFile(
            path.join(projectDir, "package.json"),
            JSON.stringify({ name: "email-template-api-test", type: "module" }, null, 2),
        );

        return new EmailTemplateApiTestProject(
            "email-template-api",
            projectDir,
            amplifyDir,
            new CloudFormationClient({}),
        );
    },
};
