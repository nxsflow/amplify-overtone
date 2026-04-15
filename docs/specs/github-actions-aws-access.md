# GitHub Actions AWS Access for E2E Testing

This document describes how GitHub Actions authenticates with AWS to run end-to-end tests in the Amplify Overtone monorepo. The setup uses OpenID Connect federation for keyless authentication and a dual-role pattern for least-privilege access.

## OIDC Federation Setup

GitHub Actions uses OpenID Connect (OIDC) to issue short-lived, verifiable tokens that AWS IAM can trust. This eliminates the need to store AWS credentials in GitHub Secrets.

### How OIDC Works

1. **GitHub OIDC Provider**: When a GitHub Actions workflow runs, GitHub automatically generates an OIDC token signed by `token.actions.githubusercontent.com`
2. **AWS Identity Provider**: Each AWS account must register GitHub's OIDC provider as a trusted identity provider
3. **Assume Role**: The workflow exchanges the OIDC token for temporary AWS credentials by assuming an IAM role
4. **Short-lived Credentials**: The temporary credentials (valid for ~1 hour) are used for test execution and infrastructure deployment

### Registering GitHub OIDC Provider in AWS

In each AWS account used for E2E testing, register the GitHub OIDC provider once:

1. Navigate to **IAM** > **Identity Providers** in the AWS Console
2. Click **Add Provider**
3. Select **OpenID Connect**
4. Configure:
   - **Provider URL**: `https://token.actions.githubusercontent.com`
   - **Audience**: `sts.amazonaws.com`
5. Click **Get thumbprint** (AWS will verify and auto-populate)
6. Click **Add provider**

After registration, the provider appears as `token.actions.githubusercontent.com` in the Identity Providers list.

## IAM Trust Policy

Each IAM role used by GitHub Actions must have a trust relationship with the GitHub OIDC provider. The trust policy enforces conditions that ensure only the correct repository and workflows can assume the role.

### Trust Policy Document

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:nxsflow/amplify-overtone:*"
        }
      }
    }
  ]
}
```

### Trust Policy Explanation

- **Principal**: Trusts the GitHub OIDC provider by ARN. Replace `ACCOUNT_ID` with the AWS account number.
- **Action**: Allows the `sts:AssumeRole` action (required for role assumption).
- **Condition - aud**: Restricts the OIDC token audience to `sts.amazonaws.com`. GitHub's OIDC tokens include this audience value.
- **Condition - sub**: Restricts the OIDC token subject to any workflow in the `nxsflow/amplify-overtone` repository (`*` allows any branch or workflow file).

### Scope Control

To restrict to a specific branch or workflow file, modify the `sub` condition:

- **Specific branch**: `repo:nxsflow/amplify-overtone:ref:refs/heads/main`
- **Specific workflow**: `repo:nxsflow/amplify-overtone:workflow_ref:nxsflow/amplify-overtone/.github/workflows/e2e.yml@main`
- **All workflows (current)**: `repo:nxsflow/amplify-overtone:*`

## Dual Role Pattern

The E2E testing setup uses two IAM roles with distinct permission levels to enforce least privilege:

### Tooling Role

**Purpose**: Deploy and tear down test infrastructure (CloudFormation stacks, Cognito user pools, S3 buckets, SES configuration).

**When Used**:

- GitHub Actions workflow prepares the environment before test execution
- Called via `pnpm test-infra:deploy` in CI
- Requires broad AWS permissions to create, modify, and delete resources

**Assumptions Made by Tooling Role**:

- OIDC token from any GitHub Actions workflow in the repository
- Temporary credentials valid for infrastructure setup (approximately 1 hour)

### Execution Role

**Purpose**: Run E2E tests with minimal AWS permissions (invoke deployed Lambda functions, read test data from S3, send emails via SES).

**When Used**:

- During test execution phase in GitHub Actions workflow
- Called implicitly by test code that needs AWS access
- Restricted to read-only and invocation-only permissions on deployed resources

**Assumptions Made by Execution Role**:

- Same OIDC token source as tooling role
- Credentials are passed to test process and used only for resource interaction (not mutation)

### Separation Benefits

1. **Security**: If test code is compromised, the attacker can only invoke tests (execution role) not modify infrastructure (tooling role)
2. **Auditability**: CloudTrail logs show which role performed each action, aiding compliance investigation
3. **Fail-safe**: If test execution fails and the execution role remains active, no infrastructure can be accidentally modified

## GitHub Secrets Structure

Two GitHub repository secrets must be configured in `nxsflow/amplify-overtone` to pass AWS account information to GitHub Actions workflows.

### E2E_TEST_ACCOUNTS

A JSON array of AWS account configurations. Each entry specifies an account where tests run and which IAM roles to assume in that account.

**Format**:

```json
[
  {
    "accountId": "123456789012",
    "executionRoleArn": "arn:aws:iam::123456789012:role/github-actions-e2e-execution",
    "toolingRoleArn": "arn:aws:iam::123456789012:role/github-actions-e2e-tooling"
  },
  {
    "accountId": "210987654321",
    "executionRoleArn": "arn:aws:iam::210987654321:role/github-actions-e2e-execution",
    "toolingRoleArn": "arn:aws:iam::210987654321:role/github-actions-e2e-tooling"
  }
]
```

**Usage in Workflow**:

```yaml
- name: Parse test accounts
  env:
    ACCOUNTS_JSON: ${{ secrets.E2E_TEST_ACCOUNTS }}
  run: node scripts/parse-accounts.js
