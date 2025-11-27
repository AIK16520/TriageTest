# Mini-Microservice Analytics Test App

A realistic production-like application for testing AI on-call agents.

## 1. What the App Is

This is a test application that simulates a customer's real production environment. It's designed to help you build and validate AI agents that can monitor applications, detect incidents, and automatically remediate issues using official Vercel and Railway APIs.

The app consists of three services:
- **API Service** (Vercel): Handles event ingestion, metrics, and health checks
- **Worker Service** (Railway): Background processor that runs every 10 seconds
- **Cron Service** (Railway): Cleanup tasks that run every 60 seconds
- **Database** (MongoDB): Stores events, metrics, and system state

## 2. What the Code Does

**API Service (Next.js on Vercel):**
- `/api/events` - Receives analytics events from users
- `/api/metrics` - Returns aggregated analytics data
- `/api/health` - Health check endpoint (status, database connection)
- `/api/trigger-incident` - Manually trigger test incidents for agent testing
- Dashboard at `/` - UI to view metrics and trigger incidents

**Worker Service (Node.js on Railway):**
- Polls `events_raw` collection every 10 seconds
- Processes up to 50 events per batch
- Aggregates metrics by user and action
- Moves processed events to `events_processed` collection
- Logs: `WORKER_JOB_START`, `WORKER_JOB_DONE`, `WORKER_PARSE_ERROR`, `DB_CONNECTION_FAILED`

**Cron Service (Node.js on Railway):**
- Runs every 60 seconds
- Deletes records older than 30 days from processed events
- Updates heartbeat in `cron_status` collection
- Logs: `CRON_HEARTBEAT`, `CRON_CLEANUP_DONE`, `CRON_DB_ERROR`

**Logging:**
- All services emit structured JSON logs to stdout
- Vercel and Railway automatically capture these logs
- Your AI agent queries these logs using official platform APIs

## 3. What Vercel Does

Vercel hosts the Next.js API service and provides:

**Deployment:**
- Hosts the API endpoints at your production domain
- Automatically builds and deploys from Git
- Provides serverless function execution

**Logs:**
- Captures all console.log output from API routes
- Stores logs accessible via Vercel REST API
- Your agent queries: `GET https://api.vercel.com/v2/deployments/{id}/events`

**What Your Agent Can Do:**
- **Monitor**: Query Vercel API for deployment logs and error rates
- **Rollback**: Use Vercel API to rollback to previous deployment if errors detected
- **Example**: High API error rate (>10 errors in 5 min) triggers rollback

## 4. What Railway Does

Railway hosts the Worker and Cron services and provides:

**Deployment:**
- Runs Node.js services as containers
- Provides persistent processes (not serverless)
- Auto-restarts on crashes

**Logs:**
- Captures all console.log output from services
- Accessible via Railway CLI or GraphQL API
- Your agent queries: `railway logs --service worker`

**What Your Agent Can Do:**
- **Monitor**: Query Railway logs for worker status, error patterns
- **Restart**: Use Railway GraphQL API to restart stuck or failing services
- **Example**: No `WORKER_JOB_DONE` logs for 5+ minutes triggers restart

## 5. How to Trigger Errors and How to Fix

### Triggering Incidents

**Option 1: Via Dashboard**
1. Open your deployed app: `https://your-app.vercel.app`
2. Click one of the incident buttons

**Option 2: Via API**
```bash
curl -X POST https://your-app.vercel.app/api/trigger-incident \
  -H "Content-Type: application/json" \
  -d '{"incident": "stuck_worker"}'
```

### Available Incidents

**FIXABLE BY AGENT (Restart/Rollback):**

**1. Stuck Worker**
- **What it does**: Creates 100 unprocessed events in MongoDB
- **How to detect**: No `WORKER_JOB_DONE` logs in Railway for 5+ minutes
- **How to fix**: Restart Railway worker service via GraphQL API
```bash
# Your agent should call:
POST https://backboard.railway.app/graphql/v2
mutation { serviceInstanceRedeploy(serviceId: "worker-id") }
```

**2. High Error Rate**
- **What it does**: Generates 20+ error logs in worker
- **How to detect**: >10 `WORKER_PARSE_ERROR` logs in 5 minutes
- **How to fix**: Restart Railway worker service
```bash
# Same as above - restart the worker
```

