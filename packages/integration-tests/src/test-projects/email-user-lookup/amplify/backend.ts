import { defineBackend } from "@aws-amplify/backend";
import { email } from "./email/resource.js";

const userPoolId = process.env.TEST_USER_POOL_ID;
if (!userPoolId) {
    throw new Error("Required env var TEST_USER_POOL_ID is not set");
}

const _backend = defineBackend({ email });
// Note: addToBackend() with userPoolId wiring will be added
// when the full pipeline resolver integration is complete.
