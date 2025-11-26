const { connectToDatabase } = require('../../lib/mongo');
const logger = require('../../lib/logger');

export default async function handler(req, res) {
  const requestId = Math.random().toString(36).substring(7);
  logger.info('api', 'HEALTH_CHECK_START', { requestId });

  try {
    const { db } = await connectToDatabase();

    // Perform a simple ping to verify DB connectivity
    await db.admin().ping();

    logger.info('api', 'HEALTH_CHECK_OK', {
      status: 'healthy',
      database: 'connected',
      requestId
    });

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'api',
      database: 'connected',
      version: '1.0.0'
    });

  } catch (error) {
    logger.error('api', 'HEALTH_CHECK_FAILED', {
      error: error.message,
      stack: error.stack,
      requestId
    });

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'api',
      database: 'disconnected',
      error: error.message
    });
  }
}
