# Mini-Microservice Analytics Test App

A complete developer-ready analytics application demonstrating a microservice architecture with:

- **API Service**: Next.js API on Vercel
- **Worker Service**: Background processor on Railway
- **Cron Service**: Scheduled cleanup on Railway
- **Database**: MongoDB (Railway or Atlas)

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   API       │────▶ │   MongoDB    │ ◀────│   Worker    │
│  (Vercel)   │      │              │      │  (Railway)  │
└─────────────┘      └──────────────┘      └─────────────┘
                            ▲
                            │
                     ┌─────────────┐
                     │    Cron     │
                     │  (Railway)  │
                     └─────────────┘
```

## Features

- Event ingestion via REST API
- Asynchronous event processing with worker
- Metrics aggregation and reporting
- Scheduled cleanup and heartbeat monitoring
- Configurable failure injection for testing
- Structured + unstructured logging
- Health checks and monitoring
- Deployment automation with rollback support

## Project Structure

```
.
├── config.json                    # Your secrets (DO NOT COMMIT!)
├── config.sample.json             # Template for configuration
├── package.json                   # Root package with scripts
├── services/
│   ├── api/                       # Next.js API service
│   │   ├── pages/api/
│   │   │   ├── events.js          # POST /api/events - event ingestion
│   │   │   ├── metrics.js         # GET /api/metrics - view aggregated metrics
│   │   │   └── health.js          # GET /api/health - health check
│   │   ├── lib/
│   │   │   ├── mongo.js           # MongoDB connection
│   │   │   └── logger.js          # Logging utility
│   │   ├── vercel-deploy.sh       # Vercel deployment script
│   │   └── package.json
│   ├── worker/                    # Background worker service
│   │   ├── worker.js              # Main worker (polls and processes events)
│   │   ├── lib/
│   │   │   ├── mongo.js
│   │   │   └── logger.js
│   │   ├── railway-restart.sh     # Railway deployment script
│   │   └── package.json
│   └── cron/                      # Scheduled cron service
│       ├── cron.js                # Cleanup and heartbeat
│       ├── lib/
│       │   ├── mongo.js
│       │   └── logger.js
│       └── package.json
├── deploy/
│   ├── promote-vercel.sh          # Promote deployment to production
│   └── check_health_and_rollback.sh  # Health check with auto-rollback
├── scripts/
│   └── generate-seed-data.js      # Generate test events
└── logs/
    └── sample_logs.jsonl          # Example log output
```

## Setup

### 1. Clone and Install

```bash
npm run install:all
```

This installs dependencies for the root project and all services.

### 2. Configure Secrets

**IMPORTANT**: Copy the sample configuration and fill in your actual values:

```bash
cp config.sample.json config.json
```

Edit `config.json` and fill in:

- **MONGODB_URI**: Your MongoDB connection string (Railway MongoDB or Atlas)
- **VERCEL_TOKEN**: Get from https://vercel.com/account/tokens
- **VERCEL_PROJECT_ID**: Create a project on Vercel, find ID in settings
- **VERCEL_TEAM_ID**: (Optional) If using a team account
- **VERCEL_PROD_ALIAS**: Your production domain (e.g., `myapp.vercel.app`)
- **RAILWAY_TOKEN**: Get from https://railway.app/account/tokens
- **RAILWAY_PROJECT_ID**: Create a Railway project, find ID in settings
- **RAILWAY_SERVICE_ID_WORKER**: Worker service ID from Railway
- **RAILWAY_SERVICE_ID_CRON**: Cron service ID from Railway

**⚠️ SECURITY WARNING**:
- `config.json` is in `.gitignore` - NEVER commit it to Git!
- This file contains sensitive credentials
- Store production secrets securely (e.g., 1Password, AWS Secrets Manager)

### 3. Setup MongoDB

#### Option A: Railway MongoDB

```bash
# In Railway dashboard:
# 1. Create new project
# 2. Add MongoDB plugin
# 3. Copy connection string to config.json MONGODB_URI
```

#### Option B: MongoDB Atlas

```bash
# 1. Create free cluster at https://cloud.mongodb.com
# 2. Create database user
# 3. Whitelist all IPs (0.0.0.0/0) for development
# 4. Get connection string and add to config.json
```

### 4. Setup Collections

MongoDB collections will be created automatically:

- `events_raw` - Unprocessed events
- `events_processed` - Processed events
- `metrics` - Aggregated metrics
- `cron_status` - Cron heartbeat status

## Local Development

### Run All Services (Recommended)

```bash
npm run dev
```

This runs API, Worker, and Cron concurrently.

### Run Services Individually

```bash
# Terminal 1 - API (http://localhost:3000)
npm run dev:api

# Terminal 2 - Worker
npm run dev:worker

# Terminal 3 - Cron
npm run dev:cron
```

### Test the API

```bash
# Send a test event
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{"userId": "user_001", "action": "page_view"}'

# Check metrics
curl http://localhost:3000/api/metrics

