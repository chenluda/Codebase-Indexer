import { watch, FSWatcher } from "chokidar";
import * as path from "path";
import { IFileWatcher } from "../types";
import { DEFAULT_WATCHER_CONFIG, EXTENSION_TO_LANGUAGE } from "../constants";

/**
 * File watcher that monitors directory changes and triggers callbacks
 */
export class FileWatcher implements IFileWatcher {
  private watcher: FSWatcher | undefined;
  private excludePatterns: string[];
  private debounceMs: number;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: { excludePatterns?: string[]; debounceMs?: number } = {}) {
    this.excludePatterns = config.excludePatterns || DEFAULT_WATCHER_CONFIG.excludePatterns;
    this.debounceMs = config.debounceMs || DEFAULT_WATCHER_CONFIG.debounceMs;
  }

  /**
   * Starts watching a directory for file changes
   * @param directoryPath Path to the directory to watch
   * @param onFileChange Callback function for file changes
   */
  start(
    directoryPath: string,
    onFileChange: (filePath: string, changeType: 'add' | 'change' | 'unlink') => void
  ): void {
    if (this.watcher) {
      this.stop();
    }

    this.watcher = watch(directoryPath, {
      ignored: this.excludePatterns,
      persistent: true,
      ignoreInitial: true,
      followSymlinks: false,
    });

    // Handle file additions
    this.watcher.on('add', (filePath: string) => {
      if (this.isSupportedFile(filePath)) {
        this.debounceCallback(filePath, 'add', onFileChange);
      }
    });

    // Handle file changes
    this.watcher.on('change', (filePath: string) => {
      if (this.isSupportedFile(filePath)) {
        this.debounceCallback(filePath, 'change', onFileChange);
      }
    });

    // Handle file deletions
    this.watcher.on('unlink', (filePath: string) => {
      if (this.isSupportedFile(filePath)) {
        this.debounceCallback(filePath, 'unlink', onFileChange);
      }
    });

    // Handle errors
    this.watcher.on('error', (error: Error) => {
      console.error('File watcher error:', error);
    });

    console.log(`Started watching directory: ${directoryPath}`);
  }

  /**
   * Stops the file watcher
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }

    // Clear any pending debounce timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();

    console.log('Stopped file watcher');
  }

  /**
   * Checks if a file is supported for indexing
   * @param filePath Path to the file
   * @returns Boolean indicating if the file is supported
   */
  private isSupportedFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext in EXTENSION_TO_LANGUAGE;
  }

  /**
   * Debounces file change callbacks to avoid excessive processing
   * @param filePath Path to the changed file
   * @param changeType Type of change
   * @param callback Callback function to invoke
   */
  private debounceCallback(
    filePath: string,
    changeType: 'add' | 'change' | 'unlink',
    callback: (filePath: string, changeType: 'add' | 'change' | 'unlink') => void
  ): void {
    // Clear existing timer for this file
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      callback(filePath, changeType);
      this.debounceTimers.delete(filePath);
    }, this.debounceMs);

    this.debounceTimers.set(filePath, timer);
  }
}