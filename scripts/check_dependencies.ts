import { glob } from "glob";
import { DependenciesValidator } from "./components/dependencies_validator.js";
import { hasPackageJson } from "./components/package_json.js";

/**
 * Validates dependency rules across all packages.
 *
 * The integration-tests package is allowed to depend on aws-amplify directly
 * since it exercises the full client stack. The test-infra package is private
 * and deploys Cognito/SES infrastructure, so it may also use aws-amplify.
 *
 * The amplify-overtone-client package is the only publishable package that
 * should depend on aws-amplify (as a peer dep).
 */
await new DependenciesValidator(
    (await glob("packages/*")).filter(hasPackageJson),
    {
        // aws-amplify is a peer dep of amplify-overtone-client only.
        // integration-tests and test-infra are allowed for e2e purposes.
        "aws-amplify": {
            allowList: [
                "@nxsflow/amplify-overtone-client",
                "@nxsflow/integration-tests",
                "@nxsflow/test-infra",
            ],
        },
    },
    [], // Add linked dependencies here that should always be versioned together
    [],
).validate();
