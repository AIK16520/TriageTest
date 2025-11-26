# AI Agent Integration Guide

This test app simulates a customer's production application. Your AI agent will monitor it using **official Vercel and Railway APIs**.

## Architecture

```
┌─────────────────────────┐
│  Your AI Agent Product  │
└───────────┬─────────────┘
            │
            ├──► Vercel API (read logs, rollback)
            ├──► Railway API (read logs, restart)
            │
            ▼
    ┌───────────────┐
    │  Test App     │
    │  (Customer)   │
    │               │
    │  • Vercel     │
    │  • Railway    │
    │  • MongoDB    │
    └───────────────┘
```

## What This Test App Provides

This is a **realistic production app** that:
- Runs on Vercel (API service)
- Runs on Railway (Worker + Cron services)
- Uses MongoDB for data
- Generates realistic logs (events, errors, warnings)
- Has a dashboard to **trigger incidents** for testing

## How Your AI Agent Works

### 1. Monitor Logs

Your agent queries logs using official platform APIs:

#### Vercel Logs API
```bash
# Get latest deployment
GET https://api.vercel.com/v6/deployments?limit=1
Authorization: Bearer YOUR_VERCEL_TOKEN

# Get logs for deployment
GET https://api.vercel.com/v2/deployments/{deploymentId}/events
Authorization: Bearer YOUR_VERCEL_TOKEN
```

**Example (Node.js):**
```javascript
const response = await fetch('https://api.vercel.com/v6/deployments?limit=1', {
  headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` }
});
const { deployments } = await response.json();
const deploymentId = deployments[0].uid;

const logsRes = await fetch(
  `https://api.vercel.com/v2/deployments/${deploymentId}/events`,
  { headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` }}
);
const logs = await logsRes.json();
```

**Vercel API Docs:** https://vercel.com/docs/rest-api

---

#### Railway Logs (CLI)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Authenticate
railway login --token YOUR_RAILWAY_TOKEN

# Get logs
railway logs --service worker --project PROJECT_ID
```

**Example (Node.js):**
```javascript
const { execSync } = require('child_process');

const logs = execSync(
  'railway logs --service worker --project ' + RAILWAY_PROJECT_ID,
  {
    env: { ...process.env, RAILWAY_TOKEN },
    encoding: 'utf8'
  }
);

// Parse logs
const lines = logs.split('\n');
```

**Railway API Docs:** https://docs.railway.app/reference/public-api

---

### 2. Detect Incidents

Look for these patterns in logs:

| Pattern | Meaning | Action |
|---------|---------|--------|
| `WORKER_JOB_START` but no `WORKER_JOB_DONE` for 5+ min | Worker stuck | Restart worker |
| `WORKER_PARSE_ERROR` (>10 in 5 min) | High error rate | Restart worker |
| `DB_CONNECTION_FAILED` | Database issue | Restart worker |
| HTTP 500 responses (>10%) in Vercel logs | API errors | Rollback deployment |

---

### 3. Remediate Using Official APIs

#### Restart Service on Railway

```bash
# Using Railway CLI
railway service restart --service worker
```

**Using Railway GraphQL API:**
```javascript
const RAILWAY_API = 'https://backboard.railway.app/graphql/v2';

const mutation = `
  mutation serviceInstanceRedeploy($serviceId: String!) {
    serviceInstanceRedeploy(serviceId: $serviceId)
  }
`;

const response = await fetch(RAILWAY_API, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${RAILWAY_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: mutation,
    variables: { serviceId: RAILWAY_SERVICE_ID }
  })
});
```

---

#### Rollback Deployment on Vercel

```javascript
// 1. Get previous deployment
const deployments = await fetch(
  'https://api.vercel.com/v6/deployments?limit=10',
  { headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` }}
).then(r => r.json());

// Find last successful deployment (not current)
const previousDeployment = deployments.deployments
  .filter(d => d.state === 'READY')
  [1]; // Skip current, get previous

// 2. Promote to production
const response = await fetch(
  `https://api.vercel.com/v2/deployments/${previousDeployment.uid}/aliases`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      alias: 'your-app.vercel.app' // Your production domain
    })
  }
);
```

**Vercel Rollback Docs:** https://vercel.com/docs/rest-api/endpoints#assign-an-alias

---

## Testing Your Agent

### Step 1: Deploy Test App

```bash
# Deploy API to Vercel
cd services/api
vercel --prod

# Deploy Worker to Railway
cd services/worker
railway up

# Deploy Cron to Railway
cd services/cron
railway up
```

### Step 2: Get API Tokens

- **Vercel Token:** https://vercel.com/account/tokens
- **Railway Token:** https://railway.app/account/tokens

### Step 3: Trigger Incident

Open the dashboard: `https://your-app.vercel.app`

Click **"Stuck Worker"** button.

This creates 100 unprocessed events in MongoDB.

### Step 4: Agent Detects

Your agent queries Railway logs:

