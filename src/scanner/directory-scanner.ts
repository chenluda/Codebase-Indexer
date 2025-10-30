import { readdir, stat } from "fs/promises";
import * as path from "path";
import ignore from "ignore";
import { IDirectoryScanner, CodeBlock, IndexingProgress } from "../types";
import { CodeParser } from "../parser/code-parser";
import { 
  MAX_FILE_SIZE_BYTES, 
  PARSING_CONCURRENCY, 
  DEFAULT_PARSER_CONFIG 
} from "../constants";

/**
 * Directory scanner that processes files and extracts code blocks
 */
export class DirectoryScanner implements IDirectoryScanner {
  private parser: CodeParser;
  private ignoreFilter: ReturnType<typeof ignore>;

  constructor(excludePatterns: string[] = DEFAULT_PARSER_CONFIG.excludePatterns) {
    this.parser = new CodeParser();
    this.ignoreFilter = ignore().add(excludePatterns);
  }

  /**
   * Scans a directory and extracts code blocks from all supported files
   * @param directoryPath Path to the directory to scan
   * @param onProgress Optional progress callback
   * @returns Promise resolving to array of code blocks
   */
  async scanDirectory(
    directoryPath: string,
    onProgress?: (progress: IndexingProgress) => void
  ): Promise<CodeBlock[]> {
    const allFiles = await this.getAllFiles(directoryPath);
    const supportedFiles = allFiles.filter(file => !this.ignoreFilter.ignores(path.relative(directoryPath, file)));
    
    const progress: IndexingProgress = {
      totalFiles: supportedFiles.length,
      processedFiles: 0,
      currentFile: '',
      stage: 'scanning',
      errors: []
    };

    onProgress?.(progress);

    const allBlocks: CodeBlock[] = [];
    const semaphore = new Semaphore(PARSING_CONCURRENCY);

    // Process files in batches with concurrency control
    const promises = supportedFiles.map(async (filePath) => {
      return semaphore.acquire(async () => {
        try {
          progress.currentFile = filePath;
          progress.stage = 'parsing';
          onProgress?.(progress);

          const blocks = await this.processFile(filePath);
          allBlocks.push(...blocks);

          progress.processedFiles++;
          onProgress?.(progress);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          progress.errors.push(`Error processing ${filePath}: ${errorMessage}`);
          console.error(`Error processing file ${filePath}:`, error);
        }
      });
    });

    await Promise.all(promises);

    progress.stage = 'completed';
    onProgress?.(progress);

    return allBlocks;
  }

  /**
   * Recursively gets all files in a directory
   * @param dirPath Directory path
   * @returns Promise resolving to array of file paths
   */
  private async getAllFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await readdir(dirPath);
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        
        try {
          const stats = await stat(fullPath);
          
          if (stats.isDirectory()) {
            // Skip if directory is ignored
            if (!this.ignoreFilter.ignores(path.relative(dirPath, fullPath))) {
              const subFiles = await this.getAllFiles(fullPath);
              files.push(...subFiles);
            }
          } else if (stats.isFile()) {
            files.push(fullPath);
          }
        } catch (error) {
          console.warn(`Error accessing ${fullPath}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error);
    }
    
    return files;
  }

  /**
   * Processes a single file and extracts code blocks
   * @param filePath Path to the file
   * @returns Promise resolving to array of code blocks
   */
  private async processFile(filePath: string): Promise<CodeBlock[]> {
    try {
      // Check file size
      const stats = await stat(filePath);
      if (stats.size > MAX_FILE_SIZE_BYTES) {
        console.warn(`Skipping large file: ${filePath} (${stats.size} bytes)`);
        return [];
      }

      // Parse the file
      const blocks = await this.parser.parseFile(filePath);
      return blocks;
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
      return [];
    }
  }
}

/**
 * Simple semaphore implementation for concurrency control
 */
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this.permits > 0) {
        this.permits--;
        this.executeTask(task, resolve, reject);
      } else {
        this.waiting.push(() => {
          this.permits--;
          this.executeTask(task, resolve, reject);
        });
      }
    });
  }

  private async executeTask<T>(
    task: () => Promise<T>,
    resolve: (value: T) => void,
    reject: (reason: any) => void
  ): Promise<void> {
    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.permits++;
      if (this.waiting.length > 0) {
        const next = this.waiting.shift();
        next?.();
      }
    }
  }
}