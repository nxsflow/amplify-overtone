#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:?Usage: cdk.sh <deploy|destroy>}"

# Load .env from repo root
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: .env file not found at $ENV_FILE"
    echo "Copy .env.example to .env and fill in your values."
    exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

if [ -z "${AWS_PROFILE:-}" ]; then
    echo "Error: AWS_PROFILE is not set in $ENV_FILE"
    exit 1
fi

CDK_CMD="npx cdk $ACTION --profile $AWS_PROFILE --require-approval never --app 'npx tsx bin/app.ts'"

echo "Running: cdk $ACTION (profile: $AWS_PROFILE)"
eval "$CDK_CMD"

# After deploy, write outputs to overtone_test_infra.json
if [ "$ACTION" = "deploy" ]; then
    OUTPUT_FILE="$REPO_ROOT/overtone_test_infra.json"
    echo "Writing stack outputs to $OUTPUT_FILE"
    npx cdk metadata --profile "$AWS_PROFILE" --app 'npx tsx bin/app.ts' 2>/dev/null || true
    echo "Deploy complete. Test infra outputs written to overtone_test_infra.json"
fi
