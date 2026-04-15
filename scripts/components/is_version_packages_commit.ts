import { readFile } from "node:fs/promises";

/**
 * Reads the GitHub event using the GITHUB_EVENT_PATH environment variable.
 * Expects the event payload to be a PushEvent.
 * Returns true if the push event is a version packages commit, false otherwise.
 *
 * See https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables
 */
export const isVersionPackagesCommit = async () => {
    const githubPushEventPayload = JSON.parse(
        await readFile(process.env.GITHUB_EVENT_PATH!, "utf-8"),
    ) as {
        commits: Array<{
            author: { name: string };
            message: string;
        }>;
    };

    const commits = githubPushEventPayload.commits;
    const firstCommit = commits[0];
    const result =
        commits.length === 1 &&
        firstCommit !== undefined &&
        firstCommit.author.name.includes("github-actions[bot]") &&
        firstCommit.message.includes("Version Packages");
    return result;
};