# Health check
curl http://localhost:3000/api/health
```

### Generate Seed Data

```bash
# Generate 20 events (default)
npm run seed

# Generate 100 events
node scripts/generate-seed-data.js --count 100

# Target specific API
node scripts/generate-seed-data.js --url https://your-api.vercel.app/api/events
```

## Failure Injection Modes

Test failure scenarios by modifying `config.json`:

### API Failure Modes

```json
"API_FAILURE_MODE": "none"          // No failures
"API_FAILURE_MODE": "db"            // Simulate DB connection failure (503)
"API_FAILURE_MODE": "random_500"    // 30% chance of 500 error
```

### Worker Failure Modes

```json
"WORKER_FAILURE_MODE": "none"       // No failures
"WORKER_FAILURE_MODE": "crash"      // Immediate crash (process.exit)
"WORKER_FAILURE_MODE": "slow"       // 5-second delay per batch
"WORKER_FAILURE_MODE": "bad_schema" // 50% chance of schema parse error
```

### Cron Failure Modes

```json
"CRON_FAILURE_MODE": "none"         // No failures
"CRON_FAILURE_MODE": "timeout"      // 30-second delay (simulates timeout)
"CRON_FAILURE_MODE": "db_fail"      // Simulated DB connection failure
```

## Deployment

### Deploy API to Vercel

#### Option 1: Using Vercel CLI (Recommended)

```bash
cd services/api

# Install Vercel CLI
npm i -g vercel

# Deploy (uses token from config.json if set as env var)
vercel --token=$(grep -o '"VERCEL_TOKEN"[^,]*' ../../config.json | sed 's/.*": *"\([^"]*\)".*/\1/')
```

#### Option 2: Using Deployment Script

```bash
cd services/api

# Dry run (see what would happen)
bash vercel-deploy.sh --dry-run

# Actual deployment
bash vercel-deploy.sh
```

**Note**: The script provides instructions. For full automation, implement Vercel API file upload or use GitHub integration.

### Deploy Worker to Railway

```bash
cd services/worker

# Create new service in Railway dashboard
# Connect to GitHub repo (recommended) or:

# Deploy via Railway CLI
railway up

# Or use restart script (requires service already created)
bash railway-restart.sh --dry-run
bash railway-restart.sh
```

### Deploy Cron to Railway

```bash
cd services/cron

# Create new service in Railway dashboard
# Set cron schedule in Railway: "*/1 * * * *" (every minute)
# Or use sleep mode and let the app run continuously

railway up
```

## Deployment Scripts

### Promote Previous Deployment

```bash
# List recent deployments
bash deploy/promote-vercel.sh

# Promote specific deployment to production
bash deploy/promote-vercel.sh <deployment-id>

# Dry run
bash deploy/promote-vercel.sh --dry-run <deployment-id>
```

### Health Check with Rollback

```bash
# Check health and rollback if unhealthy
bash deploy/check_health_and_rollback.sh \
  --wait 30 \
  --previous-deployment <deployment-id>

# Dry run
bash deploy/check_health_and_rollback.sh --dry-run
```

## Monitoring and Logs

### Log Format

All services emit both structured JSON and unstructured logs:

```json
{"timestamp":"2025-01-15T10:23:45.123Z","level":"INFO","service":"api","message":"EVENT_INSERTED","userId":"user_001"}
```

```
[2025-01-15T10:23:45.123Z] INFO [api] EVENT_INSERTED | userId="user_001"
```

### Key Log Events

#### API
- `API_REQUEST_START` - Request received
- `EVENT_INSERTED` - Event saved to DB
- `VALIDATION_ERROR` - Invalid request data
- `API_FAILURE_INJECTED` - Failure mode triggered
- `HEALTH_CHECK_OK` / `HEALTH_CHECK_FAILED`

#### Worker
- `WORKER_JOB_START` - Processing batch started
- `WORKER_PROCESSING` - Events being processed
- `WORKER_JOB_DONE` - Batch completed
- `WORKER_PARSE_ERROR` - Invalid event schema
- `DB_CONNECTION_FAILED` - Database error

#### Cron
- `CRON_JOB_START` - Job started
- `CRON_CLEANUP_DONE` - Old records deleted
- `CRON_HEARTBEAT` - Heartbeat updated
- `CRON_DB_ERROR` - Database error

### View Logs

```bash
# Railway (Worker/Cron)
railway logs --service worker
railway logs --service cron

# Vercel (API)
vercel logs <deployment-url>
```

## Test Plan

### 1. Basic Functionality Test

```bash
# Start all services locally
npm run dev

# Send events
npm run seed

# Wait 10-15 seconds for worker to process

# Check metrics
curl http://localhost:3000/api/metrics

# Expected: metrics.totalEvents > 0
```

### 2. Failure Mode Tests

#### Test API Random Failures

```json
// In config.json
"API_FAILURE_MODE": "random_500"
```

```bash
# Send multiple events, ~30% should fail with 500
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/events \
    -H "Content-Type: application/json" \
    -d '{"userId":"test","action":"test"}'
