import { Octokit } from "@octokit/rest";

/**
 * Client for interacting with the GitHub REST API.
 * Scopes API requests to the nxsflow/amplify-overtone repository by default.
 */
export class GithubClient {
    private readonly ghClient: Octokit;
    private readonly owner: string;
    private readonly repo: string;

    /**
     * Initialize the client.
     * - githubToken: personal access token or GITHUB_TOKEN. Defaults to GITHUB_TOKEN env var.
     * - owner: GitHub org or user. Defaults to "nxsflow".
     * - repo: GitHub repository name. Defaults to "amplify-overtone".
     */
    constructor(
        githubToken: string = loadGithubTokenFromEnvVar(),
        owner = "nxsflow",
        repo = "amplify-overtone",
    ) {
        this.ghClient = new Octokit({ auth: githubToken });
        this.owner = owner;
        this.repo = repo;
    }

    /**
     * Create a new pull request.
     *
     * @param head - The name of the branch to create the PR from.
     * @param base - The name of the branch to merge the PR into.
     * @param title - The PR title.
     * @param body - The PR description.
     * @returns The PR URL and number.
     */
    createPullRequest = async ({
        head,
        base,
        title,
        body,
    }: {
        head: string;
        base: string;
        title: string;
        body: string;
    }) => {
        const prResult = await this.ghClient.pulls.create({
            owner: this.owner,
            repo: this.repo,
            base,
            head,
            title,
            body,
        });

        return {
            pullRequestUrl: prResult.data.html_url,
            pullRequestNumber: prResult.data.number,
        };
    };

    fetchPullRequest = async (pullRequestNumber: number) => {
        const response = await this.ghClient.pulls.get({
            owner: this.owner,
            repo: this.repo,
            pull_number: pullRequestNumber,
        });
        return response.data;
    };

    labelPullRequest = async (pullRequestNumber: number, labels: string[]) => {
        await this.ghClient.issues.addLabels({
            owner: this.owner,
            repo: this.repo,
            issue_number: pullRequestNumber,
            labels,
        });
    };
}

/**
 * Loads the GitHub token from the GITHUB_TOKEN environment variable.
 * Throws if not present.
 */
export const loadGithubTokenFromEnvVar = () => {
    const ghToken = process.env["GITHUB_TOKEN"];
    if (!ghToken) {
        throw new Error(
            "The GitHub access token must be set in the GITHUB_TOKEN environment variable.",
        );
    }
    return ghToken;
};
