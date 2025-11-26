# AI Agent Testing Guide

This guide explains how to test your on-call AI agent using this analytics application.

## Overview

Your AI agent should:
1. **Monitor** by querying Vercel/Railway logs directly
2. **Detect** incidents (stuck workers, high error rates, DB failures)
3. **Remediate** by calling fix APIs (restart, rollback, clear queue)

## Architecture for Agent

```
┌─────────────────────┐
│   Your AI Agent     │
└──────┬──────────────┘
       │
       ├──► Query Vercel Logs (API service)
       ├──► Query Railway Logs (Worker/Cron)
       ├──► Call /api/health (health check)
       └──► Call /api/fix/* (remediation)
```

## Setup for Agent Testing

### 1. Deploy the App

```bash
# API on Vercel
# Worker on Railway
# Cron on Railway
```

### 2. Configure Tokens

Your agent needs these in `config.json`:
- `VERCEL_TOKEN` - To query Vercel logs
- `RAILWAY_TOKEN` - To query Railway logs
- API URL - To call remediation endpoints

## How Your Agent Queries Logs

### Option 1: Use Provided Scripts (Recommended)

```bash
# Query Vercel logs (API service)
node scripts/query-vercel-logs.js

# Query Railway logs (Worker)
node scripts/query-railway-logs.js worker

# Query Railway logs (Cron)
node scripts/query-railway-logs.js cron
```

These scripts:
- Fetch logs from Vercel/Railway APIs
- Parse and analyze log content
- Provide agent recommendations

### Option 2: Direct API Calls

#### Vercel Logs API

```javascript
const VERCEL_TOKEN = config.VERCEL_TOKEN;

// 1. Get latest deployment
const deployments = await fetch('https://api.vercel.com/v6/deployments?limit=1', {
  headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` }
}).then(r => r.json());

const deploymentId = deployments.deployments[0].uid;

