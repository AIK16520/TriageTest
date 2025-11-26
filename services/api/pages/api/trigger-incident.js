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
      'db_connection_loss',
      'memory_leak',
      'dead_letter_queue'
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
        // Generate error logs
        for (let i = 0; i < 20; i++) {
          await db.collection('system_logs').insertOne({
            timestamp: new Date(),
            level: 'ERROR',
            service: 'worker',
            message: 'WORKER_PARSE_ERROR',
            metadata: { error: 'Simulated parse error' }
          });
        }
        logger.error('api', 'HIGH_ERROR_RATE_SIMULATED', { errorCount: 20 });
        break;

      case 'db_connection_loss':
        // Log DB connection errors
        await db.collection('system_logs').insertOne({
          timestamp: new Date(),
          level: 'ERROR',
          service: 'worker',
          message: 'DB_CONNECTION_FAILED',
          metadata: { error: 'Connection timeout' }
        });
        logger.error('api', 'DB_CONNECTION_LOSS_SIMULATED');
        break;

      case 'memory_leak':
        // Create excessive metrics
        await db.collection('metrics').updateOne(
          {},
          {
            $set: {
              totalEvents: 999999,
              lastUpdated: new Date(Date.now() - 600000) // 10 minutes ago
            }
          },
          { upsert: true }
        );
        logger.error('api', 'MEMORY_LEAK_SIMULATED');
        break;

      case 'dead_letter_queue':
        // Create old stuck events
        const oldEvents = Array(50).fill(null).map((_, i) => ({
          userId: `user_${i % 3}`,
          action: 'stuck_action',
          timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          createdAt: new Date(Date.now() - 3600000),
          processed: false,
          retryCount: 5
        }));
        await db.collection('events_raw').insertMany(oldEvents);
        logger.error('api', 'DEAD_LETTER_QUEUE_SIMULATED', { eventCount: 50 });
        break;
    }

    res.status(200).json({
      success: true,
      message: `Incident "${incident}" triggered`,
      incident,
      timestamp: new Date().toISOString(),
      instructions: 'Check /api/health and /api/logs to diagnose'
    });

  } catch (error) {
    logger.error('api', 'INCIDENT_TRIGGER_FAILED', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Failed to trigger incident', message: error.message });
  }
}
