// Parser constants
export const MAX_BLOCK_CHARS = 1000;
export const MIN_BLOCK_CHARS = 50;
export const MIN_CHUNK_REMAINDER_CHARS = 200;
export const MAX_CHARS_TOLERANCE_FACTOR = 1.15;

// Search constants
export const DEFAULT_SEARCH_MIN_SCORE = 0.7;
export const DEFAULT_MAX_SEARCH_RESULTS = 20;

// File watcher constants
export const QDRANT_CODE_BLOCK_NAMESPACE = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
export const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1MB

// Directory scanner constants
export const MAX_LIST_FILES_LIMIT_CODE_INDEX = 50_000;
export const BATCH_SEGMENT_THRESHOLD = 60;
export const MAX_BATCH_RETRIES = 3;
export const INITIAL_RETRY_DELAY_MS = 500;
export const PARSING_CONCURRENCY = 10;
export const MAX_PENDING_BATCHES = 20;

// OpenAI embedder constants
export const MAX_BATCH_TOKENS = 100000;
export const MAX_ITEM_TOKENS = 8191;
export const BATCH_PROCESSING_CONCURRENCY = 10;

// Gemini embedder constants
export const GEMINI_MAX_ITEM_TOKENS = 2048;

// Default configurations
export const DEFAULT_VECTOR_STORE_CONFIG = {
  type: 'qdrant' as const,
  url: 'http://localhost:6333',
  collectionName: 'codebase_index'
};

export const DEFAULT_EMBEDDER_CONFIG = {
  type: 'openai' as const,
  apiKey: process.env.OPENAI_API_KEY || '',
  model: 'text-embedding-ada-002',
  batchSize: 100
};

export const DEFAULT_PARSER_CONFIG = {
  maxBlockChars: MAX_BLOCK_CHARS,
  minBlockChars: MIN_BLOCK_CHARS,
  maxFileSize: MAX_FILE_SIZE_BYTES,
  excludePatterns: [
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
    '*.min.js',
    '*.bundle.js',
    '*.map'
  ]
};

export const DEFAULT_SEARCH_CONFIG = {
  minScore: DEFAULT_SEARCH_MIN_SCORE,
  maxResults: DEFAULT_MAX_SEARCH_RESULTS,
  includeSnippet: true
};

export const DEFAULT_WATCHER_CONFIG = {
  enabled: true,
  debounceMs: 1000,
  excludePatterns: [
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**'
  ]
};

// Supported file extensions for different languages
export const SUPPORTED_EXTENSIONS = {
  javascript: ['.js', '.jsx', '.mjs'],
  typescript: ['.ts', '.tsx'],
  python: ['.py', '.pyx', '.pyi'],
  java: ['.java'],
  cpp: ['.cpp', '.cc', '.cxx', '.c++', '.c', '.h', '.hpp'],
  go: ['.go'],
  rust: ['.rs'],
  php: ['.php'],
  ruby: ['.rb'],
  swift: ['.swift'],
  kotlin: ['.kt', '.kts'],
  scala: ['.scala'],
  csharp: ['.cs'],
  html: ['.html', '.htm'],
  css: ['.css', '.scss', '.sass', '.less'],
  json: ['.json'],
  yaml: ['.yaml', '.yml'],
  xml: ['.xml'],
  markdown: ['.md', '.markdown'],
  shell: ['.sh', '.bash', '.zsh'],
  sql: ['.sql'],
  dockerfile: ['Dockerfile', '.dockerfile']
};

// Language detection mapping
export const EXTENSION_TO_LANGUAGE: Record<string, string> = {};
Object.entries(SUPPORTED_EXTENSIONS).forEach(([language, extensions]) => {
  extensions.forEach(ext => {
    EXTENSION_TO_LANGUAGE[ext] = language;
  });
});

// Special file names
EXTENSION_TO_LANGUAGE['Dockerfile'] = 'dockerfile';
EXTENSION_TO_LANGUAGE['.dockerfile'] = 'dockerfile';