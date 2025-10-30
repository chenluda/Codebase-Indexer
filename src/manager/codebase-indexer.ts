import { 
  ICodeIndexManager, 
  CodeIndexConfig, 
  IndexingProgress, 
  SearchResult, 
  SearchOptions, 
  IndexingState,
  IVectorStore,
  IEmbedder,
  IDirectoryScanner,
  IFileWatcher,
  VectorPoint
} from "../types";
import { QdrantVectorStore } from "../vector-store/qdrant";
import { OpenAiEmbedder } from "../embedders/openai";
import { DirectoryScanner } from "../scanner/directory-scanner";
import { FileWatcher } from "../watcher/file-watcher";
import { CodeParser } from "../parser/code-parser";
import { 
  DEFAULT_VECTOR_STORE_CONFIG,
  DEFAULT_EMBEDDER_CONFIG,
  DEFAULT_SEARCH_CONFIG,
  DEFAULT_WATCHER_CONFIG,
  BATCH_SEGMENT_THRESHOLD
} from "../constants";

/**
 * Main codebase indexer that orchestrates all components
 */
export class CodebaseIndexer implements ICodeIndexManager {
  private vectorStore!: IVectorStore;
  private embedder!: IEmbedder;
  private scanner!: IDirectoryScanner;
  private watcher!: IFileWatcher;
  private parser!: CodeParser;
  private config: CodeIndexConfig;
  private state: IndexingState = 'idle';
  private currentWatchPath: string | undefined;

  constructor(config: Partial<CodeIndexConfig> = {}) {
    this.config = {
      vectorStore: { ...DEFAULT_VECTOR_STORE_CONFIG, ...config.vectorStore },
      embedder: { 
        ...DEFAULT_EMBEDDER_CONFIG, 
        ...config.embedder,
        apiKey: config.embedder?.apiKey || DEFAULT_EMBEDDER_CONFIG.apiKey || ''
      },
      parser: { ...config.parser },
      search: { ...DEFAULT_SEARCH_CONFIG, ...config.search },
      watcher: { ...DEFAULT_WATCHER_CONFIG, ...config.watcher }
    };

    this.initializeComponents();
  }

  private initializeComponents(): void {
    // Initialize vector store
    this.vectorStore = new QdrantVectorStore(
      process.cwd(), // Use current working directory as workspace
      this.config.vectorStore.url,
      1536, // Default OpenAI embedding dimension
      this.config.vectorStore.apiKey,
      this.config.vectorStore.collectionName
    );

    // Initialize embedder
    if (this.config.embedder.type === 'openai') {
      this.embedder = new OpenAiEmbedder(
        this.config.embedder.apiKey,
        this.config.embedder.model,
        this.config.embedder.baseURL
      );
    } else {
      throw new Error(`Unsupported embedder type: ${this.config.embedder.type}`);
    }

    // Initialize scanner
    this.scanner = new DirectoryScanner(this.config.parser?.excludePatterns);

    // Initialize watcher
    const watcherConfig: { excludePatterns?: string[]; debounceMs?: number } = {};
    if (this.config.watcher?.excludePatterns) {
      watcherConfig.excludePatterns = this.config.watcher.excludePatterns;
    }
    if (this.config.watcher?.debounceMs) {
      watcherConfig.debounceMs = this.config.watcher.debounceMs;
    }
    this.watcher = new FileWatcher(watcherConfig);

    // Initialize parser
    this.parser = new CodeParser();
  }

