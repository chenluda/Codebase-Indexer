import { OpenAI } from "openai";
import { IEmbedder } from "../types";
import {
  MAX_BATCH_TOKENS,
  MAX_ITEM_TOKENS,
  MAX_BATCH_RETRIES,
  INITIAL_RETRY_DELAY_MS,
} from "../constants";

/**
 * OpenAI implementation of the embedder interface with batching and rate limiting
 */
export class OpenAiEmbedder implements IEmbedder {
  private embeddingsClient: OpenAI;
  private readonly model: string;

  /**
   * Creates a new OpenAI embedder
   * @param apiKey OpenAI API key
   * @param model Model identifier (default: text-embedding-ada-002)
   * @param baseURL Custom API base URL (optional)
   */
  constructor(apiKey: string, model: string = "text-embedding-ada-002", baseURL?: string) {
    const config: any = { apiKey };
    if (baseURL) {
      config.baseURL = baseURL;
    }
    this.embeddingsClient = new OpenAI(config);
    this.model = model;
    
    // 输出调试信息
    console.log(`🔧 OpenAI Embedder initialized with model: ${model}`);
    if (baseURL) {
      console.log(`🌐 Using custom baseURL: ${baseURL}`);
    }
  }

  /**
   * Creates embeddings for the given texts with batching and rate limiting
   * @param texts Array of text strings to embed
   * @returns Promise resolving to array of embedding vectors
   */
  async createEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const allEmbeddings: number[][] = [];
    const remainingTexts = [...texts];

    while (remainingTexts.length > 0) {
      const currentBatch: string[] = [];
      let currentBatchTokens = 0;
      const processedIndices: number[] = [];

      // Build batch within token limits
      for (let i = 0; i < remainingTexts.length; i++) {
        const text = remainingTexts[i];
        const itemTokens = Math.ceil(text.length / 4); // Rough token estimation

        if (itemTokens > MAX_ITEM_TOKENS) {
          console.warn(
            `Text at index ${i} exceeds token limit (${itemTokens} > ${MAX_ITEM_TOKENS}). Skipping.`
          );
          processedIndices.push(i);
          continue;
        }

        if (currentBatchTokens + itemTokens > MAX_BATCH_TOKENS) {
          break;
        }

        currentBatch.push(text);
        currentBatchTokens += itemTokens;
        processedIndices.push(i);
      }

      // Remove processed texts from remaining (in reverse order to maintain indices)
      for (let i = processedIndices.length - 1; i >= 0; i--) {
        remainingTexts.splice(processedIndices[i], 1);
      }

      if (currentBatch.length > 0) {
        console.log(`📤 Sending batch of ${currentBatch.length} items for embedding`);
        const batchResult = await this._embedBatchWithRetries(currentBatch);
        allEmbeddings.push(...batchResult.embeddings);
      }
    }

    return allEmbeddings;
  }

  private async _embedBatchWithRetries(
    batchTexts: string[]
  ): Promise<{ embeddings: number[][] }> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_BATCH_RETRIES; attempt++) {
      try {
        const response = await this.embeddingsClient.embeddings.create({
          model: this.model,
          input: batchTexts,
          encoding_format: "float",
        });

        const embeddings = response.data.map(item => item.embedding);
        console.log(`📥 Received embeddings for batch, count: ${embeddings.length}`);
        return { embeddings };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // 提供更详细的错误信息
        console.error(`❌ Embedding error details:`, {
          message: lastError.message,
          name: lastError.name,
          stack: lastError.stack,
          attempt: attempt + 1,
          maxRetries: MAX_BATCH_RETRIES,
          model: this.model,
          batchLength: batchTexts.length
        });
        
        if (attempt < MAX_BATCH_RETRIES - 1) {
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
          console.warn(
            `Embedding batch failed (attempt ${attempt + 1}/${MAX_BATCH_RETRIES}). Retrying in ${delay}ms...`,
            lastError.message
          );
          await this.delay(delay);
        }
      }
    }

    throw new Error(
      `Failed to create embeddings after ${MAX_BATCH_RETRIES} attempts. Last error: ${lastError?.message}`
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validates the embedder configuration
   * @returns Promise resolving to validation result
   */
  async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
    try {
      // Test with a simple embedding request
      console.log(`🧪 Validating OpenAI configuration with model: ${this.model}`);
      await this.embeddingsClient.embeddings.create({
        model: this.model,
        input: ["test"],
        encoding_format: "float",
      });
      console.log("✅ OpenAI configuration is valid");
      return { valid: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ OpenAI configuration validation failed: ${errorMessage}`);
      return { valid: false, error: errorMessage };
    }
  }

  getMaxTokens(): number {
    return MAX_ITEM_TOKENS;
  }

  getModel(): string {
    return this.model;
  }
}