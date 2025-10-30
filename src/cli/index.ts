#!/usr/bin/env node

// Load environment variables from .env file
import * as dotenv from 'dotenv';
dotenv.config();

import { Command } from 'commander';
import * as path from 'path';
import { CodebaseIndexer } from '../manager/codebase-indexer';
import { CodeIndexConfig, IndexingProgress } from '../types';

const program = new Command();

program
  .name('codebase-indexer')
  .description('A powerful codebase indexing and semantic search tool')
  .version('1.0.0');

// Index command
program
  .command('index')
  .description('Index a directory')
  .argument('<directory>', 'Directory to index')
  .option('-c, --config <path>', 'Configuration file path')
  .option('--openai-key <key>', 'OpenAI API key')
  .option('--openai-base-url <url>', 'OpenAI API base URL')
  .option('--qdrant-url <url>', 'Qdrant server URL', 'http://localhost:6333')
  .option('--collection <name>', 'Collection name', 'codebase_index')
  .option('--model <model>', 'Embedding model', 'text-embedding-ada-002')
  .option('--batch-size <size>', 'Batch size for embeddings', '100')
  .option('--exclude <patterns...>', 'Exclude patterns')
  .action(async (directory: string, options: any) => {
    try {
      const absolutePath = path.resolve(directory);
      
      // Build configuration
      const config: Partial<CodeIndexConfig> = {
        vectorStore: {
          type: 'qdrant',
          url: options.qdrantUrl,
          collectionName: options.collection
        },
        embedder: {
          type: 'openai',
          apiKey: options.openaiKey || process.env.OPENAI_API_KEY || '',
          model: options.model,
          batchSize: parseInt(options.batchSize),
          baseURL: options.openaiBaseUrl || process.env.OPENAI_BASE_URL
        }
      };

      if (options.exclude) {
        config.parser = {
          excludePatterns: options.exclude
        };
      }

      // Load config file if provided
      if (options.config) {
        const configFile = await import(path.resolve(options.config));
        Object.assign(config, configFile.default || configFile);
      }

      const indexer = new CodebaseIndexer(config);

      console.log(`🚀 Starting to index directory: ${absolutePath}`);
      
      await indexer.indexDirectory(absolutePath, (progress: IndexingProgress) => {
        const percentage = progress.totalFiles > 0 
          ? Math.round((progress.processedFiles / progress.totalFiles) * 100)
          : 0;
        
        console.log(`📊 Progress: ${percentage}% (${progress.processedFiles}/${progress.totalFiles}) - ${progress.stage} - ${progress.currentFile}`);
        
        if (progress.errors.length > 0) {
          console.warn('⚠️  Errors:', progress.errors.slice(-3)); // Show last 3 errors
        }
      });

      console.log('✅ Indexing completed successfully!');
    } catch (error) {
      console.error('❌ Error during indexing:', error);
      process.exit(1);
    }
  });

// Search command
program
  .command('search')
  .description('Search the indexed codebase')
  .argument('<query>', 'Search query')
  .option('-c, --config <path>', 'Configuration file path')
  .option('--openai-key <key>', 'OpenAI API key')
  .option('--openai-base-url <url>', 'OpenAI API base URL')
  .option('--qdrant-url <url>', 'Qdrant server URL', 'http://localhost:6333')
  .option('--collection <name>', 'Collection name', 'codebase_index')
  .option('--max-results <num>', 'Maximum number of results', '10')
  .option('--min-score <score>', 'Minimum similarity score', '0.7')
  .option('--snippet', 'Include code snippets in results')
  .action(async (query: string, options: any) => {
    try {
      // Build configuration
      const config: Partial<CodeIndexConfig> = {
        vectorStore: {
          type: 'qdrant',
          url: options.qdrantUrl,
          collectionName: options.collection
        },
        embedder: {
          type: 'openai',
          apiKey: options.openaiKey || process.env.OPENAI_API_KEY || '',
          model: 'text-embedding-ada-002',
          baseURL: options.openaiBaseUrl || process.env.OPENAI_BASE_URL
        },
        search: {
          maxResults: parseInt(options.maxResults),
          minScore: parseFloat(options.minScore),
          includeSnippet: options.snippet
        }
      };

      // Load config file if provided
      if (options.config) {
        const configFile = await import(path.resolve(options.config));
        Object.assign(config, configFile.default || configFile);
      }

      const indexer = new CodebaseIndexer(config);

      console.log(`🔍 Searching for: "${query}"`);
      
      const results = await indexer.search(query);

      if (results.length === 0) {
        console.log('❌ No results found');
        return;
      }

      console.log(`\n✅ Found ${results.length} results:\n`);

      results.forEach((result, index) => {
        console.log(`${index + 1}. 📁 ${result.filePath}`);
        console.log(`   📊 Score: ${result.score.toFixed(3)}`);
        console.log(`   🏷️  Type: ${result.codeBlock.type}`);
        if (result.codeBlock.name) {
          console.log(`   📝 Name: ${result.codeBlock.name}`);
        }
        console.log(`   📍 Lines: ${result.codeBlock.startLine}-${result.codeBlock.endLine}`);
        
        if (options.snippet) {
          console.log(`   📄 Snippet:`);
          console.log(`   ${result.snippet.split('\n').map(line => `   ${line}`).join('\n')}`);
        }
        console.log('');
      });
    } catch (error) {
      console.error('❌ Error during search:', error);
      process.exit(1);
    }
  });

