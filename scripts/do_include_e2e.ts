// Determines whether E2E tests should run for the current GitHub Actions trigger.
//
// Returns "true" for:
//   - push to main
//   - PR with the "run-e2e" label
//   - manual workflow_dispatch
//   - scheduled runs

const {
    GITHUB_EVENT_NAME: eventName,
    GITHUB_REF_NAME: refName,
    GITHUB_EVENT_ACTION: eventAction,
    PR_LABELS: prLabelsRaw,
} = process.env;

const isPushToMain = eventName === "push" && refName === "main";

const isPullRequestWithRunE2ELabel = (): boolean => {
    if (eventName !== "pull_request") {
        return false;
    }
    if (!prLabelsRaw) {
        return false;
    }
    try {
        // PR_LABELS is expected to be a JSON array of label name strings, e.g. '["run-e2e","bug"]'
        const labels = JSON.parse(prLabelsRaw) as Array<string>;
        return labels.includes("run-e2e");
    } catch {
        // Fallback: treat as a comma-separated string
        return prLabelsRaw
            .split(",")
            .map((l) => l.trim())
            .includes("run-e2e");
    }
};

const isWorkflowTriggeredManually = eventName === "workflow_dispatch";
const isWorkflowTriggeredBySchedule = eventName === "schedule";

const doIncludeE2e =
    isPushToMain ||
    isPullRequestWithRunE2ELabel() ||
    isWorkflowTriggeredManually ||
    isWorkflowTriggeredBySchedule;

console.log(doIncludeE2e);
