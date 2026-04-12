import { defineFunction } from "@aws-amplify/backend";

export const createUser = defineFunction({
    architecture: "arm64",
    runtime: 22,
    logging: { retention: "1 week" },
    memoryMB: 128,
    timeoutSeconds: 60,
    resourceGroupName: "auth",
});
