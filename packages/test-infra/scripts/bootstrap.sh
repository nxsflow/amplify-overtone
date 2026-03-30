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

# Validate required variables (needed for CDK app synthesis)
for var in TEST_RECIPIENT_DOMAIN TEST_RECIPIENT_HOSTED_ZONE_ID TEST_RECIPIENT_HOSTED_ZONE_DOMAIN; do
    if [ -z "${!var:-}" ]; then
        echo "Error: $var is not set in $ENV_FILE"
        exit 1
    fi
done

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

CDK_ARGS=(
    --context "recipientDomain=$TEST_RECIPIENT_DOMAIN"
    --context "hostedZoneId=$TEST_RECIPIENT_HOSTED_ZONE_ID"
    --context "hostedZoneDomain=$TEST_RECIPIENT_HOSTED_ZONE_DOMAIN"
)

if [ -n "${AWS_PROFILE:-}" ]; then
    CDK_ARGS+=(--profile "$AWS_PROFILE")
fi

cd "$SCRIPT_DIR"
npx cdk bootstrap "${CDK_ARGS[@]}"
