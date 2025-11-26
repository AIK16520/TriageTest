#!/bin/bash

# Vercel Deployment Script
# Reads configuration from config.json and deploys the API service to Vercel

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_FILE="$ROOT_DIR/config.json"

DRY_RUN=false

# Parse arguments
for arg in "$@"; do
  if [ "$arg" = "--dry-run" ]; then
    DRY_RUN=true
  fi
done

# Check if config.json exists
if [ ! -f "$CONFIG_FILE" ]; then
  echo "ERROR: config.json not found at $CONFIG_FILE"
  echo "Please copy config.sample.json to config.json and fill in your values."
  exit 1
fi

# Extract values from config.json (requires jq or manual parsing)
# For cross-platform compatibility, we'll use basic grep/sed
VERCEL_TOKEN=$(grep -o '"VERCEL_TOKEN"[^,]*' "$CONFIG_FILE" | sed 's/.*": *"\([^"]*\)".*/\1/')
VERCEL_PROJECT_ID=$(grep -o '"VERCEL_PROJECT_ID"[^,]*' "$CONFIG_FILE" | sed 's/.*": *"\([^"]*\)".*/\1/')
VERCEL_TEAM_ID=$(grep -o '"VERCEL_TEAM_ID"[^,]*' "$CONFIG_FILE" | sed 's/.*": *"\([^"]*\)".*/\1/')

if [ -z "$VERCEL_TOKEN" ] || [ "$VERCEL_TOKEN" = "<YOUR_VERCEL_TOKEN>" ]; then
  echo "ERROR: VERCEL_TOKEN not configured in config.json"
  exit 1
fi

if [ -z "$VERCEL_PROJECT_ID" ] || [ "$VERCEL_PROJECT_ID" = "<YOUR_VERCEL_PROJECT_ID>" ]; then
  echo "ERROR: VERCEL_PROJECT_ID not configured in config.json"
  exit 1
fi

echo "=== Vercel Deployment Script ==="
echo "Project ID: $VERCEL_PROJECT_ID"
echo "Team ID: ${VERCEL_TEAM_ID:-<not set>}"
echo "Dry run: $DRY_RUN"
echo ""

# Build the deployment
cd "$SCRIPT_DIR"

if [ "$DRY_RUN" = true ]; then
  echo "[DRY RUN] Would build and deploy to Vercel"
  echo "[DRY RUN] Command: curl -X POST https://api.vercel.com/v13/deployments ..."
  exit 0
fi

echo "Building Next.js application..."
npm run build

echo "Creating deployment archive..."
# Note: Vercel CLI is typically used, but for API-only approach:
# We would use Vercel's REST API to create deployment
# For simplicity, we recommend using Vercel CLI: vercel --token=$VERCEL_TOKEN

echo ""
echo "=== DEPLOYMENT INSTRUCTIONS ==="
echo "For full API-based deployment, implement file upload to Vercel API."
echo "Recommended: Use Vercel CLI for deployment:"
echo ""
echo "  npm i -g vercel"
echo "  vercel --token=$VERCEL_TOKEN --prod"
echo ""
echo "Or use the Vercel GitHub integration for automatic deployments."
echo ""
echo "For API-based deployment, see: https://vercel.com/docs/rest-api/endpoints#create-a-new-deployment"
echo "=== END ==="