```

### E2E_REGIONS

A JSON array of AWS regions where infrastructure is deployed and tests are executed.

**Format**:

```json
["us-east-1", "eu-central-1"]
```

**Usage in Workflow**:

```yaml
strategy:
  matrix:
    region: ${{ fromJson(secrets.E2E_REGIONS) }}
```

## Step-by-Step Preparation Guide

### Prerequisites

- AWS account(s) for E2E testing
- AWS CLI installed and configured with appropriate permissions
- GitHub repository access with permission to configure secrets
- Role creation permissions (IAM principal must be able to call `iam:CreateRole`, `iam:PutRolePolicyPolicy`, etc.)

### Step 1: Register GitHub OIDC Provider

Run this once per AWS account:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  --client-id-list sts.amazonaws.com \
  --region us-east-1
```

**Note**: The thumbprint is stable; AWS will verify it matches GitHub's certificate during provider creation.

**Verify**:

```bash
aws iam list-open-id-connect-providers
```

Output should include:

```json
{
  "OpenIDConnectProviderList": [
    {
      "Arn": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
    }
  ]
}
```

### Step 2: Create Execution Role

Create the execution role used during test execution:

```bash
aws iam create-role \
  --role-name github-actions-e2e-execution \
  --assume-role-policy-document file://trust-policy.json \
  --region us-east-1

aws iam put-role-policy \
  --role-name github-actions-e2e-execution \
  --policy-name execution-policy \
  --policy-document file://execution-policy.json \
  --region us-east-1
```

