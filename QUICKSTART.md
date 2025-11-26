# Quick Start Guide

Get your Mini-Microservice Analytics app running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- MongoDB database (Railway or Atlas free tier)
- Accounts: Vercel (free), Railway (free)

## Setup Steps

### 1. Install Dependencies (1 min)

```bash
npm run install:all
```

### 2. Configure Secrets (2 min)

```bash
# Copy the sample config
cp config.sample.json config.json

# Edit config.json and fill in:
# - MONGODB_URI: Get from Railway or Atlas
# - Other fields can wait until deployment
```

Minimum required for local development:
- `MONGODB_URI` - Your MongoDB connection string

### 3. Run Locally (1 min)

```bash
# Start all services
npm run dev
```

This starts:
- API on http://localhost:3000
- Worker (polls every 10s)
- Cron (runs every 60s)

### 4. Test It (1 min)

```bash
# Send test events
npm run seed

# Wait 10-15 seconds, then check metrics
curl http://localhost:3000/api/metrics

# Check health
curl http://localhost:3000/api/health
```

## Next Steps

### Deploy to Production

1. **Get tokens** from Vercel and Railway
2. **Fill in config.json** with all deployment credentials
3. **Deploy API** to Vercel
4. **Deploy Worker & Cron** to Railway
5. **Test production** endpoints

See [README.md](./README.md#deployment) for detailed deployment instructions.

### Test Failure Modes

Edit `config.json`:

```json
{
  "API_FAILURE_MODE": "random_500",
  "WORKER_FAILURE_MODE": "slow",
  "CRON_FAILURE_MODE": "none"
}
```

Restart services and observe logs.

## Troubleshooting

**Can't connect to MongoDB?**
- Check MONGODB_URI format
- Whitelist 0.0.0.0/0 in Atlas (for development)
- Verify database user credentials

**Services not starting?**
- Check `config.json` exists
- Run `npm run install:all` again
- Check Node.js version (need 18+)

**Worker not processing events?**
- Verify worker is running (`npm run dev:worker`)
- Check MongoDB connection in logs
- Send events first: `npm run seed`

## Useful Commands

```bash
# Start all services
npm run dev

# Start individual services
npm run dev:api
npm run dev:worker
npm run dev:cron

# Generate test data
npm run seed
node scripts/generate-seed-data.js --count 100

# Test API endpoints
curl http://localhost:3000/api/health
curl http://localhost:3000/api/metrics
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","action":"click"}'
```

## What's Running?

| Service | Port | Purpose |
|---------|------|---------|
| API | 3000 | HTTP endpoints for events and metrics |
| Worker | - | Background processor (no HTTP port) |
| Cron | - | Scheduled cleanup (no HTTP port) |

## File Structure Quick Reference

```
services/
├── api/          → Next.js API (Vercel)
├── worker/       → Background processor (Railway)
└── cron/         → Scheduled jobs (Railway)

config.json       → Your secrets (NEVER commit!)
package.json      → Root scripts (npm run dev, etc.)
README.md         → Full documentation
```

## Default Behavior

- **Worker** polls every 10 seconds, processes up to 50 events per batch
- **Cron** runs every 60 seconds, deletes records older than 30 days
- **API** validates events and stores in `events_raw` collection
- **Logs** emit both JSON (structured) and plain text (unstructured)

## Configuration Options

Edit `config.json`:

```json
{
  "MONGODB_URI": "...",              // Required
  "LOG_LEVEL": "info",               // debug|info|warn|error
  "API_FAILURE_MODE": "none",        // none|db|random_500
  "WORKER_FAILURE_MODE": "none",     // none|crash|slow|bad_schema
  "CRON_FAILURE_MODE": "none"        // none|timeout|db_fail
}
```

---

**Ready for more?** See [README.md](./README.md) for complete documentation, deployment guides, and test plans.
