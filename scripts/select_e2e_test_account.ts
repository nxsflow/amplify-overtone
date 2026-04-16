export type E2ETestAccount = {
    accountId: string;
    executionRoleArn: string;
    toolingRoleArn: string;
};

if (!process.env.E2E_TEST_ACCOUNTS) {
    throw new Error(
        "E2E_TEST_ACCOUNTS environment variable must be defined and contain a JSON array of {accountId, executionRoleArn, toolingRoleArn} objects",
    );
}

const accounts = JSON.parse(process.env.E2E_TEST_ACCOUNTS) as Array<E2ETestAccount>;

if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error("E2E_TEST_ACCOUNTS must be a non-empty JSON array");
}

const selectedAccount = accounts[Math.floor(Math.random() * accounts.length)];

console.log(JSON.stringify(selectedAccount));