// 2. Get logs for deployment
const logs = await fetch(`https://api.vercel.com/v2/deployments/${deploymentId}/events?limit=100`, {
  headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` }
}).then(r => r.json());

// 3. Analyze logs
logs.forEach(log => {
  const text = log.text || '';
  if (text.includes('ERROR')) {
    // Agent detected error
  }
});
```

#### Railway Logs (via CLI)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Authenticate
railway login --token $RAILWAY_TOKEN

# Get logs
railway logs --service worker --project $RAILWAY_PROJECT_ID
```

Or in your agent code:

```javascript
const { execSync } = require('child_process');

const logs = execSync(
  `railway logs --service worker --project ${RAILWAY_PROJECT_ID}`,
  { env: { ...process.env, RAILWAY_TOKEN }, encoding: 'utf8' }
);

// Parse logs
const lines = logs.split('\n');
lines.forEach(line => {
  if (line.includes('WORKER_JOB_DONE')) {
    // Worker is healthy
  }
});
```

## Available Remediation Endpoints

### Health Check
```bash
GET https://your-app.vercel.app/api/health

Response:
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2025-01-15T10:00:00.000Z"
}
```

### Restart Service
```bash
POST https://your-app.vercel.app/api/fix/restart
Content-Type: application/json

{
  "service": "worker",  # or "cron"
  "reason": "High error rate detected in Railway logs"
}
```

### Rollback Deployment
```bash
POST https://your-app.vercel.app/api/fix/rollback
Content-Type: application/json

{
  "deploymentId": "dpl_xxxxxxxxxxxxx",
  "reason": "Errors detected in Vercel logs after deployment"
}
```

### Clear Stuck Queue
```bash
POST https://your-app.vercel.app/api/fix/clear-queue
Content-Type: application/json

{
  "reason": "Worker stuck, detected in Railway logs"
}
```

## Testing Scenarios

### Scenario 1: Stuck Worker

**Trigger Incident:**
```bash
# Via dashboard: Click "Stuck Worker" button
# Or via API:
curl -X POST https://your-app.vercel.app/api/trigger-incident \
  -H "Content-Type: application/json" \
  -d '{"incident": "stuck_worker"}'
```

**Agent Workflow:**

1. **Query Railway Logs:**
```bash
node scripts/query-railway-logs.js worker
```

2. **Agent Detects:**
- No `WORKER_JOB_DONE` logs in last 5 minutes
- Events are piling up (100 created)

3. **Agent Remediates:**
```bash
curl -X POST https://your-app.vercel.app/api/fix/clear-queue \
  -H "Content-Type: application/json" \
  -d '{"reason": "Worker stuck - no WORKER_JOB_DONE logs"}'
```

4. **Agent Verifies:**
```bash
# Wait 30 seconds
node scripts/query-railway-logs.js worker
# Should see WORKER_JOB_DONE logs resuming
```

---

### Scenario 2: High Error Rate

**Trigger:**
```bash
curl -X POST https://your-app.vercel.app/api/trigger-incident \
  -d '{"incident": "high_error_rate"}'
```

**Agent Workflow:**

1. **Query Logs:**
```bash
node scripts/query-railway-logs.js worker
```

2. **Agent Detects:**
```
LOG ANALYSIS:
{
  "total": 150,
  "errors": 25,  ← High!
  "patterns": {
    "workerParseError": 20
  }
}

AGENT RECOMMENDATION:
⚠️  HIGH ERROR RATE detected
   Action: POST /api/fix/restart {"service": "worker"}
```

3. **Agent Remediates:**
```bash
curl -X POST https://your-app.vercel.app/api/fix/restart \
  -d '{"service": "worker", "reason": "25 errors in Railway logs"}'
```

4. **Monitor:**
- Continue checking logs every 30s
- Verify error rate decreases

---

### Scenario 3: DB Connection Loss

**Trigger:**
```bash
curl -X POST https://your-app.vercel.app/api/trigger-incident \
  -d '{"incident": "db_connection_loss"}'
```

**Agent Workflow:**

1. **Query Logs:**
```bash
node scripts/query-railway-logs.js worker
```

2. **Agent Detects:**
```
LOG ANALYSIS:
{
  "patterns": {
    "dbConnectionFailure": 5  ← DB issues!
  }
}

AGENT RECOMMENDATION:
⚠️  DB CONNECTION FAILURES detected
   Action: POST /api/fix/restart {"service": "worker"}
```

3. **Remediate:**
```bash
curl -X POST https://your-app.vercel.app/api/fix/restart \
  -d '{"service": "worker", "reason": "DB_CONNECTION_FAILED in logs"}'
```

4. **Verify:**
```bash
# Check health
curl https://your-app.vercel.app/api/health

# If still failing after 60s, escalate to human
```

---

### Scenario 4: API Errors (Vercel)

**Trigger:**
```bash
# Set failure mode in config.json
"API_FAILURE_MODE": "random_500"

# Then send events
npm run seed
```

**Agent Workflow:**

1. **Query Vercel Logs:**
```bash
node scripts/query-vercel-logs.js
```

2. **Agent Detects:**
```
LOG ANALYSIS:
{
  "total": 200,
  "errors": 60,  ← High API errors!
  "patterns": {
    "apiFailureInjected": 60
  }
}

AGENT RECOMMENDATION:
⚠️  HIGH ERROR RATE detected
   Consider rolling back deployment
```

3. **Get Previous Deployment ID:**
```bash
# From Vercel dashboard or API
# Let's say previous good deployment: dpl_abc123
```

4. **Rollback:**
```bash
curl -X POST https://your-app.vercel.app/api/fix/rollback \
  -d '{"deploymentId": "dpl_abc123", "reason": "High error rate in Vercel logs"}'
```

---

## Agent Decision Logic

```javascript
// Pseudocode for your agent

async function monitorAndRemediate() {
  while (true) {
    // 1. Query logs from platforms
    const vercelLogs = await queryVercelLogs();
    const railwayLogsWorker = await queryRailwayLogs('worker');
    const railwayLogsCron = await queryRailwayLogs('cron');

    // 2. Analyze
    const vercelAnalysis = analyzeLogs(vercelLogs);
    const workerAnalysis = analyzeLogs(railwayLogsWorker);

    // 3. Detect issues
    if (vercelAnalysis.errors > 10) {
      // High API errors → Rollback
      await callAPI('POST', '/api/fix/rollback', {
        deploymentId: getPreviousDeploymentId(),
        reason: `High error rate: ${vercelAnalysis.errors} errors`
      });
    }

    if (workerAnalysis.patterns.dbConnectionFailure > 0) {
      // DB issues → Restart worker
      await callAPI('POST', '/api/fix/restart', {
        service: 'worker',
        reason: 'DB connection failures detected'
      });
    }

    if (workerAnalysis.patterns.workerStuck) {
      // Worker stuck → Clear queue
      await callAPI('POST', '/api/fix/clear-queue', {
        reason: 'No WORKER_JOB_DONE logs in 5+ minutes'
      });
    }

    // 4. Wait before next check
    await sleep(60000); // 1 minute
  }
}
```

## Testing Your Agent

### 1. Manual Test

```bash
# Terminal 1: Trigger incident
curl -X POST https://your-app.vercel.app/api/trigger-incident \
  -d '{"incident": "stuck_worker"}'

# Terminal 2: Check what agent sees
node scripts/query-railway-logs.js worker

# Terminal 3: Agent takes action
curl -X POST https://your-app.vercel.app/api/fix/clear-queue \
  -d '{"reason": "Agent test"}'

# Terminal 2: Verify fix
node scripts/query-railway-logs.js worker
```

### 2. Automated Agent Test

```javascript
// test-agent.js
const { execSync } = require('child_process');

async function testAgent() {
  console.log('1. Triggering incident...');
  await fetch('https://your-app.vercel.app/api/trigger-incident', {
    method: 'POST',
    body: JSON.stringify({ incident: 'stuck_worker' })
  });

  console.log('2. Waiting 10 seconds...');
  await new Promise(r => setTimeout(r, 10000));

  console.log('3. Agent queries logs...');
  const logs = execSync('node scripts/query-railway-logs.js worker', {
    encoding: 'utf8'
  });

  console.log(logs);

  console.log('4. Agent decides to remediate...');
  await fetch('https://your-app.vercel.app/api/fix/clear-queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Agent detected stuck worker' })
  });

  console.log('5. Agent verifies fix...');
  await new Promise(r => setTimeout(r, 30000));

  const healthRes = await fetch('https://your-app.vercel.app/api/health');
  const health = await healthRes.json();

  console.log('Health:', health.status);
}

