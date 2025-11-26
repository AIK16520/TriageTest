const { connectToDatabase } = require('../../lib/mongo');
const logger = require('../../lib/logger');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { incident } = req.body;

    const validIncidents = [
      'stuck_worker',
      'high_error_rate',
      'bad_deployment',
      'db_connection_loss',
      'persistent_errors'
    ];

    if (!incident || !validIncidents.includes(incident)) {
      return res.status(400).json({
        error: 'Invalid incident type',
        validIncidents
      });
    }

    logger.warn('api', 'INCIDENT_TRIGGERED', { incident });

    const { db } = await connectToDatabase();

    // Simulate different incidents
    switch (incident) {
      case 'stuck_worker':
        // FIXABLE: Restart worker will fix this
        // Create many unprocessed events
        const events = Array(100).fill(null).map((_, i) => ({
          userId: `user_${i % 5}`,
          action: 'test_action',
          timestamp: new Date().toISOString(),
          createdAt: new Date(Date.now() - 300000), // 5 minutes ago
          processed: false
        }));
        await db.collection('events_raw').insertMany(events);
        logger.error('api', 'WORKER_STUCK_SIMULATED', { eventCount: 100 });
        break;

      case 'high_error_rate':
        // FIXABLE: Restart worker will clear error state
        // Generate error logs
        for (let i = 0; i < 20; i++) {
          logger.error('worker', 'WORKER_PARSE_ERROR', {
            error: 'Simulated parse error',
            eventId: `fake_${i}`
          });
        }
        logger.error('api', 'HIGH_ERROR_RATE_SIMULATED', { errorCount: 20 });
        break;

      case 'bad_deployment':
        // FIXABLE: Rollback deployment will fix this
        // Trigger API errors (this creates errors in Vercel logs)
        logger.error('api', 'BAD_DEPLOYMENT_SIMULATED');

        // Create multiple API errors
        for (let i = 0; i < 15; i++) {
          logger.error('api', 'API_FAILURE_INJECTED', {
            statusCode: 500,
            error: 'Simulated deployment error'
          });
        }
        break;

      case 'db_connection_loss':
        // NOT FIXABLE: Restart won't help if DB is actually down
        // This requires manual intervention or DB restart
        logger.error('worker', 'DB_CONNECTION_FAILED', {
          error: 'Connection timeout',
          retries: 3
        });
        logger.error('api', 'DB_CONNECTION_LOSS_SIMULATED');

        // Log multiple connection failures
        for (let i = 0; i < 5; i++) {
          logger.error('worker', 'DB_CONNECTION_FAILED', {
            error: 'Cannot reach database',
            attempt: i + 1
          });
        }
        break;

      case 'persistent_errors':
        // NOT FIXABLE: Even after restart, errors continue
        // This indicates code-level bug that needs developer fix
        const persistentEvents = Array(30).fill(null).map((_, i) => ({
          userId: `user_${i % 3}`,
          action: 'broken_action',
          timestamp: new Date().toISOString(),
          createdAt: new Date(Date.now() - 600000), // 10 minutes ago
          processed: false,
          retryCount: 5,
          lastError: 'Schema validation failed'
        }));
        await db.collection('events_raw').insertMany(persistentEvents);

        // Generate persistent errors
        for (let i = 0; i < 10; i++) {
          logger.error('worker', 'WORKER_PERSISTENT_ERROR', {
            error: 'Schema validation failed',
            retries: 5,
            eventId: `broken_${i}`
          });
        }
        logger.error('api', 'PERSISTENT_ERRORS_SIMULATED', { errorCount: 10 });
        break;
    }

    res.status(200).json({
      success: true,
      message: `Incident "${incident}" triggered`,
      incident,
      timestamp: new Date().toISOString(),
      instructions: 'Check Vercel/Railway logs to see the errors'
    });

  } catch (error) {
    logger.error('api', 'INCIDENT_TRIGGER_FAILED', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Failed to trigger incident', message: error.message });
  }
}
