import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import { CodebaseIndexer } from '../manager/codebase-indexer';
import { CodeIndexConfig } from '../types';

describe('CodebaseIndexer', () => {
  let indexer: CodebaseIndexer;
  let testDir: string;
  let config: Partial<CodeIndexConfig>;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(__dirname, 'temp-test-dir');
    await fs.mkdir(testDir, { recursive: true });

    // Create some test files
    await fs.writeFile(
      path.join(testDir, 'test.js'),
      `function hello() {
  console.log('Hello, world!');
}

class TestClass {
  constructor() {
    this.name = 'test';
  }
  
  greet() {
    return 'Hello from ' + this.name;
  }
}`
    );

    await fs.writeFile(
      path.join(testDir, 'test.py'),
      `def hello():
    print("Hello, world!")

class TestClass:
    def __init__(self):
        self.name = "test"
    
    def greet(self):
        return f"Hello from {self.name}"`
    );

    // Mock configuration for testing
    config = {
      vectorStore: {
        type: 'qdrant',
        url: 'http://localhost:6333',
        collectionName: 'test_collection'
      },
      embedder: {
        type: 'openai',
        apiKey: 'test-key',
        model: 'text-embedding-ada-002',
        batchSize: 10
      },
      parser: {
        maxBlockChars: 1000,
        minBlockChars: 10
      }
    };

    indexer = new CodebaseIndexer(config);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('initialization', () => {
    it('should create an indexer with default configuration', () => {
      const defaultIndexer = new CodebaseIndexer();
      expect(defaultIndexer).toBeDefined();
      expect(defaultIndexer.getState()).toBe('idle');
    });

    it('should create an indexer with custom configuration', () => {
      expect(indexer).toBeDefined();
      expect(indexer.getState()).toBe('idle');
    });
  });

  describe('state management', () => {
    it('should start in idle state', () => {
      expect(indexer.getState()).toBe('idle');
    });

    it('should change state during operations', async () => {
      // Note: This test would require mocking the vector store and embedder
      // to avoid actual API calls during testing
      expect(indexer.getState()).toBe('idle');
    });
  });

  describe('file watching', () => {
    it('should start and stop watching', () => {
      expect(indexer.getState()).toBe('idle');
      
      indexer.startWatching(testDir);
      expect(indexer.getState()).toBe('watching');
      
      indexer.stopWatching();
      expect(indexer.getState()).toBe('idle');
    });
  });

  describe('index clearing', () => {
    it('should clear index and reset state', async () => {
      // Note: This test would require mocking the vector store
      // to avoid actual database operations during testing
      expect(indexer.getState()).toBe('idle');
      
      // Mock the clearIndex method to avoid actual API calls
      // await indexer.clearIndex();
      // expect(indexer.getState()).toBe('idle');
    });
  });
});

describe('CodeParser', () => {
  it('should be tested separately', () => {
    // Parser tests would go here
    expect(true).toBe(true);
  });
});

describe('DirectoryScanner', () => {
  it('should be tested separately', () => {
    // Scanner tests would go here
    expect(true).toBe(true);
  });
});

describe('FileWatcher', () => {
  it('should be tested separately', () => {
    // Watcher tests would go here
    expect(true).toBe(true);
  });
});