#!/usr/bin/env bash
set -euo pipefail

# Load .env from repo root
ENV_FILE="$(cd "$(dirname "$0")/../../.." && pwd)/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: .env file not found at $ENV_FILE"
    echo "Copy .env.example to .env and fill in your values."
    exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

# Validate required variables
for var in TEST_RECIPIENT_DOMAIN TEST_RECIPIENT_HOSTED_ZONE_ID TEST_RECIPIENT_HOSTED_ZONE_DOMAIN; do
    if [ -z "${!var:-}" ]; then
        echo "Error: $var is not set in $ENV_FILE"
        exit 1
    fi
done

ACTION="${1:?Usage: cdk.sh <deploy|destroy>}"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
STACK_NAME="OvertoneTestInfraStack"

CDK_ARGS=(
    --context "recipientDomain=$TEST_RECIPIENT_DOMAIN"
    --context "hostedZoneId=$TEST_RECIPIENT_HOSTED_ZONE_ID"
    --context "hostedZoneDomain=$TEST_RECIPIENT_HOSTED_ZONE_DOMAIN"
)

if [ -n "${AWS_PROFILE:-}" ]; then
    CDK_ARGS+=(--profile "$AWS_PROFILE")
fi

# Auto-approve for non-interactive environments
if [ "$ACTION" = "deploy" ]; then
    CDK_ARGS+=(--require-approval never)
elif [ "$ACTION" = "destroy" ]; then
    CDK_ARGS+=(--force)
fi

cd "$SCRIPT_DIR"
npx cdk "$ACTION" "${CDK_ARGS[@]}"

# After deploy, assemble overtone_test_infra.json from CFN outputs + Secrets Manager
if [ "$ACTION" = "deploy" ]; then
    OUTPUT_FILE="$REPO_ROOT/overtone_test_infra.json"
    echo ""
    echo "Assembling $OUTPUT_FILE from stack outputs..."

    PROFILE_ARG=""
    if [ -n "${AWS_PROFILE:-}" ]; then
        PROFILE_ARG="--profile $AWS_PROFILE"
    fi

    # Read CFN stack outputs
    STACK_OUTPUTS=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        $PROFILE_ARG \
        --query "Stacks[0].Outputs" \
        --output json)

    get_output() {
        echo "$STACK_OUTPUTS" | node -e "
            const outputs = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf-8'));
            const match = outputs.find(o => o.OutputKey === '$1');
            process.stdout.write(match ? match.OutputValue : '');
        "
    }

    USER_POOL_ID=$(get_output "UserPoolId")
    USER_POOL_CLIENT_ID=$(get_output "UserPoolClientId")
    RECEIPT_S3_BUCKET=$(get_output "ReceiptS3BucketName")
    RECIPIENT_DOMAIN=$(get_output "RecipientDomain")
    SECRET_ARN=$(get_output "TestUsersSecretArn")

    # Read test user credentials from Secrets Manager
    TEST_USERS=$(aws secretsmanager get-secret-value \
        --secret-id "$SECRET_ARN" \
        $PROFILE_ARG \
        --query "SecretString" \
        --output text)

    # Assemble the output JSON
    # Uses process.argv to avoid shell quoting issues with special chars in passwords
    node -e "
        const [,, outputFile, userPoolId, userPoolClientId, receiptS3Bucket, recipientDomain, testUsersJson] = process.argv;
        const testUsers = JSON.parse(testUsersJson);
        const output = { userPoolId, userPoolClientId, receiptS3Bucket, recipientDomain, testUsers };
        require('fs').writeFileSync(outputFile, JSON.stringify(output, null, 4) + '\n');
    " "$OUTPUT_FILE" "$USER_POOL_ID" "$USER_POOL_CLIENT_ID" "$RECEIPT_S3_BUCKET" "$RECIPIENT_DOMAIN" "$TEST_USERS"

    echo "Written: $OUTPUT_FILE"
fi