**3. Bad Deployment**
- **What it does**: Creates 15+ API errors in Vercel logs
- **How to detect**: >10 HTTP 500 errors in Vercel logs in 5 minutes
- **How to fix**: Rollback Vercel deployment to previous version
```bash
# Your agent should call Vercel API:
POST https://api.vercel.com/v2/deployments/{previous-id}/aliases
Body: {"alias": "your-app.vercel.app"}
```

**REQUIRES DEVELOPER INTERVENTION (Not Fixable by Restart):**

**4. DB Connection Loss**
- **What it does**: Logs 5+ database connection failures
- **How to detect**: `DB_CONNECTION_FAILED` errors in Railway logs
- **What agent should do**: Attempt restart once, then escalate to developer
- **Why not fixable**: Database is down - restart won't help

**5. Persistent Errors**
- **What it does**: Creates 30 events that fail schema validation
- **How to detect**: `WORKER_PERSISTENT_ERROR` with retries=5 in logs
- **What agent should do**: Detect errors persist after restart, escalate to developer
- **Why not fixable**: Code-level bug - requires code fix

---

## Quick Start

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Configure
```bash
cp config.sample.json config.json
# Edit config.json - add your MongoDB URI
```

### 3. Run Locally
```bash
npm run dev
```
Visit http://localhost:3000

### 4. Deploy to Production

**API to Vercel:**
```bash
cd services/api
vercel --prod
```

**Worker to Railway:**
```bash
cd services/worker
railway up
```

**Cron to Railway:**
```bash
cd services/cron
railway up
```

---

## API Endpoints

- `GET /api/health` - System health check
- `GET /api/metrics` - Aggregated analytics
- `POST /api/events` - Send analytics event
- `POST /api/trigger-incident` - Trigger test incident

## Configuration

Edit `config.json`:

```json
{
  "MONGODB_URI": "mongodb+srv://...",
  "VERCEL_TOKEN": "your-vercel-token",
  "RAILWAY_TOKEN": "your-railway-token",
  "API_FAILURE_MODE": "none",        // none|db|random_500
  "WORKER_FAILURE_MODE": "none",     // none|crash|slow|bad_schema
  "CRON_FAILURE_MODE": "none"        // none|timeout|db_fail
}
```

## Log Patterns for Agent Detection

**Worker Logs (Railway):**
- `WORKER_JOB_START` - Job started
- `WORKER_JOB_DONE` - Job completed successfully
- `WORKER_PARSE_ERROR` - Event parsing failed
- `DB_CONNECTION_FAILED` - Database error
- `WORKER_PERSISTENT_ERROR` - Code-level bug

**Cron Logs (Railway):**
- `CRON_HEARTBEAT` - Cron is alive
- `CRON_CLEANUP_DONE` - Cleanup completed
- `CRON_DB_ERROR` - Database error

**API Logs (Vercel):**
- `EVENT_INSERTED` - Event saved
- `API_FAILURE_INJECTED` - Test failure triggered
- `HEALTH_CHECK_FAILED` - Health check failed

---

## For AI Agent Developers

**Your AI Agent (Separate Product):**
1. Queries Vercel and Railway logs using official platform APIs
2. Detects incidents based on log patterns (see section 5 above)
3. Remediates by calling official Vercel/Railway APIs (restart/rollback)
4. Verifies fixes by re-querying logs

**See [AGENT_INTEGRATION.md](./AGENT_INTEGRATION.md) for complete integration guide**

---

## Project Structure

```
services/
├── api/                     # Next.js API (Vercel)
│   ├── pages/api/
│   │   ├── events.js        # Event ingestion
│   │   ├── metrics.js       # Analytics
│   │   ├── health.js        # Health check
│   │   └── trigger-incident.js
│   └── lib/
│       ├── mongo.js
│       └── logger.js
├── worker/                  # Background worker (Railway)
│   ├── worker.js
│   └── lib/
└── cron/                    # Scheduled jobs (Railway)
    ├── cron.js
    └── lib/

config.json                  # Your secrets (DO NOT COMMIT!)
config.sample.json           # Template
```

## Security

- `config.json` is in `.gitignore` - NEVER commit it
- Contains MongoDB URI, Vercel token, Railway token
- Each service reads from `config.json` or environment variables

## License

MIT
