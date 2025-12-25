const { connectToDatabase, closeConnection } = require('./lib/mongo');
const logger = require('./lib/logger');

const POLL_INTERVAL = 10000; // 10 seconds
const BATCH_SIZE = 50;

let isProcessing = false;
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;

function getConfig() {
  try {
    return require('../../config.json');
  } catch {
    return {
      WORKER_FAILURE_MODE: rocess.env.WORKER_FAILURE_MODE || 'none'
    };
  }
}

function simulateFailure(failureMode) {
  if (failureMode === 'crash') {
    logger.error('worker', 'FAILURE_INJECTION: Simulating crash');
    process.exit(1);
  }
  if (failureMode === 'slow') {
    logger.warn('worker', 'FAILURE_INJECTION: Simulating slow processing (5s delay)');
    return new Promise(resolve => setTimeout(resolve, 5000));
  }
  if (failureMode === 'bad_schema' && Math.random() < 0.5) {
    logger.warn('worker', 'FAILURE_INJECTION: Simulating bad schema parse');
    throw new Error('Simulated schema parsing error');
  }
}

async function processEvents() {
  if (isProcessing) {
    logger.debug('worker', 'WORKER_SKIP: Still processing previous batch');
    return;
  }

  isProcessing = true;
  const jobId = Math.random().toString(36).substring(7);

  try {
    const config = getConfig();
    logger.info('worker', 'WORKER_JOB_START', { jobId, batchSize: BATCH_SIZE });

    // Simulate failure modes
    if (config.WORKER_FAILURE_MODE) {
      await simulateFailure(config.WORKER_FAILURE_MODE);
    }

    const { db } = await connectToDatabase();

    // Fetch unprocessed events
    const events = await db.collection('events_raw')
      .find({ processed: false })
      .limit(BATCH_SIZE)
      .toArray();

    if (events.length === 0) {
      logger.debug('worker', 'WORKER_NO_EVENTS', { jobId });
      isProcessing = false;
      consecutiveErrors = 0;
      return;
    }

    logger.info('worker', 'WORKER_PROCESSING', { jobId, count: events.length });

    // Aggregate metrics
    const metrics = {
      totalEvents: events.length,
      eventsByAction: {},
      eventsByUser: {}
    };

    const processedIds = [];

    for (const event of events) {
      try {
        // Validate event structure
        if (!event.userId || !event.action) {
          logger.warn('worker', 'WORKER_PARSE_ERROR', {
            eventId: event._id,
            error: 'Missing userId or action',
            jobId
          });
          continue;
        }

        // Aggregate by action
        metrics.eventsByAction[event.action] = (metrics.eventsByAction[event.action] || 0) + 1;

        // Aggregate by user
        metrics.eventsByUser[event.userId] = (metrics.eventsByUser[event.userId] || 0) + 1;

        processedIds.push(event._id);

      } catch (error) {
        logger.error('worker', 'WORKER_PARSE_ERROR', {
          eventId: event._id,
          error: error.message,
          stack: error.stack,
          jobId
        });
      }
    }

    // Update or create metrics document
    const existingMetrics = await db.collection('metrics').findOne({});

    if (existingMetrics) {
      // Merge with existing metrics
      const updatedMetrics = {
        totalEvents: (existingMetrics.totalEvents || 0) + metrics.totalEvents,
        eventsByAction: { ...(existingMetrics.eventsByAction || {}) },
        eventsByUser: { ...(existingMetrics.eventsByUser || {}) },
        updatedAt: new Date()
      };

      // Merge action counts
      for (const [action, count] of Object.entries(metrics.eventsByAction)) {
        updatedMetrics.eventsByAction[action] = (updatedMetrics.eventsByAction[action] || 0) + count;
      }

      // Merge user counts
      for (const [user, count] of Object.entries(metrics.eventsByUser)) {
        updatedMetrics.eventsByUser[user] = (updatedMetrics.eventsByUser[user] || 0) + count;
      }

      await db.collection('metrics').updateOne(
        { _id: existingMetrics._id },
        { $set: updatedMetrics }
      );
    } else {
      // Create new metrics document
      await db.collection('metrics').insertOne({
        ...metrics,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // Move processed events to events_processed collection
    if (processedIds.length > 0) {
      const processedEvents = await db.collection('events_raw')
        .find({ _id: { $in: processedIds } })
        .toArray();

      if (processedEvents.length > 0) {
        await db.collection('events_processed').insertMany(
          processedEvents.map(e => ({ ...e, processedAt: new Date() }))
        );

        await db.collection('events_raw').deleteMany({
          _id: { $in: processedIds }
        });
      }
    }

    logger.info('worker', 'WORKER_JOB_DONE', {
      jobId,
      count: processedIds.length,
      errors: events.length - processedIds.length,
      metrics: {
        totalEvents: metrics.totalEvents,
        actionTypes: Object.keys(metrics.eventsByAction).length,
        uniqueUsers: Object.keys(metrics.eventsByUser).length
      }
    });

    consecutiveErrors = 0;

  } catch (error) {
    consecutiveErrors++;
    logger.error('worker', 'WORKER_JOB_ERROR', {
      jobId,
      error: error.message,
      stack: error.stack,
      consecutiveErrors
    });

    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      logger.error('worker', 'WORKER_MAX_ERRORS_REACHED', {
        consecutiveErrors,
        action: 'exiting'
      });
      await closeConnection();
      process.exit(1);
    }

  } finally {
    isProcessing = false;
  }
}

async function start() {
  logger.info('worker', 'WORKER_START', {
    pollInterval: POLL_INTERVAL,
    batchSize: BATCH_SIZE,
    version: '1.0.0'
  });

  // Initial connection
  try {
    await connectToDatabase();
  } catch (error) {
    logger.error('worker', 'WORKER_STARTUP_FAILED', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }

  // Start polling
  setInterval(processEvents, POLL_INTERVAL);

  // Initial run
  processEvents();

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('worker', 'WORKER_SHUTDOWN', { signal: 'SIGTERM' });
    await closeConnection();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('worker', 'WORKER_SHUTDOWN', { signal: 'SIGINT' });
    await closeConnection();
    process.exit(0);
  });
}

// Start the worker
start().catch(error => {
  logger.error('worker', 'WORKER_FATAL_ERROR', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});
