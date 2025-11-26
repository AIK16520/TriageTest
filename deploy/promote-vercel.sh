#!/bin/bash

# Vercel Promotion Script
# Promotes a previous Vercel deployment to production alias using config.json

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$ROOT_DIR/config.json"

DRY_RUN=false
DEPLOYMENT_ID=""

# Parse arguments
for arg in "$@"; do
  if [ "$arg" = "--dry-run" ]; then
    DRY_RUN=true
  elif [ -z "$DEPLOYMENT_ID" ]; then
    DEPLOYMENT_ID="$arg"
  fi
done

# Check if config.json exists
if [ ! -f "$CONFIG_FILE" ]; then
  echo "ERROR: config.json not found at $CONFIG_FILE"
  echo "Please copy config.sample.json to config.json and fill in your values."
  exit 1
fi

# Extract values from config.json
VERCEL_TOKEN=$(grep -o '"VERCEL_TOKEN"[^,]*' "$CONFIG_FILE" | sed 's/.*": *"\([^"]*\)".*/\1/')
VERCEL_PROJECT_ID=$(grep -o '"VERCEL_PROJECT_ID"[^,]*' "$CONFIG_FILE" | sed 's/.*": *"\([^"]*\)".*/\1/')
VERCEL_PROD_ALIAS=$(grep -o '"VERCEL_PROD_ALIAS"[^,]*' "$CONFIG_FILE" | sed 's/.*": *"\([^"]*\)".*/\1/')
VERCEL_TEAM_ID=$(grep -o '"VERCEL_TEAM_ID"[^,]*' "$CONFIG_FILE" | sed 's/.*": *"\([^"]*\)".*/\1/')

if [ -z "$VERCEL_TOKEN" ] || [ "$VERCEL_TOKEN" = "<YOUR_VERCEL_TOKEN>" ]; then
  echo "ERROR: VERCEL_TOKEN not configured in config.json"
  exit 1
fi

echo "=== Vercel Promotion Script ==="
echo "Project ID: $VERCEL_PROJECT_ID"
echo "Production Alias: $VERCEL_PROD_ALIAS"
echo "Dry run: $DRY_RUN"
echo ""

# If no deployment ID provided, fetch the latest
if [ -z "$DEPLOYMENT_ID" ]; then
  echo "No deployment ID provided. Fetching latest deployment..."

  TEAM_PARAM=""
  if [ -n "$VERCEL_TEAM_ID" ] && [ "$VERCEL_TEAM_ID" != "<VERCEL_TEAM_ID (optional)>" ]; then
    TEAM_PARAM="?teamId=$VERCEL_TEAM_ID"
  fi

  DEPLOYMENTS=$(curl -s -X GET "https://api.vercel.com/v6/deployments$TEAM_PARAM" \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    -H "Content-Type: application/json")

  # Extract the first deployment URL (requires jq for proper parsing)
  # For simplicity, we'll provide instructions
  echo "Latest deployments response (use jq to parse):"
  echo "$DEPLOYMENTS" | head -20
  echo ""
  echo "To promote a specific deployment, run:"
  echo "  bash deploy/promote-vercel.sh <deployment-id>"
  echo ""
  echo "Or install jq and we can automate this."
  exit 0
fi

echo "Promoting deployment: $DEPLOYMENT_ID"

if [ "$DRY_RUN" = true ]; then
  echo "[DRY RUN] Would promote deployment $DEPLOYMENT_ID to $VERCEL_PROD_ALIAS"
  exit 0
fi

# Assign alias to deployment
TEAM_PARAM=""
if [ -n "$VERCEL_TEAM_ID" ] && [ "$VERCEL_TEAM_ID" != "<VERCEL_TEAM_ID (optional)>" ]; then
  TEAM_PARAM="?teamId=$VERCEL_TEAM_ID"
fi

RESPONSE=$(curl -s -X POST "https://api.vercel.com/v2/deployments/$DEPLOYMENT_ID/aliases$TEAM_PARAM" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"alias\": \"$VERCEL_PROD_ALIAS\"}")

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q "error"; then
  echo "ERROR: Failed to promote deployment"
  exit 1
fi

echo "✓ Deployment $DEPLOYMENT_ID promoted to $VERCEL_PROD_ALIAS"
