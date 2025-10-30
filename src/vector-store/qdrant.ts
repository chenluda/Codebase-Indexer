import { QdrantClient, Schemas } from "@qdrant/js-client-rest";
import { createHash } from "crypto";
import { IVectorStore, VectorPoint, VectorStoreSearchResult, CodeBlock } from "../types";
import { DEFAULT_MAX_SEARCH_RESULTS, DEFAULT_SEARCH_MIN_SCORE } from "../constants";

/**
 * Qdrant implementation of the vector store interface
 */
export class QdrantVectorStore implements IVectorStore {
  private readonly vectorSize: number;
  private readonly DISTANCE_METRIC = "Cosine";
  
  private client: QdrantClient;
  private readonly collectionName: string;
  private readonly qdrantUrl: string;

  /**
   * Creates a new Qdrant vector store
   * @param workspacePath Path to the workspace (used for collection naming)
   * @param url URL to the Qdrant server
   * @param vectorSize Size of the vectors
   * @param apiKey Optional API key for authentication
   * @param collectionName Optional custom collection name
   */
  constructor(workspacePath: string, url: string, vectorSize: number, apiKey?: string, collectionName?: string) {
    this.qdrantUrl = this.parseQdrantUrl(url);
    this.vectorSize = vectorSize;

    try {
      const urlObj = new URL(this.qdrantUrl);
      
      let port: number;
      let useHttps: boolean;

      if (urlObj.port) {
        port = Number(urlObj.port);
        useHttps = urlObj.protocol === "https:";
      } else {
        if (urlObj.protocol === "https:") {
          port = 443;
          useHttps = true;
        } else {
          port = 6333; // Default Qdrant port
          useHttps = false;
        }
      }

      const clientConfig: any = {
        host: urlObj.hostname,
        https: useHttps,
        port: port,
        headers: {
          "User-Agent": "codebase-indexer/1.0.0",
        },
      };
      
      const prefix = urlObj.pathname === "/" ? undefined : urlObj.pathname.replace(/\/+$/, "");
      if (prefix) {
        clientConfig.prefix = prefix;
      }
      
      if (apiKey) {
        clientConfig.apiKey = apiKey;
      }
      
      this.client = new QdrantClient(clientConfig);
    } catch (urlError) {
      const fallbackConfig: any = {
        url: this.qdrantUrl,
        headers: {
          'User-Agent': 'codebase-indexer/1.0.0',
        },
      };
      
      if (apiKey) {
        fallbackConfig.apiKey = apiKey;
      }
      
      this.client = new QdrantClient(fallbackConfig);
    }

    // Use custom collection name or generate from workspace path
    if (collectionName) {
      this.collectionName = collectionName;
    } else {
      const hash = createHash("sha256").update(workspacePath).digest("hex");
      this.collectionName = `codebase-${hash.substring(0, 16)}`;
    }
  }

  private parseQdrantUrl(url: string | undefined): string {
    if (!url || url.trim() === "") {
      return "http://localhost:6333";
    }

    const trimmedUrl = url.trim();

    if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://") && !trimmedUrl.includes("://")) {
      return this.parseHostname(trimmedUrl);
    }

