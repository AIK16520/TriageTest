const { connectToDatabase, closeConnection } = require('./lib/mongo');
const logger = require('./lib/logger');

const CRON_INTERVAL = 60000; // 1 minute
const RETENTION_DAYS = 30;

function getConfig() {
  try {
    return require('../../config.json');
  } catch {
    return {
      CRON_FAILURE_MODE: process.env.CRON_FAILURE_MODE || 'none'
    };
  }
}

async function simulateFailure(failureMode) {
  if (failureMode === 'timeout') {
    logger.warn('cron', 'FAILURE_INJECTION: Simulating timeout (30s delay)');
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
  if (failureMode === 'db_fail') {
    logger.error('cron', 'FAILURE_INJECTION: Simulating DB failure');
    throw new Error('Simulated database connection failure');
  }
}

async function runCleanup() {
  const jobId = Math.random().toString(36).substring(7);

  try {
    const config = getConfig();
    logger.info('cron', 'CRON_CLEANUP_START', { jobId, retentionDays: RETENTION_DAYS });

    // Simulate failure modes
    if (config.CRON_FAILURE_MODE) {
      await simulateFailure(config.CRON_FAILURE_MODE);
    }

    const { db } = await connectToDatabase();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    // Clean up old processed events
    const processedResult = await db.collection('events_processed').deleteMany({
      processedAt: { $lt: cutoffDate }
    });

    logger.info('cron', 'CRON_CLEANUP_DONE', {
      jobId,
      deletedProcessedEvents: processedResult.deletedCount,
      cutoffDate: cutoffDate.toISOString()
    });

  } catch (error) {
    logger.error('cron', 'CRON_DB_ERROR', {
      jobId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

async function updateHeartbeat() {
  const jobId = Math.random().toString(36).substring(7);

  try {
    const { db } = await connectToDatabase();

    const heartbeat = {
      service: 'cron',
      timestamp: new Date(),
      status: 'healthy',
      version: '1.0.0'
    };

    await db.collection('cron_status').updateOne(
      { service: 'cron' },
      { $set: heartbeat },
      { upsert: true }
    );

    logger.info('cron', 'CRON_HEARTBEAT', {
      jobId,
      timestamp: heartbeat.timestamp.toISOString()
    });

  } catch (error) {
    logger.error('cron', 'CRON_HEARTBEAT_ERROR', {
      jobId,
      error: error.message,
      stack: error.stack
    });
  }
}

async function runCronJob() {
  logger.info('cron', 'CRON_JOB_START', { timestamp: new Date().toISOString() });

  try {
    // Run cleanup
    await runCleanup();

    // Update heartbeat
    await updateHeartbeat();

    logger.info('cron', 'CRON_JOB_COMPLETE', { timestamp: new Date().toISOString() });

  } catch (error) {
    logger.error('cron', 'CRON_JOB_ERROR', {
      error: error.message,
      stack: error.stack
    });
  }
}

async function start() {
  logger.info('cron', 'CRON_START', {
    interval: CRON_INTERVAL,
    retentionDays: RETENTION_DAYS,
    version: '1.0.0'
  });

  // Initial connection
  try {
    await connectToDatabase();
  } catch (error) {
    logger.error('cron', 'CRON_STARTUP_FAILED', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }

  // Run immediately on start
  runCronJob();

  // Schedule recurring execution
  setInterval(runCronJob, CRON_INTERVAL);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('cron', 'CRON_SHUTDOWN', { signal: 'SIGTERM' });
    await closeConnection();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('cron', 'CRON_SHUTDOWN', { signal: 'SIGINT' });
    await closeConnection();
    process.exit(0);
  });
}

// Start the cron job
start().catch(error => {
  logger.error('cron', 'CRON_FATAL_ERROR', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});
