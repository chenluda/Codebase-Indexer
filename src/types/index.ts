export interface CodeBlock {
  id: string;
  filePath: string;
  content: string;
  language: string;
  startLine: number;
  endLine: number;
  type: 'function' | 'class' | 'interface' | 'variable' | 'comment' | 'other';
  name?: string;
  metadata?: {
    fileExtension?: string;
    lineCount?: number;
    charCount?: number;
    // AST-specific metadata
    astNode?: {
      type: string;
      startPosition: { row: number; column: number };
      endPosition: { row: number; column: number };
    };
    // Tree-sitter capture information
    captureType?: string;
    // Parsing method used
    parsingMethod?: 'tree-sitter' | 'line-based' | 'markdown';
    // File hash for change detection
    fileHash?: string;
    // Segment hash for content change detection
    segmentHash?: string;
  };
}

export interface VectorStoreSearchResult {
  id: string;
  score: number;
  payload: CodeBlock;
}

export interface SearchResult {
  codeBlock: CodeBlock;
  score: number;
  filePath: string;
  snippet: string;
}

export interface IndexingProgress {
  totalFiles: number;
  processedFiles: number;
  currentFile: string;
  stage: 'scanning' | 'parsing' | 'embedding' | 'storing' | 'completed';
  errors: string[];
}

export type IndexingState = 'idle' | 'indexing' | 'indexed' | 'error' | 'watching';

export interface CodeIndexConfig {
  vectorStore: VectorStoreConfig;
  embedder: EmbedderConfig;
  parser?: ParserConfig;
  search?: SearchConfig;
  watcher?: WatcherConfig;
}

export interface VectorStoreConfig {
  type: 'qdrant';
  url: string;
  collectionName?: string;
  apiKey?: string;
}

export interface EmbedderConfig {
  type: 'openai' | 'gemini';
  apiKey: string;
  model?: string;
  batchSize?: number;
  baseURL?: string;
}

export interface ParserConfig {
  maxBlockChars?: number;
  minBlockChars?: number;
  excludePatterns?: string[];
  includePatterns?: string[];
  maxFileSize?: number;
}

export interface SearchConfig {
  minScore?: number;
  maxResults?: number;
  includeSnippet?: boolean;
}

export interface WatcherConfig {
  enabled?: boolean;
  debounceMs?: number;
  excludePatterns?: string[];
}

export interface IVectorStore {
  initialize(): Promise<void>;
  upsertPoints(points: VectorPoint[]): Promise<void>;
  searchSimilar(vector: number[], limit: number, minScore?: number): Promise<VectorStoreSearchResult[]>;
  clearCollection(): Promise<void>;
  deletePointsByFilePath(filePath: string): Promise<void>;
  collectionExists(): Promise<boolean>;
}

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: CodeBlock;
}

export interface IEmbedder {
  createEmbeddings(texts: string[]): Promise<number[][]>;
  getMaxTokens(): number;
  getModel(): string;
}

export interface IDirectoryScanner {
  scanDirectory(
    directoryPath: string,
    onProgress?: (progress: IndexingProgress) => void
  ): Promise<CodeBlock[]>;
}

export interface IFileWatcher {
  start(directoryPath: string, onFileChange: (filePath: string, changeType: 'add' | 'change' | 'unlink') => void): void;
  stop(): void;
}

export interface ICodeIndexManager {
  indexDirectory(directoryPath: string, onProgress?: (progress: IndexingProgress) => void): Promise<void>;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  startWatching(directoryPath: string): void;
  stopWatching(): void;
  clearIndex(): Promise<void>;
  getState(): IndexingState;
}

export interface SearchOptions {
  minScore?: number;
  maxResults?: number;
  includeSnippet?: boolean;
  filePatterns?: string[];
  excludePatterns?: string[];
}