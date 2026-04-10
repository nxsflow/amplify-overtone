import { defineBackend } from "@aws-amplify/backend";
import { email } from "./email/resource.js";

const userPoolId = process.env.TEST_USER_POOL_ID;
if (!userPoolId) {
    throw new Error("Required env var TEST_USER_POOL_ID is not set");
}

const backend = defineBackend({ email });

// Note: The exact wiring of userPoolId to the user-lookup Lambda depends
// on how addToBackend accepts it. For now, we just deploy defineEmail().
// The e2e test invokes the user-lookup Lambda directly with a known userPoolId.