testAgent();
```

## Log Patterns to Detect

Your agent should look for these patterns:

### In Railway Worker Logs:
- `WORKER_JOB_START` but no `WORKER_JOB_DONE` → Worker stuck
- `WORKER_PARSE_ERROR` (>10 in 5 min) → High error rate
- `DB_CONNECTION_FAILED` → Database issue
- `WORKER_MAX_ERRORS_REACHED` → Worker about to crash

### In Railway Cron Logs:
- `CRON_DB_ERROR` → Database issue
- No `CRON_HEARTBEAT` in 5+ min → Cron not running

### In Vercel API Logs:
- HTTP 500 responses (>10%) → API errors
- `API_FAILURE_INJECTED` → Testing mode active
- `HEALTH_CHECK_FAILED` → System unhealthy

## Success Criteria

Your agent passes if it:

✅ Queries Vercel and Railway logs correctly
✅ Detects all 4 incident types within 2 minutes
✅ Calls correct remediation endpoint
✅ Verifies fix by re-querying logs
✅ Doesn't false alarm on normal operations
✅ Logs all actions with reasoning

## Tips

1. **Use the query scripts** - They handle authentication and parsing
2. **Look for log patterns** - `WORKER_JOB_DONE`, `ERROR`, `DB_CONNECTION_FAILED`
3. **Implement backoff** - Don't restart more than once per 5 min
4. **Verify fixes** - Always re-query logs after remediation
5. **Escalate when stuck** - If 3 attempts fail, alert human

## Next Steps

1. Deploy your app to Vercel + Railway
2. Configure tokens in `config.json`
3. Test log query scripts: `node scripts/query-vercel-logs.js`
4. Trigger incidents via dashboard
5. Build your agent to monitor and remediate
6. Test all 4 scenarios

---

**Quick Reference:** [TESTING_SUMMARY.md](./TESTING_SUMMARY.md)
