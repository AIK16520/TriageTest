const logger = require('../../lib/logger');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { count = 50 } = req.body;
    const errorCount = Math.min(Math.max(count, 10), 500); // Between 10 and 500 errors

    logger.warn('api', 'BULK_ERROR_TEST_TRIGGERED', { 
      requestedCount: count,
      actualCount: errorCount,
      timestamp: new Date().toISOString()
    });

    // Generate various types of errors to simulate real incidents
    const errorTypes = [
      { type: 'NETWORK_ERROR', message: 'Connection timeout to external service' },
      { type: 'DATABASE_ERROR', message: 'Query execution failed' },
      { type: 'VALIDATION_ERROR', message: 'Invalid input data received' },
      { type: 'AUTH_ERROR', message: 'Authentication token expired' },
      { type: 'RATE_LIMIT_ERROR', message: 'API rate limit exceeded' },
      { type: 'MEMORY_ERROR', message: 'Heap out of memory' },
      { type: 'PARSE_ERROR', message: 'Failed to parse JSON response' },
      { type: 'TIMEOUT_ERROR', message: 'Request timeout after 30s' },
      { type: 'CRITICAL_ERROR', message: 'Critical system failure detected' },
      { type: 'UNKNOWN_ERROR', message: 'Unknown error occurred' }
    ];

    // Generate errors with varying severity
    for (let i = 0; i < errorCount; i++) {
      const errorType = errorTypes[i % errorTypes.length];
      const errorContext = {
        errorId: `err_${Date.now()}_${i}`,
        errorType: errorType.type,
        message: errorType.message,
        timestamp: new Date().toISOString(),
        iteration: i + 1,
        totalErrors: errorCount,
        userId: `user_${Math.floor(Math.random() * 100)}`,
        requestId: `req_${Math.random().toString(36).substring(7)}`,
        stackTrace: `Error at line ${Math.floor(Math.random() * 1000)}\n  at module.exports (/var/task/index.js)\n  at Runtime.handler (/var/runtime/index.js)`
      };

      // Mix error levels for realism
      if (i % 10 === 0) {
        logger.error('api', 'CRITICAL_ERROR', { ...errorContext, severity: 'CRITICAL' });
      } else if (i % 5 === 0) {
        logger.error('api', 'HIGH_SEVERITY_ERROR', { ...errorContext, severity: 'HIGH' });
      } else {
        logger.error('api', errorType.type, errorContext);
      }

      // Add some warnings and info messages for context
      if (i % 15 === 0) {
        logger.warn('api', 'ERROR_RATE_INCREASING', { 
          currentRate: (i / errorCount * 100).toFixed(2) + '%',
          errorsSoFar: i + 1 
        });
      }
    }

    // Final summary log
    logger.error('api', 'BULK_ERROR_TEST_COMPLETED', {
      totalErrorsGenerated: errorCount,
      duration: '~1s',
      timestamp: new Date().toISOString(),
      message: 'Test error generation completed successfully'
    });

    res.status(200).json({
      success: true,
      message: `Successfully generated ${errorCount} error logs`,
      errorCount: errorCount,
      timestamp: new Date().toISOString(),
      instructions: 'Check your Vercel logs to see the error flood. These errors should trigger your monitoring system.'
    });

  } catch (error) {
    logger.error('api', 'ERROR_TRIGGER_FAILED', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ 
      error: 'Failed to trigger errors', 
      message: error.message 
    });
  }
}

