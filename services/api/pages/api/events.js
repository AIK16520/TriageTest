const { connectToDatabase } = require('../../lib/mongo');
const logger = require('../../lib/logger');

function getConfig() {
  try {
    return require('../../../../config.json');
  } catch {
    return {
      API_FAILURE_MODE: process.env.API_FAILURE_MODE || 'none'
    };
  }
}

function simulateFailure(failureMode) {
  if (failureMode === 'random_500' && Math.random() < 0.3) {
    logger.warn('api', 'FAILURE_INJECTION: Simulating random 500 error');
    return { shouldFail: true, statusCode: 500, message: 'Simulated random failure' };
  }
  if (failureMode === 'db') {
    logger.warn('api', 'FAILURE_INJECTION: Simulating DB failure');
    return { shouldFail: true, statusCode: 503, message: 'Simulated database failure' };
  }
  return { shouldFail: false };
}

export default async function handler(req, res) {
  const requestId = Math.random().toString(36).substring(7);
  logger.info('api', 'API_REQUEST_START', {
    method: req.method,
    path: '/api/events',
    requestId
  });

  if (req.method !== 'POST') {
    logger.warn('api', 'METHOD_NOT_ALLOWED', { method: req.method, requestId });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const config = getConfig();
    const failure = simulateFailure(config.API_FAILURE_MODE);

    if (failure.shouldFail) {
      logger.error('api', 'API_FAILURE_INJECTED', {
        failureMode: config.API_FAILURE_MODE,
        statusCode: failure.statusCode,
        requestId
      });
      return res.status(failure.statusCode).json({ error: failure.message });
    }

    const { userId, action, timestamp } = req.body;

    // Validation
    if (!userId || !action) {
      logger.warn('api', 'VALIDATION_ERROR', {
        userId: !!userId,
        action: !!action,
        requestId
      });
      return res.status(400).json({ error: 'Missing required fields: userId and action' });
    }

    const { db } = await connectToDatabase();

    const event = {
      userId,
      action,
      timestamp: timestamp || new Date().toISOString(),
      createdAt: new Date(),
      processed: false
    };

    logger.debug('api', 'INSERTING_EVENT', { event, requestId });

    const result = await db.collection('events_raw').insertOne(event);

    logger.info('api', 'EVENT_INSERTED', {
      eventId: result.insertedId,
      userId,
      action,
      requestId
    });

    res.status(201).json({
      success: true,
      eventId: result.insertedId,
      message: 'Event recorded successfully'
    });

  } catch (error) {
    logger.error('api', 'API_ERROR', {
      error: error.message,
      stack: error.stack,
      requestId
    });
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
