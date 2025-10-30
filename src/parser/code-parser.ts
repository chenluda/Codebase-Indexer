import { readFile } from "fs/promises";
import { createHash } from "crypto";
import * as path from "path";
import { CodeBlock } from "../types";
import { 
  MAX_BLOCK_CHARS, 
  MIN_BLOCK_CHARS, 
  EXTENSION_TO_LANGUAGE 
} from "../constants";
import { extensions } from "../tree-sitter";
import { loadRequiredLanguageParsers } from "../tree-sitter/languageParser";

/**
 * Simple code parser that chunks files into manageable blocks
 */
export class CodeParser {
  /**
   * Parses a code file into code blocks using Tree-sitter AST parsing when possible
   * @param filePath Path to the file to parse
   * @param content Optional file content (if not provided, will read from file)
   * @returns Promise resolving to array of code blocks
   */
  async parseFile(filePath: string, content?: string): Promise<CodeBlock[]> {
    const ext = path.extname(filePath).toLowerCase();
    
    // Check if supported language
    if (!this.isSupportedLanguage(ext)) {
      return [];
    }

    // Get file content
    let fileContent: string;
    if (content) {
      fileContent = content;
    } else {
      try {
        fileContent = await readFile(filePath, "utf8");
      } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        return [];
      }
    }

    // Try Tree-sitter parsing first for supported extensions
    if (extensions.includes(ext)) {
      try {
        const astBlocks = await this.parseWithTreeSitter(filePath, fileContent);
        if (astBlocks.length > 0) {
          return astBlocks;
        }
      } catch (error) {
        console.warn(`Tree-sitter parsing failed for ${filePath}, falling back to line-based parsing:`, error);
      }
    }