```javascript
const logs = await getRailwayLogs('worker');

// Parse logs
const hasWorkerJobDone = logs.includes('WORKER_JOB_DONE');
const lastJobTime = parseLastJobTime(logs);

if (!hasWorkerJobDone && (Date.now() - lastJobTime) > 300000) {
  // Worker stuck for 5+ minutes!
  console.log('🚨 INCIDENT DETECTED: Worker stuck');
}
```

### Step 5: Agent Remediates

```javascript
// Restart worker service
await restartRailwayService('worker');

console.log('✅ Worker restarted');
```

### Step 6: Agent Verifies

```javascript
// Wait 30 seconds
await sleep(30000);

// Check logs again
const newLogs = await getRailwayLogs('worker');

if (newLogs.includes('WORKER_JOB_DONE')) {
  console.log('✅ Incident resolved');
} else {
  console.log('❌ Incident persists, escalating...');
}
```

---

## Test Scenarios

### 1. Stuck Worker
```bash
# Trigger via dashboard
Click "Stuck Worker"

# Or via API
curl -X POST https://your-app.vercel.app/api/trigger-incident \
  -d '{"incident":"stuck_worker"}'
```

**Expected Behavior:**
- Agent detects: No `WORKER_JOB_DONE` logs
- Agent action: Restart Railway worker service
- Agent verifies: Logs show `WORKER_JOB_DONE` resuming

---

### 2. High Error Rate
```bash
Click "High Error Rate"
```

**Expected Behavior:**
- Agent detects: >20 `ERROR` logs in Railway
- Agent action: Restart Railway worker service
- Agent verifies: Error rate drops

---

### 3. DB Connection Loss
```bash
Click "DB Connection Loss"
```

**Expected Behavior:**
- Agent detects: `DB_CONNECTION_FAILED` in logs
- Agent action: Restart Railway worker service
- Agent verifies: Logs show successful connection

---

### 4. API Errors (Rollback Test)
```bash
# Enable failure mode in config.json
"API_FAILURE_MODE": "random_500"

# Send traffic
npm run seed
```

**Expected Behavior:**
- Agent detects: High 500 errors in Vercel logs
- Agent action: Rollback to previous Vercel deployment
- Agent verifies: Error rate drops

---

## Example Agent Code

```javascript
// agent.js - Your AI Agent Product

const POLL_INTERVAL = 60000; // 1 minute

async function monitorAndRemediate() {
  while (true) {
    try {
      // 1. Query logs from platforms
      const vercelLogs = await getVercelLogs();
      const railwayLogs = await getRailwayLogs('worker');

      // 2. Analyze for incidents
      const incidents = detectIncidents(vercelLogs, railwayLogs);

      // 3. Take action
      for (const incident of incidents) {
        console.log(`🚨 Detected: ${incident.type}`);

        if (incident.type === 'worker_stuck') {
          await restartRailwayService('worker');
          await verifyFix(incident);
        }

        if (incident.type === 'high_api_errors') {
          await rollbackVercelDeployment();
          await verifyFix(incident);
        }
      }

    } catch (error) {
      console.error('Agent error:', error);
    }

    await sleep(POLL_INTERVAL);
  }
}

function detectIncidents(vercelLogs, railwayLogs) {
  const incidents = [];

  // Check for stuck worker
  const hasRecentJobDone = railwayLogs
    .filter(log => log.message.includes('WORKER_JOB_DONE'))
    .some(log => Date.now() - new Date(log.timestamp) < 300000);

  if (!hasRecentJobDone) {
    incidents.push({ type: 'worker_stuck', severity: 'high' });
  }

  // Check for high error rate
  const errorCount = railwayLogs
    .filter(log => log.level === 'ERROR').length;

  if (errorCount > 10) {
    incidents.push({ type: 'high_error_rate', severity: 'medium' });
  }

  return incidents;
}

async function restartRailwayService(service) {
  // Use Railway API to restart
  const response = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RAILWAY_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: `mutation { serviceInstanceRedeploy(serviceId: "${SERVICE_ID}") }`
    })
  });

  return response.json();
}

// Start agent
monitorAndRemediate();
```

---

## API Reference

### Test App Endpoints

- `GET /api/health` - Check app health
- `GET /api/metrics` - View analytics
- `POST /api/trigger-incident` - Trigger test incident
- `POST /api/events` - Send analytics event

### Platform APIs Your Agent Uses

- **Vercel:** https://vercel.com/docs/rest-api
- **Railway:** https://docs.railway.app/reference/public-api

---

## Success Criteria

Your agent passes testing if it:

✅ Queries Vercel and Railway logs using official APIs
✅ Detects all 4 incident types within 2 minutes
✅ Remediates using official platform APIs (restart/rollback)
✅ Verifies fixes by re-querying logs
✅ Doesn't false alarm on normal operations

---

## Support

This test app is designed to help you build and test your AI agent product. The app itself is simple - your agent is where the intelligence lives!
