const { MongoClient } = require('mongodb');
const logger = require('./logger');

let client = null;
let db = null;

function getConfig() {
  // Try config.json first, then environment variables
  try {
    const config = require('../../../config.json');
    return config;
  } catch (err) {
    logger.warn('cron', 'config.json not found, using environment variables');
    return {
      MONGODB_URI: process.env.MONGODB_URI
    };
  }
}

async function connectToDatabase() {
  if (db && client) {
    return { db, client };
  }

  const config = getConfig();
  const uri = config.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI not found in config.json or environment variables');
  }

  try {
    logger.info('cron', 'Connecting to MongoDB...');
    client = new MongoClient(uri);
    await client.connect();
    db = client.db();
    logger.info('cron', 'Connected to MongoDB successfully');
    return { db, client };
  } catch (error) {
    logger.error('cron', 'DB_CONNECTION_FAILED', { error: error.message, stack: error.stack });
    throw error;
  }
}

async function closeConnection() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    logger.info('cron', 'MongoDB connection closed');
  }
}

module.exports = {
  connectToDatabase,
  closeConnection
};
