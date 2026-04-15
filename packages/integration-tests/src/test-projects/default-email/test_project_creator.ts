import fsp from "node:fs/promises";
import path from "node:path";
import { CloudFormationClient } from "@aws-sdk/client-cloudformation";
import { TestProjectBase } from "../../test-project-setup/test_project_base.js";
import type { TestInfraConfig } from "../../utilities/test_infra_config.js";

const sourceAmplifyDir = new URL("./amplify/", import.meta.url);

class DefaultEmailTestProject extends TestProjectBase {
    readonly sourceProjectAmplifyDirURL = sourceAmplifyDir;
    readonly infraEnv: Record<string, string>;

    constructor(
        name: string,
        projectDirPath: string,
        projectAmplifyDirPath: string,
        cfnClient: CloudFormationClient,
        infraEnv: Record<string, string>,
    ) {
        super(name, projectDirPath, projectAmplifyDirPath, cfnClient);
        this.infraEnv = infraEnv;
    }

    override async deploy() {
        return super.deploy(this.infraEnv);
    }
}

export const defaultEmailTestProjectCreator = {
    name: "default-email",
    createProject: async (e2eProjectDir: string, infra: TestInfraConfig) => {
        const projectDir = path.join(e2eProjectDir, "default-email");
        const amplifyDir = path.join(projectDir, "amplify");

        await fsp.mkdir(projectDir, { recursive: true });
        await fsp.cp(sourceAmplifyDir, amplifyDir, { recursive: true });

        await fsp.writeFile(
            path.join(projectDir, "package.json"),
            JSON.stringify({ name: "default-email-test", type: "module" }, null, 2),
        );

        const infraEnv: Record<string, string> = {
            TEST_USER_POOL_ID: infra.userPoolId,
            TEST_USER_POOL_CLIENT_ID: infra.userPoolClientId,
            TEST_IDENTITY_POOL_ID: infra.identityPoolId,
            TEST_AUTH_ROLE_ARN: infra.authRoleArn,
            TEST_UNAUTH_ROLE_ARN: infra.unauthRoleArn,
        };

        return new DefaultEmailTestProject(
            "default-email",
            projectDir,
            amplifyDir,
            new CloudFormationClient({}),
            infraEnv,
        );
    },
};
