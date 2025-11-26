/**
 * Generate Seed Data Script
 * Pushes synthetic events to the API for testing and log generation
 */

const http = require('http');
const https = require('https');

function getConfig() {
  try {
    return require('../config.json');
  } catch {
    return {
      VERCEL_PROD_ALIAS: process.env.VERCEL_PROD_ALIAS || 'localhost:3000'
    };
  }
}

function generateRandomEvent() {
  const userIds = ['user_001', 'user_002', 'user_003', 'user_004', 'user_005'];
  const actions = ['page_view', 'click', 'purchase', 'signup', 'logout', 'search', 'download'];

  return {
    userId: userIds[Math.floor(Math.random() * userIds.length)],
    action: actions[Math.floor(Math.random() * actions.length)],
    timestamp: new Date().toISOString()
  };
}

async function sendEvent(apiUrl, event) {
  return new Promise((resolve, reject) => {
    const url = new URL(apiUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const postData = JSON.stringify(event);

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: data });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function generateSeedData(count = 20, apiUrl = null) {
  const config = getConfig();

  if (!apiUrl) {
    // Determine API URL
    const alias = config.VERCEL_PROD_ALIAS;
    if (alias && !alias.startsWith('<')) {
      apiUrl = `https://${alias}/api/events`;
    } else {
      apiUrl = 'http://localhost:3000/api/events';
    }
  }

  console.log(`Generating ${count} seed events...`);
  console.log(`API URL: ${apiUrl}`);
  console.log('');

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < count; i++) {
    const event = generateRandomEvent();

    try {
      const response = await sendEvent(apiUrl, event);
      successCount++;
      console.log(`✓ [${i + 1}/${count}] Event sent: ${event.action} by ${event.userId}`);

      // Add a small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      errorCount++;
      console.error(`✗ [${i + 1}/${count}] Failed to send event: ${error.message}`);
    }
  }

  console.log('');
  console.log('=== Seed Data Generation Complete ===');
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log('');
  console.log('Wait a few seconds and check metrics at:');
  console.log(`  ${apiUrl.replace('/events', '/metrics')}`);
}

// Parse command line arguments
const args = process.argv.slice(2);
let count = 20;
let apiUrl = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--count' && args[i + 1]) {
    count = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--url' && args[i + 1]) {
    apiUrl = args[i + 1];
    i++;
  } else if (args[i] === '--help') {
    console.log('Usage: node generate-seed-data.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --count <number>  Number of events to generate (default: 20)');
    console.log('  --url <url>       API endpoint URL (default: from config.json or localhost:3000)');
    console.log('  --help            Show this help message');
    process.exit(0);
  }
}

// Run the seed data generation
generateSeedData(count, apiUrl).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
