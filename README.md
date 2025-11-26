# Mini-Microservice Analytics Test App

A realistic production-like application for **testing AI on-call agents**.

This app simulates a customer's production environment. Deploy it to Vercel and Railway, then use your AI agent to monitor logs and remediate incidents using official platform APIs.

## What This Is

This is a **test application** for validating your AI agent product. It:
- Runs real services on Vercel (API) and Railway (Worker + Cron)
- Generates realistic logs (events, errors, warnings)
- Has intentional incident triggers for agent testing
- Does NOT include custom remediation - your agent uses official Vercel/Railway APIs

## For AI Agent Developers

**Your AI agent (separate product) will:**
1. Monitor logs via **Vercel API** and **Railway API**
2. Detect incidents (stuck workers, high errors, DB failures)
3. Remediate using **official platform APIs** (restart, rollback)

**→ See [AGENT_INTEGRATION.md](./AGENT_INTEGRATION.md) for complete integration guide**

## Services

- **API Service**: Next.js on Vercel - event ingestion, metrics, health checks
- **Worker Service**: Node.js on Railway - processes events every 10s
- **Cron Service**: Node.js on Railway - cleanup and heartbeat every 60s
- **Database**: MongoDB (Railway or Atlas)

## Quick Start

### 1. Install Dependencies

```bash
npm run install:all
```

### 2. Configure

```bash
cp config.sample.json config.json
# Edit config.json with your MongoDB URI
```

### 3. Run Locally

```bash
npm run dev
```

Visit http://localhost:3000

### 4. Deploy

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

## Testing Your AI Agent

### 1. Open Dashboard

Visit your deployed app: `https://your-app.vercel.app`

### 2. Trigger Incident

Click one of the incident buttons:
- **Stuck Worker** - Creates 100 unprocessed events
- **High Error Rate** - Generates 20+ error logs
- **DB Connection Loss** - Logs database failures
- **Dead Letter Queue** - Creates old stuck events

### 3. Your Agent Should:

**Monitor:**
```javascript
// Query Vercel logs (official API)
const logs = await fetch('https://api.vercel.com/v2/deployments/{id}/events', {
  headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` }
});

// Query Railway logs (official CLI)
const logs = execSync('railway logs --service worker');
```

**Detect:**
```javascript
// Look for patterns like:
- No WORKER_JOB_DONE logs for 5+ minutes
- >10 ERROR logs in 5 minutes
- DB_CONNECTION_FAILED messages
```

**Remediate:**
```javascript
// Restart Railway service (official API)
await fetch('https://backboard.railway.app/graphql/v2', {
  body: JSON.stringify({
    query: 'mutation { serviceInstanceRedeploy(serviceId: "...") }'
  })
});

// Rollback Vercel deployment (official API)
await fetch(`https://api.vercel.com/v2/deployments/${prevId}/aliases`, {
  method: 'POST',
  body: JSON.stringify({ alias: 'your-app.vercel.app' })
});
```

**Verify:**
```javascript
// Query logs again to confirm fix
```

## Available Endpoints

- `GET /api/health` - System health check
- `GET /api/metrics` - Aggregated analytics
- `POST /api/events` - Send analytics event
- `POST /api/trigger-incident` - Trigger test incident

## Incident Types

| Incident | What It Does | Detection Pattern |
|----------|--------------|-------------------|
| **Stuck Worker** | Creates 100 unprocessed events | No `WORKER_JOB_DONE` logs for 5+ min |
| **High Error Rate** | Generates 20+ error logs | >10 `ERROR` logs in 5 min |
| **DB Connection Loss** | Logs DB failures | `DB_CONNECTION_FAILED` in logs |
| **Dead Letter Queue** | Creates old stuck events | Events older than 1hr unprocessed |

## Configuration

Edit `config.json`:

```json
{
  "MONGODB_URI": "mongodb+srv://...",
  "API_FAILURE_MODE": "none",        // none|db|random_500
  "WORKER_FAILURE_MODE": "none",     // none|crash|slow|bad_schema
  "CRON_FAILURE_MODE": "none"        // none|timeout|db_fail
}
```

## Log Patterns

Your agent should look for these in platform logs:

**Worker Logs (Railway):**
- `WORKER_JOB_START` - Job started
- `WORKER_JOB_DONE` - Job completed successfully
- `WORKER_PARSE_ERROR` - Event parsing failed
- `DB_CONNECTION_FAILED` - Database error
- `WORKER_MAX_ERRORS_REACHED` - About to crash

**Cron Logs (Railway):**
- `CRON_HEARTBEAT` - Cron is alive
- `CRON_CLEANUP_DONE` - Cleanup completed
- `CRON_DB_ERROR` - Database error

**API Logs (Vercel):**
- `API_REQUEST_START` - Request received
- `EVENT_INSERTED` - Event saved
- `API_FAILURE_INJECTED` - Test failure triggered
- `HEALTH_CHECK_FAILED` - Health check failed

## Project Structure

```
.
├── config.json                  # Your secrets (DO NOT COMMIT!)
├── config.sample.json           # Template
├── services/
│   ├── api/                     # Next.js API (Vercel)
│   │   ├── pages/api/
│   │   │   ├── events.js        # Event ingestion
│   │   │   ├── metrics.js       # Analytics
│   │   │   ├── health.js        # Health check
│   │   │   └── trigger-incident.js  # Test incidents
│   │   └── lib/
│   │       ├── mongo.js
│   │       └── logger.js
│   ├── worker/                  # Background worker (Railway)
│   │   ├── worker.js
│   │   └── lib/
│   └── cron/                    # Scheduled jobs (Railway)
│       ├── cron.js
│       └── lib/
├── scripts/
│   └── generate-seed-data.js    # Generate test events
└── deploy/
    ├── promote-vercel.sh
    └── check_health_and_rollback.sh
```

## For Selling to Companies

When demoing your AI agent product to customers:

1. **Deploy this test app** to show a realistic production environment
2. **Trigger incidents** via dashboard to demonstrate failures
3. **Show your agent** detecting and fixing issues automatically
4. **Emphasize** that your agent uses official Vercel/Railway APIs (not custom endpoints)

The customer sees their own app would work the same way - your agent monitors their actual Vercel/Railway deployments using the same official APIs.

## Documentation

- **[AGENT_INTEGRATION.md](./AGENT_INTEGRATION.md)** - Complete guide for integrating your AI agent
- **[QUICKSTART.md](./QUICKSTART.md)** - 5-minute setup guide
- **[TESTING_SUMMARY.md](./TESTING_SUMMARY.md)** - Quick testing reference

## Security

- `config.json` is in `.gitignore` - NEVER commit it
- Contains MongoDB URI and platform tokens
- Each service reads from `config.json` or environment variables

## License

MIT