  /**
   * Indexes a directory and all its supported files
   * @param directoryPath Path to the directory to index
   * @param onProgress Optional progress callback
   */
  async indexDirectory(
    directoryPath: string,
    onProgress?: (progress: IndexingProgress) => void
  ): Promise<void> {
    if (this.state === 'indexing') {
      throw new Error('Indexing is already in progress');
    }

    this.state = 'indexing';

    try {
      // Initialize vector store
      await this.vectorStore.initialize();

      // Scan directory for code blocks
      const progress: IndexingProgress = {
        totalFiles: 0,
        processedFiles: 0,
        currentFile: '',
        stage: 'scanning',
        errors: []
      };

      onProgress?.(progress);

      const codeBlocks = await this.scanner.scanDirectory(directoryPath, onProgress);

      if (codeBlocks.length === 0) {
        this.state = 'indexed';
        return;
      }

      // Process blocks in batches
      progress.stage = 'embedding';
      onProgress?.(progress);

      const batches = this.createBatches(codeBlocks, BATCH_SEGMENT_THRESHOLD);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        progress.currentFile = `Processing batch ${i + 1}/${batches.length}`;
        onProgress?.(progress);

        await this.processBatch(batch);
      }

      this.state = 'indexed';
      progress.stage = 'completed';
      onProgress?.(progress);

    } catch (error) {
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Searches the indexed codebase
   * @param query Search query
   * @param options Search options
   * @returns Promise resolving to search results
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    // Check if collection exists in vector store instead of relying on memory state
    const collectionExists = await this.vectorStore.collectionExists();
    if (!collectionExists) {
      throw new Error('Codebase is not indexed. Please run indexDirectory first.');
    }

    const searchOptions = { ...this.config.search, ...options };

    // Create embedding for the query
    const queryEmbeddings = await this.embedder.createEmbeddings([query]);
    if (queryEmbeddings.length === 0) {
      return [];
    }

    const queryVector = queryEmbeddings[0];

    // Search vector store
    const vectorResults = await this.vectorStore.searchSimilar(
      queryVector,
      searchOptions.maxResults || 10,
      searchOptions.minScore
    );

    // Convert to search results
    const results: SearchResult[] = vectorResults.map(result => ({
      codeBlock: result.payload,
      score: result.score,
      filePath: result.payload.filePath,
      snippet: this.createSnippet(result.payload.content, searchOptions.includeSnippet || false)
    }));

    return results;
  }

  /**
   * Starts watching a directory for file changes
   * @param directoryPath Path to the directory to watch
   */
  startWatching(directoryPath: string): void {
    if (this.state === 'watching') {
      this.stopWatching();
    }

    this.currentWatchPath = directoryPath;
    this.state = 'watching';

    this.watcher.start(directoryPath, async (filePath, changeType) => {
      try {
        await this.handleFileChange(filePath, changeType);
      } catch (error) {
        console.error('Error handling file change:', error);
      }
    });
  }

  /**
   * Stops watching for file changes
   */
  stopWatching(): void {
    this.watcher.stop();
    this.currentWatchPath = undefined;
    if (this.state === 'watching') {
      this.state = 'idle';
    }
  }

  /**
   * Clears the entire index
   */
  async clearIndex(): Promise<void> {
    await this.vectorStore.clearCollection();
    this.state = 'idle';
  }

  /**
   * Gets the current indexing state
   */
  getState(): IndexingState {
    return this.state;
  }

  /**
   * Gets the current watch path
   */
  getCurrentWatchPath(): string | undefined {
    return this.currentWatchPath;
  }

  /**
   * Handles file changes during watching
   * @param filePath Path to the changed file
   * @param changeType Type of change
   */
  private async handleFileChange(
    filePath: string,
    changeType: 'add' | 'change' | 'unlink'
  ): Promise<void> {
    if (changeType === 'unlink') {
      // Remove file from index
      await this.vectorStore.deletePointsByFilePath(filePath);
      return;
    }

    // For add/change, reprocess the file
    try {
      const codeBlocks = await this.parser.parseFile(filePath);
      
      if (codeBlocks.length > 0) {
        // Remove existing entries for this file
        await this.vectorStore.deletePointsByFilePath(filePath);
        
        // Add new entries
        await this.processBatch(codeBlocks);
      }
    } catch (error) {
      console.error(`Error processing file change for ${filePath}:`, error);
    }
  }

  /**
   * Processes a batch of code blocks
   * @param codeBlocks Array of code blocks to process
   */
  private async processBatch(codeBlocks: any[]): Promise<void> {
    // Extract text content for embedding
    const texts = codeBlocks.map(block => block.content);
    
    // Create embeddings
    const embeddings = await this.embedder.createEmbeddings(texts);
    
    // Create vector points
    const vectorPoints: VectorPoint[] = codeBlocks.map((block, index) => ({
      id: block.id,
      vector: embeddings[index],
      payload: block
    }));

    // Upsert to vector store
    await this.vectorStore.upsertPoints(vectorPoints);
  }

  /**
   * Creates batches of code blocks for processing
   * @param codeBlocks Array of code blocks
   * @param batchSize Size of each batch
   * @returns Array of batches
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Creates a snippet from content
   * @param content Full content
   * @param includeSnippet Whether to include snippet
   * @returns Snippet or full content
   */
  private createSnippet(content: string, includeSnippet?: boolean): string {
    if (!includeSnippet) {
      return content;
    }

    const maxSnippetLength = 200;
    if (content.length <= maxSnippetLength) {
      return content;
    }

    return content.substring(0, maxSnippetLength) + '...';
  }
}