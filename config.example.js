// Example configuration file for codebase-indexer
// Copy this file to config.js and modify as needed

module.exports = {
  // Vector store configuration
  vectorStore: {
    type: 'qdrant',
    url: 'http://localhost:6333',
    collectionName: 'my_codebase',
    apiKey: process.env.QDRANT_API_KEY // Optional for cloud Qdrant
  },

  // Embedder configuration
  embedder: {
    type: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'text-embedding-ada-002',
    batchSize: 100,
    baseURL: process.env.OPENAI_BASE_URL // Optional: Custom OpenAI API base URL (e.g., for proxy or alternative endpoints)
  },

  // Parser configuration
  parser: {
    maxBlockChars: 1000,
    minBlockChars: 50,
    maxFileSize: 1024 * 1024, // 1MB
    excludePatterns: [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      '*.log',
      '*.tmp',
      '.env*'
    ],
    includePatterns: [
      '**/*.js',
      '**/*.ts',
      '**/*.jsx',
      '**/*.tsx',
      '**/*.py',
      '**/*.java',
      '**/*.cpp',
      '**/*.c',
      '**/*.h',
      '**/*.cs',
      '**/*.go',
      '**/*.rs',
      '**/*.php',
      '**/*.rb',
      '**/*.swift',
      '**/*.kt',
      '**/*.scala',
      '**/*.md'
    ]
  },

  // Search configuration
  search: {
    minScore: 0.7,
    maxResults: 20,
    includeSnippet: true
  },

  // File watcher configuration
  watcher: {
    enabled: true,
    debounceMs: 1000,
    excludePatterns: [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      '*.log',
      '*.tmp'
    ]
  }
};