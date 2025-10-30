# Codebase Indexer

[中文版 README](./README_CN.md) | English

A powerful TypeScript library for indexing and searching code repositories using vector embeddings. Built with Qdrant vector database and OpenAI embeddings.

> **Note**: This project is extracted and refactored from the codebase-indexer component of [Roo-Code](https://github.com/RooCodeInc/Roo-Code) for learning purposes.

## Features

- 🔍 **Semantic Code Search**: Find code using natural language queries
- 📁 **Directory Indexing**: Recursively index entire codebases
- 👀 **File Watching**: Real-time updates when files change
- 🌐 **REST API**: HTTP server for remote access
- 🎯 **Multi-language Support**: JavaScript, TypeScript, Python, and more
- ⚡ **High Performance**: Concurrent processing and batched operations
- 🔧 **Configurable**: Flexible configuration options

## Installation

```bash
npm install codebase-indexer
```

## Quick Start

### 1. Prerequisites

- **Qdrant Vector Database**: Install and run Qdrant
  ```bash
  docker run -p 6333:6333 qdrant/qdrant
  ```

- **OpenAI API Key**: Get your API key from [OpenAI](https://platform.openai.com/)
  ```bash
  export OPENAI_API_KEY="your-api-key-here"
  ```

### 2. Basic Usage

```typescript
import { CodebaseIndexer } from 'codebase-indexer';

const indexer = new CodebaseIndexer({
  vectorStore: {
    type: 'qdrant',
    url: 'http://localhost:6333',
    collectionName: 'my_codebase'
  },
  embedder: {
    type: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'text-embedding-ada-002'
  }
});

// Index a directory
await indexer.indexDirectory('./src');

// Search for code
const results = await indexer.search('authentication function');
console.log(results);
```

### 3. CLI Usage

```bash
npm install
npm run build

# Index a directory
npx codebase-indexer index ./src --collection my_codebase

# Search the index
npx codebase-indexer search "tree-sitter" --max-results 5 --collection my_codebase

# Watch for file changes
npx codebase-indexer watch ./src --collection my_codebase

# Clear the index
npx codebase-indexer clear --collection my_codebase
```

### 4. API Server

Start the REST API server:

```bash
npx codebase-indexer-server --port 3000 --collection my_codebase
```

Use the API:

```bash
# Index a directory
curl -X POST http://localhost:3000/index \
  -H "Content-Type: application/json" \
  -d '{"directoryPath": "./src"}'

# Search
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "authentication function", "options": {"maxResults": 5}}'
```

## Configuration

Create a `config.js` file:

```javascript
module.exports = {
  vectorStore: {
    type: 'qdrant',
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    collectionName: process.env.COLLECTION_NAME || 'codebase'
  },
  embedder: {
    type: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'text-embedding-ada-002',
    batchSize: 100,
    baseURL: process.env.OPENAI_BASE_URL // Optional: Custom OpenAI API base URL
  },
  parser: {
    excludePatterns: [
      'node_modules/**',
      '.git/**',
      'dist/**',
      '*.log'
    ],
    maxBlockChars: 1000,
    minBlockChars: 50
  },
  search: {
    maxResults: 20,
    minScore: 0.7
  },
  watcher: {
    excludePatterns: [
      'node_modules/**',
      '.git/**'
    ],
    debounceMs: 1000
  }
};
```

## How It Works

Understanding the internal workings of each command helps you use the codebase indexer more effectively.

### Index Command (`index`)

The indexing process transforms your codebase into searchable vector embeddings:

1. **Directory Scanning**: Recursively scans the target directory, filtering files based on:
   - File extensions (supports 20+ programming languages)
   - Exclude patterns (node_modules, .git, etc.)
   - File size limits

2. **Code Parsing**: For each file:
   - Uses Tree-sitter parsers to create Abstract Syntax Trees (AST)
   - Extracts meaningful code blocks (functions, classes, methods)
   - Filters blocks by size (min/max character limits)
   - Preserves context and metadata

3. **Embedding Generation**: 
   - Sends code blocks to OpenAI's embedding API in batches
   - Generates 1536-dimensional vectors for each code block
   - Handles rate limiting and retries automatically

4. **Vector Storage**:
   - Stores embeddings in Qdrant vector database
   - Creates unique IDs for each code block
   - Maintains metadata (file path, line numbers, block type)

**Flow Diagram**:
```
Directory → File Filter → AST Parse → Code Blocks → Embeddings → Qdrant
```

### Search Command (`search`)

The search process finds semantically similar code using vector similarity:

1. **Query Processing**:
   - Converts your natural language query into embeddings
   - Uses the same OpenAI model as indexing for consistency

2. **Vector Search**:
   - Performs cosine similarity search in Qdrant
   - Applies score threshold filtering
   - Limits results based on maxResults parameter

3. **Result Enhancement**:
   - Retrieves original code blocks from metadata
   - Generates code snippets with context
   - Ranks results by similarity score

4. **Response Formatting**:
   - Returns structured results with file paths, scores, and code
   - Includes line numbers and block types

**Flow Diagram**:
```
Query → Embedding → Vector Search → Score Filter → Code Retrieval → Results
```

### Watch Command (`watch`)

The file watching system provides real-time index updates:

1. **File System Monitoring**:
   - Uses Node.js `fs.watch` for efficient file system events
   - Monitors file creation, modification, and deletion
   - Applies same exclude patterns as indexing

2. **Event Debouncing**:
   - Debounces rapid file changes (default 1000ms)
   - Prevents excessive reindexing during bulk operations
   - Batches multiple changes for efficiency

3. **Incremental Updates**:
   - **File Modified**: Re-parses and re-indexes the file
   - **File Created**: Adds new file to index
   - **File Deleted**: Removes all related vectors from Qdrant

4. **Error Handling**:
   - Gracefully handles file access errors
   - Continues monitoring even if individual files fail
   - Logs errors for debugging

**Flow Diagram**:
```
File Change → Debounce → Event Type → Parse/Index/Delete → Update Qdrant
```

### Clear Command (`clear`)

The clearing process removes all indexed data:

1. **Collection Identification**:
   - Connects to Qdrant using configured URL
   - Identifies the target collection by name

2. **Data Removal**:
   - Deletes the entire Qdrant collection
   - Removes all vectors and associated metadata
   - Frees up storage space

3. **Cleanup**:
   - Resets internal state if indexer is running
   - Stops any active file watching
   - Prepares for fresh indexing

**Flow Diagram**:
```
Clear Command → Connect Qdrant → Delete Collection → Reset State
```

### Performance Considerations

- **Batch Processing**: Embeddings are generated in configurable batches (default 100)
- **Concurrent Operations**: Multiple files can be processed simultaneously
- **Memory Management**: Large files are processed in chunks to prevent memory issues
- **Rate Limiting**: Automatic handling of OpenAI API rate limits
- **Caching**: Embeddings are cached to avoid reprocessing unchanged code

## API Reference

### CodebaseIndexer

#### Constructor

```typescript
new CodebaseIndexer(config?: Partial<CodeIndexConfig>)
```

#### Methods

- `indexDirectory(directoryPath: string, onProgress?: ProgressCallback): Promise<void>`
- `search(query: string, options?: SearchOptions): Promise<VectorStoreSearchResult[]>`
- `startWatching(directoryPath: string): void`
- `stopWatching(): void`
- `clearIndex(): Promise<void>`
- `getState(): IndexerState`

### Search Options

```typescript
interface SearchOptions {
  maxResults?: number;
  minScore?: number;
  includeSnippet?: boolean;
}
```

### Search Results

```typescript
interface VectorStoreSearchResult {
  id: string;
  score: number;
  filePath: string;
  codeBlock: CodeBlock;
  snippet?: string;
}
```

## REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/status` | Get indexer status |
| POST | `/index` | Index a directory |
| POST | `/search` | Search the index |
| POST | `/watch` | Start watching directory |
| DELETE | `/watch` | Stop watching |
| DELETE | `/clear` | Clear the index |

## Supported Languages

- JavaScript (.js, .jsx)
- TypeScript (.ts, .tsx)
- Python (.py)
- Java (.java)
- C/C++ (.c, .cpp, .h, .hpp)
- C# (.cs)
- Go (.go)
- Rust (.rs)
- PHP (.php)
- Ruby (.rb)
- And more...

## Examples

See the `examples/` directory for complete usage examples:

- `basic-usage.js` - Basic library usage
- `api-usage.js` - REST API usage

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Start development server
npm run start:server

# Run CLI
npm run start:cli -- --help
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Supported Languages

- JavaScript/TypeScript
- Python
- Java
- C/C++
- Go
- Rust
- PHP
- Ruby
- And more...

## Requirements

- Node.js 18+
- Qdrant vector database (local or remote)
- OpenAI API key (for embeddings)

## License

MIT