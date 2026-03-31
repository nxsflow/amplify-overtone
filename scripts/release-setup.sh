#!/usr/bin/env bash
set -euo pipefail

# release-setup.sh — One-time setup for CI/CD release pipeline
#
# Configures:
#   1. NPM_TOKEN as a GitHub repository secret (for npm publishing)
#   2. "production" GitHub environment with required reviewers (for stable release approval)
#
# Prerequisites:
#   - gh CLI authenticated (`gh auth login`)
#   - NPM_TOKEN set in .env (generate at https://www.npmjs.com/settings/<user>/tokens)

REPO="nxsflow/amplify-overtone"

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

# ── Validate prerequisites ─────────────────────────────────────────

if ! command -v gh &>/dev/null; then
    echo "Error: gh CLI is not installed. Install it: https://cli.github.com/"
    exit 1
fi

if ! gh auth status &>/dev/null; then
    echo "Error: gh CLI is not authenticated. Run: gh auth login"
    exit 1
fi

if [ -z "${NPM_TOKEN:-}" ]; then
    echo "Error: NPM_TOKEN is not set in $ENV_FILE"
    echo ""
    echo "To generate a token:"
    echo "  1. Go to https://www.npmjs.com/settings/<your-username>/tokens"
    echo "  2. Click 'Generate New Token' → 'Automation'"
    echo "  3. Copy the token and add it to .env as NPM_TOKEN=npm_..."
    exit 1
fi

echo "Setting up release pipeline for $REPO..."
echo ""

# ── 1. Set NPM_TOKEN as GitHub repository secret ──────────────────

echo "→ Setting NPM_TOKEN repository secret..."
gh secret set NPM_TOKEN --repo "$REPO" --body "$NPM_TOKEN"
echo "  ✓ NPM_TOKEN secret set"
echo ""

# ── 2. Create "production" environment with required reviewers ─────

echo "→ Creating 'production' environment..."

# Get the authenticated user's ID for the reviewer
GH_USER=$(gh api user --jq '.login')
GH_USER_ID=$(gh api user --jq '.id')

# Create the environment with protection rules
# Uses the GitHub REST API directly since `gh environment` doesn't support all options
gh api \
    --method PUT \
    "repos/$REPO/environments/production" \
    -f "wait_timer=0" \
    -f "prevent_self_review=false" \
    --input - <<JSON
{
    "reviewers": [
        {
            "type": "User",
            "id": $GH_USER_ID
        }
    ],
    "deployment_branch_policy": {
        "protected_branches": true,
        "custom_branch_policies": false
    }
}
JSON

echo "  ✓ 'production' environment created with $GH_USER as required reviewer"
echo ""

# ── Summary ────────────────────────────────────────────────────────

echo "Release pipeline setup complete!"
echo ""
echo "  ✓ NPM_TOKEN — GitHub repository secret for npm publishing"
echo "  ✓ production — GitHub environment with required reviewer ($GH_USER)"
echo ""
echo "Next steps:"
echo "  1. Add GitHub Actions workflow files (.github/workflows/ci.yml, release.yml, prerelease.yml)"
echo "  2. Merge a PR with a changeset to trigger the release pipeline"
