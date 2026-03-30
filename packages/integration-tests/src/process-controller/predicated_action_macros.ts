import { PredicatedActionBuilder } from "./predicated_action_queue_builder.js";

export const waitForSandboxDeploymentToPrintTotalTime = () =>
    new PredicatedActionBuilder().waitForLineIncludes("Deployment completed in");

export const waitForConfigUpdateAfterDeployment = () =>
    new PredicatedActionBuilder().waitForLineIncludes("File written: amplify_outputs.json");

export const confirmDeleteSandbox = () =>
    new PredicatedActionBuilder()
        .waitForLineIncludes(
            "Are you sure you want to delete all the resources in your sandbox environment",
        )
        .sendYes();

export const interruptSandbox = () => waitForConfigUpdateAfterDeployment().sendCtrlC();