    // Fallback to line-based parsing
    return this.parseContent(filePath, fileContent);
  }

  /**
   * Checks if a language is supported
   * @param extension File extension
   * @returns Boolean indicating if the language is supported
   */
  private isSupportedLanguage(extension: string): boolean {
    return extension in EXTENSION_TO_LANGUAGE;
  }

  /**
   * Parses file content using Tree-sitter AST parsing
   * @param filePath Path to the file
   * @param content File content
   * @returns Array of code blocks extracted from AST
   */
  private async parseWithTreeSitter(filePath: string, content: string): Promise<CodeBlock[]> {
    const ext = path.extname(filePath).toLowerCase();
    const language = EXTENSION_TO_LANGUAGE[ext] || 'text';
    const extLang = ext.slice(1); // Remove the dot
    
    // Load the required language parser
    const languageParsers = await loadRequiredLanguageParsers([filePath]);
    const { parser, query } = languageParsers[extLang] || {};
    
    if (!parser || !query) {
      throw new Error(`No Tree-sitter parser available for ${ext}`);
    }

    // Parse the file content into an AST
    const tree = parser.parse(content);
    if (!tree) {
      throw new Error(`Failed to parse AST for ${filePath}`);
    }

    // Apply the query to get captures
    const captures = tree ? query.captures(tree.rootNode) : [];
    const lines = content.split('\n');
    const blocks: CodeBlock[] = [];

    // Process captures to create code blocks
    const processedRanges = new Set<string>();
    
    captures.forEach((capture) => {
      const { node, name } = capture;

      // Skip captures that don't represent definitions
      if (!name.includes("definition") && !name.includes("name")) {
        return;
      }

      // Get the definition node
      const definitionNode = name.includes("name") ? node.parent : node;
      if (!definitionNode) return;

      const startLine = definitionNode.startPosition.row;
      const endLine = definitionNode.endPosition.row;
      const lineCount = endLine - startLine + 1;

      // Skip small definitions
      if (lineCount < 3) {
        return;
      }

      // Create unique key for this range
      const rangeKey = `${startLine}-${endLine}`;
      if (processedRanges.has(rangeKey)) {
        return;
      }

      // Extract the content for this definition
      const blockLines = lines.slice(startLine, endLine + 1);
      const blockContent = blockLines.join('\n');

      if (blockContent.trim().length < MIN_BLOCK_CHARS) {
        return;
      }

      // Determine block type and name
      const blockType = this.inferBlockTypeFromCapture(capture, blockContent);
      const blockName = this.extractNameFromCapture(capture, blockContent);

      // Create code block
      const block = this.createCodeBlock(
        filePath,
        blockContent,
        language,
        startLine + 1, // Convert to 1-based line numbers
        endLine + 1,
        blockName
      );
      
      // Override the inferred type with AST-based type
      block.type = blockType;
      
      // Add Tree-sitter specific metadata
        if (!block.metadata) {
          block.metadata = {};
        }
        block.metadata.astNode = {
          type: capture.node.type,
          startPosition: { row: capture.node.startPosition.row, column: capture.node.startPosition.column },
          endPosition: { row: capture.node.endPosition.row, column: capture.node.endPosition.column },
        };
        block.metadata.captureType = capture.name;
        block.metadata.parsingMethod = 'tree-sitter';
      
      blocks.push(block);
      processedRanges.add(rangeKey);
    });

    return blocks;
  }

  /**
   * Infers block type from Tree-sitter capture
   * @param capture Tree-sitter capture
   * @param content Block content
   * @returns Block type
   */
  private inferBlockTypeFromCapture(capture: any, content: string): CodeBlock['type'] {
    const captureName = capture.name.toLowerCase();
    
    if (captureName.includes('function')) {
      return 'function';
    }
    if (captureName.includes('class')) {
      return 'class';
    }
    if (captureName.includes('interface')) {
      return 'interface';
    }
    if (captureName.includes('variable') || captureName.includes('const')) {
      return 'variable';
    }
    
    // Fallback to content-based inference
    return this.inferBlockType(content, '');
  }

  /**
   * Extracts name from Tree-sitter capture
   * @param capture Tree-sitter capture
   * @param content Block content
   * @returns Extracted name or undefined
   */
  private extractNameFromCapture(capture: any, content: string): string | undefined {
    const { node, name } = capture;
    
    // If this is a name capture, use the node text directly
    if (name.includes("name")) {
      return node.text;
    }
    
    // For definition captures, try to find the name from child nodes
    if (name.includes("definition")) {
      // Look for identifier nodes in the definition
      const identifiers = this.findIdentifierNodes(node);
      if (identifiers.length > 0) {
        return identifiers[0].text;
      }
    }
    
    // Fallback: extract from first line of content
    const firstLine = content.split('\n')[0].trim();
    const match = firstLine.match(/(?:function|class|interface|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    return match ? match[1] : undefined;
  }

  /**
   * Recursively finds identifier nodes in a Tree-sitter node
   * @param node Tree-sitter node
   * @returns Array of identifier nodes
   */
  private findIdentifierNodes(node: any): any[] {
    const identifiers: any[] = [];
    
    if (node.type === 'identifier' || node.type === 'type_identifier') {
      identifiers.push(node);
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        identifiers.push(...this.findIdentifierNodes(child));
      }
    }
    
    return identifiers;
  }

  /**
   * Parses file content into code blocks using simple line-based chunking
   * @param filePath Path to the file
   * @param content File content
   * @returns Array of code blocks
   */
  private parseContent(filePath: string, content: string): CodeBlock[] {
    const ext = path.extname(filePath).toLowerCase();
    const language = EXTENSION_TO_LANGUAGE[ext] || 'text';
    const lines = content.split('\n');
    
    if (ext === '.md' || ext === '.markdown') {
      return this.parseMarkdownContent(filePath, content, lines);
    }

    return this.chunkContentByLines(filePath, content, lines, language);
  }

  /**
   * Chunks content by lines to create manageable code blocks
   * @param filePath Path to the file
   * @param _content Full file content
   * @param lines Array of lines
   * @param language Programming language
   * @returns Array of code blocks
   */
  private chunkContentByLines(
    filePath: string, 
    _content: string, 
    lines: string[], 
    language: string
  ): CodeBlock[] {
    const blocks: CodeBlock[] = [];
    let currentChunk: string[] = [];
    let currentChunkChars = 0;
    let chunkStartLine = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineChars = line.length + 1; // +1 for newline

      // Check if adding this line would exceed the max block size
      if (currentChunkChars + lineChars > MAX_BLOCK_CHARS && currentChunk.length > 0) {
        // Create a block from current chunk
        const blockContent = currentChunk.join('\n');
        if (blockContent.trim().length >= MIN_BLOCK_CHARS) {
          blocks.push(this.createCodeBlock(
            filePath,
            blockContent,
            language,
            chunkStartLine,
            chunkStartLine + currentChunk.length - 1
          ));
        }

        // Start new chunk
        currentChunk = [line];
        currentChunkChars = lineChars;
        chunkStartLine = i + 1;
      } else {
        // Add line to current chunk
        currentChunk.push(line);
        currentChunkChars += lineChars;
      }
    }

    // Handle remaining chunk
    if (currentChunk.length > 0) {
      const blockContent = currentChunk.join('\n');
      if (blockContent.trim().length >= MIN_BLOCK_CHARS) {
        blocks.push(this.createCodeBlock(
          filePath,
          blockContent,
          language,
          chunkStartLine,
          chunkStartLine + currentChunk.length - 1
        ));
      }
    }

    return blocks;
  }

  /**
   * Parses markdown content into structured blocks
   * @param filePath Path to the file
   * @param _content Full file content
   * @param lines Array of lines
   * @returns Array of code blocks
   */
  private parseMarkdownContent(filePath: string, _content: string, lines: string[]): CodeBlock[] {
    const blocks: CodeBlock[] = [];
    let currentSection: string[] = [];
    let currentSectionStartLine = 1;
    let currentHeaderLevel = 0;
    let currentHeaderText = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headerMatch) {
        // Save previous section if it exists
        if (currentSection.length > 0) {
          const sectionContent = currentSection.join('\n');
          if (sectionContent.trim().length >= MIN_BLOCK_CHARS) {
            blocks.push(this.createCodeBlock(
              filePath,
              sectionContent,
              'markdown',
              currentSectionStartLine,
              i,
              currentHeaderText || `Section (level ${currentHeaderLevel})`
            ));
          }
        }

        // Start new section
        currentHeaderLevel = headerMatch[1].length;
        currentHeaderText = headerMatch[2];
        currentSection = [line];
        currentSectionStartLine = i + 1;
      } else {
        currentSection.push(line);
      }
    }

    // Handle last section
    if (currentSection.length > 0) {
      const sectionContent = currentSection.join('\n');
      if (sectionContent.trim().length >= MIN_BLOCK_CHARS) {
        blocks.push(this.createCodeBlock(
          filePath,
          sectionContent,
          'markdown',
          currentSectionStartLine,
          lines.length,
          currentHeaderText || `Section (level ${currentHeaderLevel})`
        ));
      }
    }

    return blocks;
  }

  /**
   * Creates a code block object
   * @param filePath Path to the file
   * @param content Block content
   * @param language Programming language
   * @param startLine Start line number
   * @param endLine End line number
   * @param name Optional name/identifier
   * @returns Code block object
   */
  private createCodeBlock(
    filePath: string,
    content: string,
    language: string,
    startLine: number,
    endLine: number,
    name?: string
  ): CodeBlock {
    const id = this.generateBlockId(filePath, startLine, endLine, content);
    
    const block: CodeBlock = {
      id,
      filePath,
      content: content.trim(),
      language,
      startLine,
      endLine,
      type: this.inferBlockType(content, language),
      metadata: {
        fileExtension: path.extname(filePath),
        lineCount: endLine - startLine + 1,
        charCount: content.length,
        parsingMethod: 'line-based'
      }
    };

    if (name) {
      block.name = name;
    }

    return block;
  }

  /**
   * Generates a unique ID for a code block
   * @param filePath Path to the file
   * @param startLine Start line number
   * @param endLine End line number
   * @param content Block content
   * @returns Unique block ID in UUID format
   */
  private generateBlockId(filePath: string, startLine: number, endLine: number, content: string): string {
    // Create a deterministic UUID based on the content hash
    const hash = createHash("sha256")
      .update(`${filePath}:${startLine}:${endLine}:${content}`)
      .digest("hex");
    
    // Format as UUID v4 (8-4-4-4-12 format)
    return [
      hash.substring(0, 8),
      hash.substring(8, 12),
      hash.substring(12, 16),
      hash.substring(16, 20),
      hash.substring(20, 32)
    ].join('-');
  }

  /**
   * Infers the type of code block based on content
   * @param content Block content
   * @param language Programming language
   * @returns Block type
   */
  private inferBlockType(content: string, _language: string): CodeBlock['type'] {
    const trimmedContent = content.trim().toLowerCase();
    
    // Check for common patterns
    if (trimmedContent.includes('function ') || trimmedContent.includes('def ') || 
        trimmedContent.includes('func ') || trimmedContent.match(/\w+\s*\(/)) {
      return 'function';
    }
    
    if (trimmedContent.includes('class ') || trimmedContent.includes('interface ') ||
        trimmedContent.includes('struct ')) {
      return 'class';
    }
    
    if (trimmedContent.includes('interface ')) {
      return 'interface';
    }
    
    if (trimmedContent.includes('var ') || trimmedContent.includes('let ') ||
        trimmedContent.includes('const ') || trimmedContent.includes('=')) {
      return 'variable';
    }
    
    if (trimmedContent.startsWith('//') || trimmedContent.startsWith('/*') ||
        trimmedContent.startsWith('#') || trimmedContent.startsWith('"""')) {
      return 'comment';
    }
    
    return 'other';
  }
}