    try {
      new URL(trimmedUrl);
      return trimmedUrl;
    } catch {
      return this.parseHostname(trimmedUrl);
    }
  }

  private parseHostname(hostname: string): string {
    if (hostname.includes(":")) {
      return hostname.startsWith("http") ? hostname : `http://${hostname}`;
    } else {
      return `http://${hostname}:6333`;
    }
  }

  private async getCollectionInfo(): Promise<Schemas["CollectionInfo"] | null> {
    try {
      const collectionInfo = await this.client.getCollection(this.collectionName);
      return collectionInfo as Schemas["CollectionInfo"];
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.warn(
          `[QdrantVectorStore] Warning during getCollectionInfo for "${this.collectionName}". Collection may not exist:`,
          error.message,
        );
      }
      return null;
    }
  }

  async initialize(): Promise<void> {
    const collectionInfo = await this.getCollectionInfo();
    
    if (!collectionInfo) {
      // Create new collection
      await this.client.createCollection(this.collectionName, {
        vectors: {
          size: this.vectorSize,
          distance: this.DISTANCE_METRIC,
        },
      });
      
      // Create payload indexes for better search performance
      await this._createPayloadIndexes();
    } else {
      // Check if vector size matches
      const existingVectorSize = collectionInfo.config?.params?.vectors?.size;
      if (existingVectorSize && existingVectorSize !== this.vectorSize) {
        console.warn(
          `Vector size mismatch. Expected: ${this.vectorSize}, Found: ${existingVectorSize}. Recreating collection.`
        );
        await this._recreateCollectionWithNewDimension();
      }
    }
  }

  private async _recreateCollectionWithNewDimension(): Promise<void> {
    try {
      await this.client.deleteCollection(this.collectionName);
    } catch (error) {
      console.warn("Failed to delete existing collection:", error);
    }

    await this.client.createCollection(this.collectionName, {
      vectors: {
        size: this.vectorSize,
        distance: this.DISTANCE_METRIC,
      },
    });

    await this._createPayloadIndexes();
  }

  private async _createPayloadIndexes(): Promise<void> {
    try {
      await this.client.createPayloadIndex(this.collectionName, {
        field_name: "filePath",
        field_schema: "keyword",
      });
      
      await this.client.createPayloadIndex(this.collectionName, {
        field_name: "language",
        field_schema: "keyword",
      });
      
      await this.client.createPayloadIndex(this.collectionName, {
        field_name: "type",
        field_schema: "keyword",
      });
    } catch (error) {
      console.warn("Failed to create payload indexes:", error);
    }
  }

  async upsertPoints(points: VectorPoint[]): Promise<void> {
    if (points.length === 0) return;

    const qdrantPoints = points.map(point => ({
      id: point.id,
      vector: point.vector,
      payload: this.sanitizePayload(point.payload),
    }));

    await this.client.upsert(this.collectionName, {
      wait: true,
      points: qdrantPoints,
    });
  }

  private sanitizePayload(payload: CodeBlock): Record<string, any> {
    return {
      filePath: payload.filePath,
      content: payload.content,
      language: payload.language,
      startLine: payload.startLine,
      endLine: payload.endLine,
      type: payload.type,
      name: payload.name || null,
      metadata: payload.metadata || {},
    };
  }

  async searchSimilar(
    vector: number[],
    limit: number = DEFAULT_MAX_SEARCH_RESULTS,
    minScore: number = DEFAULT_SEARCH_MIN_SCORE
  ): Promise<VectorStoreSearchResult[]> {
    const searchResult = await this.client.search(this.collectionName, {
      vector,
      limit,
      score_threshold: minScore,
      with_payload: true,
    });

    return searchResult.map((result: any) => ({
      id: String(result.id),
      score: result.score || 0,
      payload: this.deserializePayload(result.payload),
    }));
  }

  private deserializePayload(payload: any): CodeBlock {
    return {
      id: payload.id || "",
      filePath: payload.filePath || "",
      content: payload.content || "",
      language: payload.language || "",
      startLine: payload.startLine || 0,
      endLine: payload.endLine || 0,
      type: payload.type || "other",
      name: payload.name || undefined,
      metadata: payload.metadata || {},
    };
  }

  async deletePoints(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    await this.client.delete(this.collectionName, {
      wait: true,
      points: ids,
    });
  }

  async deletePointsByFilePath(filePath: string): Promise<void> {
    await this.client.delete(this.collectionName, {
      wait: true,
      filter: {
        must: [
          {
            key: "filePath",
            match: { value: filePath },
          },
        ],
      },
    });
  }

  async clearCollection(): Promise<void> {
    try {
      await this.client.deleteCollection(this.collectionName);
      await this.initialize();
    } catch (error) {
      console.error('Error clearing collection:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    // Qdrant client doesn't require explicit closing
  }

  async collectionExists(): Promise<boolean> {
    const collectionInfo = await this.getCollectionInfo();
    return collectionInfo !== null;
  }
}