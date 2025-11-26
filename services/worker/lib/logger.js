/**
 * Simple logger that emits both structured JSON and unstructured logs
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

function getLogLevel() {
  // Try to read from config.json first, then environment
  try {
    const config = require('../../../config.json');
    return config.LOG_LEVEL || 'info';
  } catch {
    return process.env.LOG_LEVEL || 'info';
  }
}

function shouldLog(level) {
  const currentLevel = getLogLevel();
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function log(level, service, message, metadata = {}) {
  if (!shouldLog(level)) return;

  const timestamp = new Date().toISOString();

  // Structured JSON log
  const structuredLog = {
    timestamp,
    level: level.toUpperCase(),
    service,
    message,
    ...metadata
  };
  console.log(JSON.stringify(structuredLog));

  // Unstructured noisy log
  const metaStr = Object.keys(metadata).length > 0
    ? ` | ${Object.entries(metadata).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')}`
    : '';
  console.log(`[${timestamp}] ${level.toUpperCase()} [${service}] ${message}${metaStr}`);
}

module.exports = {
  debug: (service, message, metadata) => log('debug', service, message, metadata),
  info: (service, message, metadata) => log('info', service, message, metadata),
  warn: (service, message, metadata) => log('warn', service, message, metadata),
  error: (service, message, metadata) => log('error', service, message, metadata),
  log
};