done
```

Expected: Mix of 201 success and 500 errors in logs.

#### Test Worker Crash

```json
// In config.json
"WORKER_FAILURE_MODE": "crash"
```

```bash
npm run dev:worker
# Expected: Worker exits immediately with FAILURE_INJECTION log
```

#### Test Worker Slow Processing

```json
// In config.json
"WORKER_FAILURE_MODE": "slow"
```

```bash
npm run dev:worker
# Expected: Each batch takes 5+ seconds, logs show delay
```

#### Test Cron Timeout

```json
// In config.json
"CRON_FAILURE_MODE": "timeout"
```

```bash
npm run dev:cron
# Expected: 30-second delay before CRON_CLEANUP_DONE
```

### 3. Health Check Test

```bash
# With services running
curl http://localhost:3000/api/health

# Expected: {"status":"healthy","database":"connected"}
```

```bash
# Stop MongoDB or use invalid URI
# Expected: {"status":"unhealthy","database":"disconnected"}
```

### 4. Deployment Script Tests

```bash
# Test Vercel deploy (dry run)
cd services/api
bash vercel-deploy.sh --dry-run

# Test Railway restart (dry run)
cd services/worker
bash railway-restart.sh --dry-run

# Test promotion (dry run)
bash deploy/promote-vercel.sh --dry-run

# Test health check with rollback (dry run)
bash deploy/check_health_and_rollback.sh --dry-run
```

Expected: All scripts validate config.json and show what they would do.

### 5. Worker Crash and Recovery Test

```bash
# 1. Send events
npm run seed

# 2. Stop worker
# Kill the worker process

# 3. Verify events in events_raw
# Connect to MongoDB and check events_raw has unprocessed events

# 4. Start worker
npm run dev:worker

# 5. Verify processing
# Check logs for WORKER_JOB_DONE
# Verify events moved to events_processed
# Verify metrics updated
```

## Database Schema

### events_raw

```javascript
{
  _id: ObjectId,
  userId: String,
  action: String,
  timestamp: ISOString,
  createdAt: Date,
  processed: Boolean
}
```

### events_processed

```javascript
{
  _id: ObjectId,
  userId: String,
  action: String,
  timestamp: ISOString,
  createdAt: Date,
  processed: Boolean,
  processedAt: Date
}
```

### metrics

```javascript
{
  _id: ObjectId,
  totalEvents: Number,
  eventsByAction: {
    "page_view": Number,
    "click": Number,
    // ...
  },
  eventsByUser: {
    "user_001": Number,
    "user_002": Number,
    // ...
  },
  createdAt: Date,
  updatedAt: Date
}
```

### cron_status

```javascript
{
  _id: ObjectId,
  service: "cron",
  timestamp: Date,
  status: "healthy",
  version: "1.0.0"
}
```

## Troubleshooting

### Config not found error

```
ERROR: config.json not found
```

**Solution**: Copy `config.sample.json` to `config.json` and fill in values.

### MongoDB connection failed

```
DB_CONNECTION_FAILED | error: "connection timed out"
```

**Solutions**:
- Verify MONGODB_URI in config.json
- Check network connectivity
- Whitelist IP in MongoDB Atlas (use 0.0.0.0/0 for development)
- Verify database user credentials

### Worker not processing events

**Check**:
- Worker service is running (`npm run dev:worker`)
- MongoDB connection is successful (check logs)
- Events exist in `events_raw` collection
- No failure modes enabled

### API returns 503

**Check**:
- MongoDB connection is healthy
- API_FAILURE_MODE is not set to "db" or "random_500"
- Database is accessible from Vercel (check IP whitelist)

### Deployment scripts fail

**Check**:
- config.json exists and has valid tokens
- Tokens have correct permissions
- Project/Service IDs are correct
- For Railway: `jq` may be needed for JSON parsing

## Environment Variables (Alternative to config.json)

If you prefer environment variables over config.json:

```bash
# .env (for local development)
MONGODB_URI=mongodb+srv://...
VERCEL_TOKEN=...
VERCEL_PROJECT_ID=...
# ... etc
```

Services will fallback to environment variables if config.json is not found.

For Railway/Vercel, set these in the platform dashboard.

## Production Checklist

- [ ] Copy config.sample.json to config.json
- [ ] Fill in all production credentials
- [ ] Verify config.json is in .gitignore
- [ ] Setup MongoDB database (Railway or Atlas)
- [ ] Deploy API to Vercel
- [ ] Deploy Worker to Railway
- [ ] Deploy Cron to Railway
- [ ] Configure Railway cron schedule
- [ ] Test health endpoint
- [ ] Send test events
- [ ] Verify worker processing
- [ ] Check metrics endpoint
- [ ] Setup monitoring/alerts
- [ ] Review and secure MongoDB access rules
- [ ] Backup config.json securely (password manager, secrets manager)

## License

MIT

## Support

For issues or questions, please review the test plan above and check the troubleshooting section.
