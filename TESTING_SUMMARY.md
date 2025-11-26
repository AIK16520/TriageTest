# Quick Testing Summary

## How to Test Your AI Agent

### 1. Open Dashboard
```
https://your-app.vercel.app
```

### 2. Trigger Incident (Click Button on UI)
- **Stuck Worker** - 100 unprocessed events
- **High Error Rate** - 20 error logs
- **DB Connection Loss** - Database failure simulation
- **Dead Letter Queue** - 50 old stuck events

### 3. Agent Queries Platform Logs
```bash
# Agent reads logs from Vercel/Railway (NOT from the app)
node scripts/query-vercel-logs.js       # API service logs
node scripts/query-railway-logs.js worker  # Worker logs
```

### 4. Agent Remediates
```bash
# Agent calls one of these endpoints:
POST /api/fix/restart       # {"service": "worker"}
POST /api/fix/rollback      # {"deploymentId": "..."}
POST /api/fix/clear-queue   # {"reason": "..."}
```

### 5. Verify Fix
```bash
# Agent checks:
GET /api/health   # Should be "healthy" again
# Agent re-queries logs to confirm errors stopped
```

## Quick Test Commands

### Trigger Incident
```bash
curl -X POST https://your-app.vercel.app/api/trigger-incident \
  -H "Content-Type: application/json" \
  -d '{"incident": "stuck_worker"}'
```

### Check Logs (What Agent Sees)
```bash
node scripts/query-railway-logs.js worker
```

### Restart Worker (What Agent Does)
```bash
curl -X POST https://your-app.vercel.app/api/fix/restart \
  -H "Content-Type: application/json" \
  -d '{"service": "worker", "reason": "Agent detected high errors"}'
```

## Incident Detection Patterns

| Incident | Detection Signal | Remediation |
|----------|------------------|-------------|
| **Stuck Worker** | No `WORKER_JOB_DONE` logs for 5+ min | Clear queue or restart |
| **High Errors** | >10 ERROR logs in 5 minutes | Restart worker |
| **DB Connection** | `DB_CONNECTION_FAILED` in logs | Restart worker |
| **Dead Letter** | Old events (>1hr) in queue | Clear queue |

## Available Endpoints

### Health & Metrics
- `GET /api/health` - System health check
- `GET /api/metrics` - Aggregated analytics

### Incident Triggers
- `POST /api/trigger-incident` - Create test incidents

### Remediation (Agent Actions)
- `POST /api/fix/restart` - Restart worker/cron
- `POST /api/fix/rollback` - Rollback deployment
- `POST /api/fix/clear-queue` - Clear stuck events

## Full Guide

See [AGENT_TESTING_GUIDE.md](./AGENT_TESTING_GUIDE.md) for complete scenarios and agent code examples.
