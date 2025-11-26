#!/bin/bash

# Railway Worker Restart Script
# Reads configuration from config.json and restarts the worker service on Railway

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

# Extract values from config.json
RAILWAY_TOKEN=$(grep -o '"RAILWAY_TOKEN"[^,]*' "$CONFIG_FILE" | sed 's/.*": *"\([^"]*\)".*/\1/')
RAILWAY_PROJECT_ID=$(grep -o '"RAILWAY_PROJECT_ID"[^,]*' "$CONFIG_FILE" | sed 's/.*": *"\([^"]*\)".*/\1/')
RAILWAY_SERVICE_ID_WORKER=$(grep -o '"RAILWAY_SERVICE_ID_WORKER"[^,]*' "$CONFIG_FILE" | sed 's/.*": *"\([^"]*\)".*/\1/')

if [ -z "$RAILWAY_TOKEN" ] || [ "$RAILWAY_TOKEN" = "<YOUR_RAILWAY_TOKEN>" ]; then
  echo "ERROR: RAILWAY_TOKEN not configured in config.json"
  exit 1
fi

if [ -z "$RAILWAY_SERVICE_ID_WORKER" ] || [ "$RAILWAY_SERVICE_ID_WORKER" = "<SERVICE_ID_FOR_WORKER>" ]; then
  echo "ERROR: RAILWAY_SERVICE_ID_WORKER not configured in config.json"
  exit 1
fi

echo "=== Railway Worker Restart Script ==="
echo "Project ID: $RAILWAY_PROJECT_ID"
echo "Service ID: $RAILWAY_SERVICE_ID_WORKER"
echo "Dry run: $DRY_RUN"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo "[DRY RUN] Would restart worker service on Railway"
  echo "[DRY RUN] GraphQL mutation: serviceInstanceRedeploy"
  exit 0
fi

# Railway GraphQL API endpoint
RAILWAY_API="https://backboard.railway.app/graphql/v2"

# GraphQL mutation to redeploy service
QUERY='mutation serviceRedeploy($serviceId: String!) {
  serviceInstanceRedeploy(serviceId: $serviceId)
}'

VARIABLES=$(cat <<EOF
{
  "serviceId": "$RAILWAY_SERVICE_ID_WORKER"
}
EOF
)

echo "Redeploying worker service..."

RESPONSE=$(curl -s -X POST "$RAILWAY_API" \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$QUERY" | jq -Rs .), \"variables\": $VARIABLES}")

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q "errors"; then
  echo "ERROR: Failed to redeploy service"
  echo "$RESPONSE"
  exit 1
fi

echo "✓ Worker service redeployment initiated successfully"
echo ""
echo "Monitor deployment status in Railway dashboard:"
echo "https://railway.app/project/$RAILWAY_PROJECT_ID"
