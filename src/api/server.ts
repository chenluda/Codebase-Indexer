import * as http from 'http';
import * as url from 'url';
import * as path from 'path';
import { CodebaseIndexer } from '../manager/codebase-indexer';
import { CodeIndexConfig, IndexingProgress } from '../types';

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class CodebaseIndexerServer {
  private server: http.Server;
  private indexer: CodebaseIndexer;
  private port: number;

  constructor(config: Partial<CodeIndexConfig>, port: number = 3000) {
    this.indexer = new CodebaseIndexer(config);
    this.port = port;
    this.server = http.createServer(this.handleRequest.bind(this));
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url || '', true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    try {
      let response: ApiResponse;

      if (pathname === '/health' && method === 'GET') {
        response = await this.handleHealth();
      } else if (pathname === '/index' && method === 'POST') {
        response = await this.handleIndex(req);
      } else if (pathname === '/search' && method === 'POST') {
        response = await this.handleSearch(req);
      } else if (pathname === '/watch' && method === 'POST') {
        response = await this.handleWatch(req);
      } else if (pathname === '/watch' && method === 'DELETE') {
        response = await this.handleStopWatch();
      } else if (pathname === '/clear' && method === 'DELETE') {
        response = await this.handleClear();
      } else if (pathname === '/status' && method === 'GET') {
        response = await this.handleStatus();
      } else {
        response = { success: false, error: 'Not found' };
        res.writeHead(404);
      }

      res.setHeader('Content-Type', 'application/json');
      if (!res.headersSent) {
        res.writeHead(response.success ? 200 : 400);
      }
      res.end(JSON.stringify(response));
    } catch (error) {
      const errorResponse: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      };
      
      res.setHeader('Content-Type', 'application/json');
      if (!res.headersSent) {
        res.writeHead(500);
      }
      res.end(JSON.stringify(errorResponse));
    }
  }

  private async handleHealth(): Promise<ApiResponse> {
    return { success: true, data: { status: 'healthy', timestamp: new Date().toISOString() } };
  }

  private async handleIndex(req: http.IncomingMessage): Promise<ApiResponse> {
    const body = await this.getRequestBody(req);
    const { directoryPath } = JSON.parse(body);

    if (!directoryPath) {
      return { success: false, error: 'directoryPath is required' };
    }

    const absolutePath = path.resolve(directoryPath);
    
    await this.indexer.indexDirectory(absolutePath, (progress: IndexingProgress) => {
      // In a real implementation, you might want to use WebSockets or Server-Sent Events
      // to send progress updates to the client
      console.log(`Progress: ${progress.processedFiles}/${progress.totalFiles} - ${progress.stage}`);
    });

    return { success: true, data: { message: 'Indexing completed', path: absolutePath } };
  }

  private async handleSearch(req: http.IncomingMessage): Promise<ApiResponse> {
    const body = await this.getRequestBody(req);
    const { query, options = {} } = JSON.parse(body);

    if (!query) {
      return { success: false, error: 'query is required' };
    }

    const results = await this.indexer.search(query, options);
    return { success: true, data: { results, count: results.length } };
  }

  private async handleWatch(req: http.IncomingMessage): Promise<ApiResponse> {
    const body = await this.getRequestBody(req);
    const { directoryPath } = JSON.parse(body);

    if (!directoryPath) {
      return { success: false, error: 'directoryPath is required' };
    }

    const absolutePath = path.resolve(directoryPath);
    this.indexer.startWatching(absolutePath);

    return { success: true, data: { message: 'Watching started', path: absolutePath } };
  }

  private async handleStopWatch(): Promise<ApiResponse> {
    this.indexer.stopWatching();
    return { success: true, data: { message: 'Watching stopped' } };
  }

  private async handleClear(): Promise<ApiResponse> {
    await this.indexer.clearIndex();
    return { success: true, data: { message: 'Index cleared' } };
  }

  private async handleStatus(): Promise<ApiResponse> {
    const state = this.indexer.getState();
    return { success: true, data: { state, timestamp: new Date().toISOString() } };
  }

  private getRequestBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        resolve(body);
      });
      req.on('error', reject);
    });
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`🚀 Codebase Indexer API server running on http://localhost:${this.port}`);
        console.log('Available endpoints:');
        console.log('  GET  /health - Health check');
        console.log('  GET  /status - Get indexer status');
        console.log('  POST /index - Index a directory');
        console.log('  POST /search - Search the index');
        console.log('  POST /watch - Start watching a directory');
        console.log('  DELETE /watch - Stop watching');
        console.log('  DELETE /clear - Clear the index');
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.indexer.stopWatching();
      this.server.close(() => {
        console.log('🛑 Server stopped');
        resolve();
      });
    });
  }
}