const { CodebaseIndexer } = require('../dist/index');

async function main() {
  // Configuration
  const config = {
    vectorStore: {
      type: 'qdrant',
      url: 'http://localhost:6333',
      collectionName: 'my_codebase'
    },
    embedder: {
      type: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: 'text-embedding-ada-002'
    },
    parser: {
      excludePatterns: [
        'node_modules/**',
        '.git/**',
        'dist/**'
      ]
    }
  };

  // Create indexer
  const indexer = new CodebaseIndexer(config);

  try {
    console.log('🚀 Starting indexing...');
    
    // Index the current directory
    await indexer.indexDirectory('./src', (progress) => {
      console.log(`📊 Progress: ${progress.processedFiles}/${progress.totalFiles} - ${progress.stage}`);
    });

    console.log('✅ Indexing completed!');

    // Search for code
    console.log('\n🔍 Searching for "function"...');
    const results = await indexer.search('function', {
      maxResults: 5,
      includeSnippet: true
    });

    console.log(`Found ${results.length} results:`);
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.filePath}`);
      console.log(`   Score: ${result.score.toFixed(3)}`);
      console.log(`   Type: ${result.codeBlock.type}`);
      console.log(`   Lines: ${result.codeBlock.startLine}-${result.codeBlock.endLine}`);
      if (result.snippet) {
        console.log(`   Snippet: ${result.snippet.substring(0, 100)}...`);
      }
    });

    // Start watching for changes
    console.log('\n👀 Starting file watcher...');
    indexer.startWatching('./src');
    
    console.log('Watching for changes... Press Ctrl+C to stop');
    
    // Keep the process running
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping watcher...');
      indexer.stopWatching();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();