// Watch command
program
  .command('watch')
  .description('Watch a directory for changes and update index')
  .argument('<directory>', 'Directory to watch')
  .option('-c, --config <path>', 'Configuration file path')
  .option('--openai-key <key>', 'OpenAI API key')
  .option('--openai-base-url <url>', 'OpenAI API base URL')
  .option('--qdrant-url <url>', 'Qdrant server URL', 'http://localhost:6333')
  .option('--collection <name>', 'Collection name', 'codebase_index')
  .option('--debounce <ms>', 'Debounce time in milliseconds', '1000')
  .action(async (directory: string, options: any) => {
    try {
      const absolutePath = path.resolve(directory);
      
      // Build configuration
      const config: Partial<CodeIndexConfig> = {
        vectorStore: {
          type: 'qdrant',
          url: options.qdrantUrl,
          collectionName: options.collection
        },
        embedder: {
          type: 'openai',
          apiKey: options.openaiKey || process.env.OPENAI_API_KEY || '',
          model: 'text-embedding-ada-002',
          baseURL: options.openaiBaseUrl || process.env.OPENAI_BASE_URL
        },
        watcher: {
          debounceMs: parseInt(options.debounce)
        }
      };

      // Load config file if provided
      if (options.config) {
        const configFile = await import(path.resolve(options.config));
        Object.assign(config, configFile.default || configFile);
      }

      const indexer = new CodebaseIndexer(config);

      console.log(`👀 Starting to watch directory: ${absolutePath}`);
      console.log('Press Ctrl+C to stop watching...');
      
      indexer.startWatching(absolutePath);

      // Keep the process running
      process.on('SIGINT', () => {
        console.log('\n🛑 Stopping watcher...');
        indexer.stopWatching();
        process.exit(0);
      });

      // Keep alive
      setInterval(() => {}, 1000);
    } catch (error) {
      console.error('❌ Error during watching:', error);
      process.exit(1);
    }
  });

// Clear command
program
  .command('clear')
  .description('Clear the index')
  .option('-c, --config <path>', 'Configuration file path')
  .option('--openai-key <key>', 'OpenAI API key')
  .option('--openai-base-url <url>', 'OpenAI API base URL')
  .option('--qdrant-url <url>', 'Qdrant server URL', 'http://localhost:6333')
  .option('--collection <name>', 'Collection name', 'codebase_index')
  .action(async (options: any) => {
    try {
      // Build configuration
      const config: Partial<CodeIndexConfig> = {
        vectorStore: {
          type: 'qdrant',
          url: options.qdrantUrl,
          collectionName: options.collection
        },
        embedder: {
          type: 'openai',
          apiKey: options.openaiKey || process.env.OPENAI_API_KEY || '',
          model: 'text-embedding-ada-002',
          baseURL: options.openaiBaseUrl || process.env.OPENAI_BASE_URL
        }
      };

      // Load config file if provided
      if (options.config) {
        const configFile = await import(path.resolve(options.config));
        Object.assign(config, configFile.default || configFile);
      }

      const indexer = new CodebaseIndexer(config);

      console.log('🗑️  Clearing index...');
      await indexer.clearIndex();
      console.log('✅ Index cleared successfully!');
    } catch (error) {
      console.error('❌ Error clearing index:', error);
      process.exit(1);
    }
  });

program.parse();