**Trust Policy** (`trust-policy.json`):
Use the trust policy document from [IAM Trust Policy](#iam-trust-policy) section above.

**Execution Policy** (`execution-policy.json`):
See [Execution Role Policy](#execution-role-policy) section below.

### Step 3: Create Tooling Role

Create the tooling role used to deploy and destroy infrastructure:

```bash
aws iam create-role \
  --role-name github-actions-e2e-tooling \
  --assume-role-policy-document file://trust-policy.json \
  --region us-east-1

aws iam put-role-policy \
  --role-name github-actions-e2e-tooling \
  --policy-name tooling-policy \
  --policy-document file://tooling-policy.json \
  --region us-east-1
```

**Trust Policy** (`trust-policy.json`):
Use the trust policy document from [IAM Trust Policy](#iam-trust-policy) section above.

**Tooling Policy** (`tooling-policy.json`):
See [Tooling Role Policy](#tooling-role-policy) section below.

### Step 4: Configure GitHub Secrets

1. Navigate to the GitHub repository: `nxsflow/amplify-overtone`
2. Go to **Settings** > **Secrets and variables** > **Actions**
3. Create `E2E_TEST_ACCOUNTS`:
   - Click **New repository secret**
   - Name: `E2E_TEST_ACCOUNTS`
   - Value: JSON array from [E2E_TEST_ACCOUNTS](#e2e_test_accounts) section above (one entry per AWS account)
   - Click **Add secret**
4. Create `E2E_REGIONS`:
   - Click **New repository secret**
   - Name: `E2E_REGIONS`
   - Value: JSON array from [E2E_REGIONS](#e2e_regions) section above
   - Click **Add secret**

### Step 5: Verify Workflow Access

Trigger a test workflow manually to verify OIDC token exchange works:

```bash
# In a feature branch, push a change that triggers the E2E workflow
git push origin your-feature-branch
```

Check the GitHub Actions workflow run:

- Click the workflow run
- Expand the **Assume AWS Role** step (or equivalent)
- Verify success: "Successfully assumed role arn:aws:iam::..."

If the workflow fails with `AccessDenied`, check:

1. Trust policy conditions match the GitHub Actions workflow
2. OIDC provider is registered in the AWS account
3. Role ARNs in `E2E_TEST_ACCOUNTS` secret are correct

## Permission Policies

### Execution Role Policy

Grants permissions needed to run E2E tests against deployed infrastructure. Restricted to read-only and invocation-only actions on deployed resources.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "InvokeLambda",
      "Effect": "Allow",
      "Action": ["lambda:InvokeFunction"],
      "Resource": "arn:aws:lambda:*:ACCOUNT_ID:function/test-infra-*"
    },
    {
      "Sid": "ReadS3TestData",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::test-infra-*", "arn:aws:s3:::test-infra-*/*"]
    },
    {
      "Sid": "SendEmailViaSES",
      "Effect": "Allow",
      "Action": ["ses:SendEmail", "ses:SendRawEmail"],
      "Resource": "*"
    },
    {
      "Sid": "GetSecretsForTestData",
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:*:ACCOUNT_ID:secret:test-infra/*"
    },
    {
      "Sid": "GetCognitoCredentials",
      "Effect": "Allow",
      "Action": ["cognito-idp:InitiateAuth", "cognito-idp:AdminInitiateAuth"],
      "Resource": "arn:aws:cognito-idp:*:ACCOUNT_ID:userpool/*"
    }
  ]
}
```

**Replace** `ACCOUNT_ID` with the AWS account number.

**Actions Explained**:

- **lambda:InvokeFunction**: Allows test code to invoke Lambda functions deployed by test infrastructure (API endpoints, background jobs)
- **s3:GetObject / s3:ListBucket**: Allows reading test data and fixtures from S3 buckets
- **ses:SendEmail / ses:SendRawEmail**: Allows tests to send emails to verify email functionality
- **secretsmanager:GetSecretValue**: Allows tests to retrieve stored test credentials (e.g., test user credentials)
- **cognito-idp:InitiateAuth / cognito-idp:AdminInitiateAuth**: Allows tests to authenticate with Cognito user pool

### Tooling Role Policy

Grants permissions to deploy and destroy test infrastructure. Includes full CloudFormation, Cognito, S3, and IAM management.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudFormationFull",
      "Effect": "Allow",
      "Action": ["cloudformation:*"],
      "Resource": "*"
    },
    {
      "Sid": "CognitoFull",
      "Effect": "Allow",
      "Action": ["cognito-idp:*", "cognito-identity:*"],
      "Resource": "*"
    },
    {
      "Sid": "S3Full",
      "Effect": "Allow",
      "Action": ["s3:*"],
      "Resource": "*"
    },
    {
      "Sid": "SESFull",
      "Effect": "Allow",
      "Action": ["ses:*"],
      "Resource": "*"
    },
    {
      "Sid": "IAMRoleManagement",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:ListRolePolicies",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:GetRolePolicy",
        "iam:CreatePolicy",
        "iam:DeletePolicy",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PassRole"
      ],
      "Resource": "arn:aws:iam::ACCOUNT_ID:role/test-infra-*"
    },
    {
      "Sid": "LambdaFull",
      "Effect": "Allow",
      "Action": ["lambda:*"],
      "Resource": "*"
    },
    {
      "Sid": "APIGatewayFull",
      "Effect": "Allow",
      "Action": ["apigateway:*"],
      "Resource": "*"
    },
    {
      "Sid": "SecretsManagerFull",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:CreateSecret",
        "secretsmanager:DeleteSecret",
        "secretsmanager:PutSecretValue",
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:*:ACCOUNT_ID:secret:test-infra/*"
    },
    {
      "Sid": "DynamoDBFull",
      "Effect": "Allow",
      "Action": ["dynamodb:*"],
      "Resource": "*"
    },
    {
      "Sid": "PassRoleToServices",
      "Effect": "Allow",
      "Action": ["iam:PassRole"],
      "Resource": "arn:aws:iam::ACCOUNT_ID:role/test-infra-*"
    }
  ]
}
```

**Replace** `ACCOUNT_ID` with the AWS account number.

**Actions Explained**:

- **cloudformation:\*** : Full access to CloudFormation (deploy, update, delete stacks)
- **cognito-idp:\***/ **cognito-identity:\*** : Full access to Cognito user pools and identity providers
- **s3:\*** : Full access to S3 buckets (create, delete, configure)
- **ses:\*** : Full access to SES (configure email domains, SMTP credentials, sending permissions)
- **iam:CreateRole, DeleteRole, PutRolePolicy, PassRole**: Manage IAM roles for Lambda execution
- **lambda:\*** : Full access to Lambda functions
- **apigateway:\*** : Full access to API Gateway (deploy APIs)
- **secretsmanager:CreateSecret, DeleteSecret, PutSecretValue**: Manage test secrets
- **dynamodb:\*** : Full access to DynamoDB (for test infrastructure that uses DynamoDB)

## Local Development

For local E2E testing (running tests on your machine), AWS credentials are obtained via AWS SSO, not OIDC. The `.env` file configures which AWS profile to use.

### Setup

1. **Configure AWS SSO** (one-time):

   ```bash
   aws configure sso
   # Follow prompts to configure SSO for your organization
   ```

2. **Create `.env` file** (from template):

   ```bash
   cp .env.example .env
   ```

3. **Configure `.env`**:

   ```
   AWS_PROFILE=amplify-overtone-dev
   AWS_REGION=us-east-1
   ```

   Set `AWS_PROFILE` to the SSO profile name configured in step 1.

4. **Login to AWS SSO**:

   ```bash
   pnpm aws:login
   ```

   This command calls `aws sso login --profile $AWS_PROFILE` to refresh temporary credentials.

### Local Workflow

```bash
# 1. Login to AWS SSO
pnpm aws:login

# 2. Deploy test infrastructure (creates S3, Cognito, SES)
pnpm test-infra:deploy

# 3. Run E2E tests
pnpm e2e:test

# 4. When done, tear down infrastructure
pnpm test-infra:destroy
```

### Local vs GitHub Actions

| Aspect             | Local                                            | GitHub Actions                               |
| ------------------ | ------------------------------------------------ | -------------------------------------------- |
| Credentials Source | AWS SSO + `.env` profile                         | OIDC token + IAM role assumption             |
| Account            | Shared dev account                               | Dedicated E2E accounts (optionally multiple) |
| Permissions        | User's own IAM permissions                       | Execution role + tooling role                |
| Duration           | Credentials expire after 12 hours (configurable) | Token-based, ~1 hour validity                |
| Cleanup            | Manual (`pnpm test-infra:destroy`)               | Automated workflow step                      |

### Common Issues

**Issue**: `pnpm aws:login` fails with "The SSO authorization request was not approved"

**Solution**: Check that your AWS SSO session is active. Run `aws sso login --profile $AWS_PROFILE` directly to debug.

**Issue**: `pnpm test-infra:deploy` fails with "AccessDenied"

**Solution**: Ensure your AWS SSO user has permissions to create CloudFormation stacks, Cognito user pools, S3 buckets, and SES configuration. Contact your AWS account administrator.

**Issue**: E2E tests fail with "User does not have permission to assume role"

**Solution**: This indicates the local user profile is different from the GitHub Actions test account. Verify `AWS_PROFILE` in `.env` matches an account where test infrastructure has been deployed.
