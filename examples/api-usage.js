const http = require('http');

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function main() {
  try {
    console.log('🔍 Testing Codebase Indexer API...');

    // Check server health
    console.log('\n1. Checking server health...');
    const health = await makeRequest('GET', '/health');
    console.log('Health:', health);

    // Get current status
    console.log('\n2. Getting current status...');
    const status = await makeRequest('GET', '/status');
    console.log('Status:', status);

    // Index a directory
    console.log('\n3. Indexing directory...');
    const indexResult = await makeRequest('POST', '/index', {
      directoryPath: './src'
    });
    console.log('Index result:', indexResult);

    // Search the index
    console.log('\n4. Searching for "function"...');
    const searchResult = await makeRequest('POST', '/search', {
      query: 'function',
      options: {
        maxResults: 3,
        includeSnippet: true
      }
    });
    console.log('Search results:', JSON.stringify(searchResult, null, 2));

    // Start watching
    console.log('\n5. Starting file watcher...');
    const watchResult = await makeRequest('POST', '/watch', {
      directoryPath: './src'
    });
    console.log('Watch result:', watchResult);

    // Stop watching after a few seconds
    setTimeout(async () => {
      console.log('\n6. Stopping file watcher...');
      const stopWatchResult = await makeRequest('DELETE', '/watch');
      console.log('Stop watch result:', stopWatchResult);

      // Clear the index
      console.log('\n7. Clearing index...');
      const clearResult = await makeRequest('DELETE', '/clear');
      console.log('Clear result:', clearResult);

      console.log('\n✅ API test completed!');
    }, 3000);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Check if server is running before starting tests
console.log('🚀 Starting API tests...');
console.log('Make sure the server is running: npm run start:server');
console.log('Waiting 2 seconds before starting tests...\n');

setTimeout(main, 2000);