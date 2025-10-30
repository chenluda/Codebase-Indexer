import * as fs from "fs/promises"
import * as path from "path"
import { LanguageParser, loadRequiredLanguageParsers } from "./languageParser"
import * as TreeSitter from "tree-sitter"

// Private constant
const DEFAULT_MIN_COMPONENT_LINES_VALUE = 4

// Getter function for MIN_COMPONENT_LINES (for easier testing)
let currentMinComponentLines = DEFAULT_MIN_COMPONENT_LINES_VALUE

/**
 * Get the current minimum number of lines for a component to be included
 */
export function getMinComponentLines(): number {
	return currentMinComponentLines
}

/**
 * Set the minimum number of lines for a component (for testing)
 */
export function setMinComponentLines(value: number): void {
	currentMinComponentLines = value
}

const extensions = [
	"js",
	"jsx",
	"ts",
	"tsx",
	"py",
	"rs",
	"go",
	"c",
	"h",
	"cpp",
	"hpp",
	"cs",
	"rb",
	"java",
	"php",
	"swift",
	"sol",
	"kt",
	"kts",
	"ex",
	"exs",
	"html",
	"htm",
	"css",
	"ml",
	"mli",
	"lua",
	"scala",
	"toml",
	"zig",
].map((e) => `.${e}`)

export { extensions }

/**
 * Parse a file and extract code definitions using tree-sitter
 *
 * @param filePath - Path to the file to parse
 * @returns A formatted string with code definitions or null if no definitions found
 */
export async function parseSourceCodeDefinitionsForFile(
	filePath: string,
): Promise<string | undefined> {
	// check if the file exists
	const fileExists = await fs.access(filePath).then(() => true).catch(() => false)
	if (!fileExists) {
		return "This file does not exist or you do not have permission to access it."
	}

	// Get file extension to determine parser
	const ext = path.extname(filePath).toLowerCase()
	// Check if the file extension is supported
	if (!extensions.includes(ext)) {
		return undefined
	}

	// For supported file types, load parser and use tree-sitter
	const languageParsers = await loadRequiredLanguageParsers([filePath])

	// Parse the file if we have a parser for it
	const definitions = await parseFile(filePath, languageParsers)
	if (definitions) {
		return `# ${path.basename(filePath)}\n${definitions}`
	}

	return undefined
}

/**
 * Process captures from tree-sitter parser
 *
 * @param captures - The captures to process
 * @param lines - The lines of the file
 * @param language - The programming language
 * @returns A formatted string with definitions
 */
function processCaptures(captures: TreeSitter.QueryCapture[], lines: string[], _language: string): string | null {
	// No definitions found
	if (captures.length === 0) {
		return null
	}

	let formattedOutput = ""

	// Sort captures by their start position
	captures.sort((a, b) => a.node.startPosition.row - b.node.startPosition.row)

	// Track already processed lines to avoid duplicates
	const processedLines = new Set<string>()

	// Process captures
	captures.forEach((capture) => {
		const { node, name } = capture

		// Skip captures that don't represent definitions
		if (!name.includes("definition") && !name.includes("name")) {
			return
		}

		// Get the parent node that contains the full definition
		const definitionNode = name.includes("name") ? node.parent : node
		if (!definitionNode) return

		// Get the start and end lines of the full definition
		const startLine = definitionNode.startPosition.row
		const endLine = definitionNode.endPosition.row
		const lineCount = endLine - startLine + 1

		// Skip components that don't span enough lines
		if (lineCount < getMinComponentLines()) {
			return
		}

		// Create unique key for this definition based on line range
		const lineKey = `${startLine}-${endLine}`

		// Skip already processed lines
		if (processedLines.has(lineKey)) {
			return
		}

		// Add definition to output
		formattedOutput += `${startLine + 1}--${endLine + 1} | ${lines[startLine]}\n`
		processedLines.add(lineKey)
	})

	if (formattedOutput.length > 0) {
		return formattedOutput
	}

	return null
}

/**
 * Parse a file and extract code definitions using tree-sitter
 *
 * @param filePath - Path to the file to parse
 * @param languageParsers - Map of language parsers
 * @returns A formatted string with code definitions or null if no definitions found
 */
async function parseFile(
	filePath: string,
	languageParsers: LanguageParser,
): Promise<string | null> {
	// Read file content
	const fileContent = await fs.readFile(filePath, "utf8")
	const extLang = path.extname(filePath).toLowerCase().slice(1)

	// Check if we have a parser for this file type
	const { parser, query } = languageParsers[extLang] || {}
	if (!parser || !query) {
		return `Unsupported file type: ${filePath}`
	}

	try {
		// Parse the file content into an Abstract Syntax Tree (AST)
		const tree = parser.parse(fileContent)

		// Apply the query to the AST and get the captures
		const captures = tree ? query.captures(tree.rootNode) : []

		// Split the file content into individual lines
		const lines = fileContent.split("\n")

		// Process the captures
		return processCaptures(captures, lines, extLang)
	} catch (error) {
		console.log(`Error parsing file: ${error}\n`)
		// Return null on parsing error to avoid showing error messages in the output
		return null
	}
}