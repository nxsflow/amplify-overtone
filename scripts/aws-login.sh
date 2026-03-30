#!/usr/bin/env bash
set -euo pipefail

# Load .env from repo root
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"
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

echo "Logging in with profile: $AWS_PROFILE"
aws sso login --profile "$AWS_PROFILE"
