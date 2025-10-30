#!/usr/bin/env node

// Load environment variables from .env file
import * as dotenv from 'dotenv';
dotenv.config();

import { Command } from 'commander';
import * as path from 'path';
import { CodebaseIndexerServer } from './server';
import { CodeIndexConfig } from '../types';

const program = new Command();

program
  .name('codebase-indexer-server')
  .description('Start the Codebase Indexer API server')
  .version('1.0.0')
  .option('-p, --port <port>', 'Port to run the server on', '3000')
  .option('-c, --config <path>', 'Configuration file path')
  .option('--openai-key <key>', 'OpenAI API key')
  .option('--openai-base-url <url>', 'OpenAI API base URL')
  .option('--qdrant-url <url>', 'Qdrant server URL', 'http://localhost:6333')
  .option('--collection <name>', 'Collection name', 'codebase_index')
  .action(async (options: any) => {
    try {
      const port = parseInt(options.port);
      
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

      const server = new CodebaseIndexerServer(config, port);
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down server...');
        await server.stop();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        console.log('\n🛑 Shutting down server...');
        await server.stop();
        process.exit(0);
      });

      await server.start();
      console.log(`🚀 Server running on port ${port}`);
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  });

program.parse();

export { CodebaseIndexerServer };