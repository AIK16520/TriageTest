#!/bin/bash

# Health Check and Rollback Script
# Deploys, waits, checks health, and rolls back if unhealthy

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$ROOT_DIR/config.json"

WAIT_TIME=30
DRY_RUN=false
PREVIOUS_DEPLOYMENT_ID=""

# Parse arguments
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --wait)
      WAIT_TIME="$2"
      shift 2
      ;;
    --previous-deployment)
      PREVIOUS_DEPLOYMENT_ID="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Check if config.json exists
if [ ! -f "$CONFIG_FILE" ]; then
  echo "ERROR: config.json not found at $CONFIG_FILE"
  exit 1
fi

# Extract values from config.json
VERCEL_PROD_ALIAS=$(grep -o '"VERCEL_PROD_ALIAS"[^,]*' "$CONFIG_FILE" | sed 's/.*": *"\([^"]*\)".*/\1/')

echo "=== Health Check and Rollback Script ==="
echo "Production URL: https://$VERCEL_PROD_ALIAS"
echo "Wait time: ${WAIT_TIME}s"
echo "Dry run: $DRY_RUN"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo "[DRY RUN] Would perform the following steps:"
  echo "  1. Deploy to Vercel (vercel-deploy.sh)"
  echo "  2. Wait ${WAIT_TIME}s for deployment to stabilize"
  echo "  3. Check health endpoint: https://$VERCEL_PROD_ALIAS/api/health"
  echo "  4. If unhealthy, rollback to: $PREVIOUS_DEPLOYMENT_ID"
  exit 0
fi

echo "Step 1: Deploying to Vercel..."
# Note: This assumes vercel-deploy.sh handles the actual deployment
# For a complete implementation, capture the new deployment ID
echo "  (Run vercel-deploy.sh manually or integrate here)"
echo ""

echo "Step 2: Waiting ${WAIT_TIME}s for deployment to stabilize..."
sleep "$WAIT_TIME"
echo ""

echo "Step 3: Checking health endpoint..."
HEALTH_URL="https://$VERCEL_PROD_ALIAS/api/health"

HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$HEALTH_URL" || echo "000")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | head -n -1)

echo "  HTTP Status: $HTTP_CODE"
echo "  Response: $HEALTH_BODY"
echo ""

if [ "$HTTP_CODE" = "200" ] && echo "$HEALTH_BODY" | grep -q "healthy"; then
  echo "✓ Health check PASSED"
  echo "✓ Deployment is healthy and serving traffic"
  exit 0
else
  echo "✗ Health check FAILED"
  echo "  Expected: HTTP 200 with 'healthy' status"
  echo "  Got: HTTP $HTTP_CODE"
  echo ""

  if [ -n "$PREVIOUS_DEPLOYMENT_ID" ]; then
    echo "Step 4: Rolling back to previous deployment: $PREVIOUS_DEPLOYMENT_ID"
    bash "$SCRIPT_DIR/promote-vercel.sh" "$PREVIOUS_DEPLOYMENT_ID"
    echo ""
    echo "Rollback complete. Verifying health..."
    sleep 10

    ROLLBACK_HEALTH=$(curl -s "$HEALTH_URL")
    echo "  Rollback health: $ROLLBACK_HEALTH"
  else
    echo "Step 4: No previous deployment ID provided, cannot rollback"
    echo "  Provide --previous-deployment <id> for automatic rollback"
  fi

  exit 1
fi
