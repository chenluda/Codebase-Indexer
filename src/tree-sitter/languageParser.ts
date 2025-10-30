import * as path from "path"
import * as TreeSitter from "tree-sitter"
const Parser = require("tree-sitter")
import {
  javascriptQuery,
  typescriptQuery,
  tsxQuery,
  pythonQuery,
  rustQuery,
  goQuery,
  cppQuery,
  cQuery,
  csharpQuery,
  rubyQuery,
  javaQuery,
  phpQuery,
  htmlQuery,
  cssQuery,
} from "./queries"

export interface LanguageParser {
	[key: string]: {
		parser: TreeSitter
		query: TreeSitter.Query
	}
}

async function loadLanguage(langName: string) {
	try {
		// Map language names to their corresponding npm packages
		const languagePackageMap: { [key: string]: string } = {
			'javascript': 'tree-sitter-javascript',
			'typescript': 'tree-sitter-typescript',
			'tsx': 'tree-sitter-typescript',
			'python': 'tree-sitter-python',
			'rust': 'tree-sitter-rust',
			'go': 'tree-sitter-go',
			'cpp': 'tree-sitter-cpp',
			'c': 'tree-sitter-c',
			'c_sharp': 'tree-sitter-c-sharp',
			'ruby': 'tree-sitter-ruby',
			'java': 'tree-sitter-java',
			'php': 'tree-sitter-php',
			'css': 'tree-sitter-css',
			'html': 'tree-sitter-html'
		}

		const packageName = languagePackageMap[langName]
		if (!packageName) {
			throw new Error(`No package mapping found for language: ${langName}`)
		}

		// Load the language from the npm package
		// For Node.js tree-sitter, we use the module directly
		if (langName === 'typescript') {
			const languageModule = require('tree-sitter-typescript')
			return languageModule.typescript
		} else if (langName === 'tsx') {
			const languageModule = require('tree-sitter-typescript')
			return languageModule.tsx
		} else {
			// For other languages, use the module directly
			const languageModule = require(packageName)
			return languageModule
		}
	} catch (error) {
		console.error(`Error loading language ${langName}: ${error instanceof Error ? error.message : error}`)
		throw error
	}
}



/*
This function loads tree-sitter language parsers from their respective npm packages
based on input files:
1. Extracts unique file extensions
2. Maps extensions to language names
3. Loads corresponding language parsers from npm packages
4. Initializes tree-sitter parsers with the loaded languages

We use individual tree-sitter language packages (e.g., tree-sitter-javascript, 
tree-sitter-python) and some packages from @tree-sitter-grammars organization
for languages that are maintained there.

This approach optimizes performance by loading only necessary parsers once for all relevant files.

Sources:
- https://github.com/tree-sitter/tree-sitter
- https://github.com/tree-sitter-grammars
*/
export async function loadRequiredLanguageParsers(filesToParse: string[]) {
	const extensionsToLoad = new Set(filesToParse.map((file) => path.extname(file).toLowerCase().slice(1)))
	const parsers: LanguageParser = {}

	for (const ext of extensionsToLoad) {
		let language: any
		let query: TreeSitter.Query
		let parserKey = ext // Default to using extension as key

		switch (ext) {
			case "js":
			case "jsx":
				language = await loadLanguage("javascript")
				query = new Parser.Query(language, javascriptQuery)
				break
			case "ts":
				language = await loadLanguage("typescript")
				query = new Parser.Query(language, typescriptQuery)
				break
			case "tsx":
				language = await loadLanguage("tsx")
				query = new Parser.Query(language, tsxQuery)
				break
			case "py":
				language = await loadLanguage("python")
				query = new Parser.Query(language, pythonQuery)
				break
			case "rs":
				language = await loadLanguage("rust")
				query = new Parser.Query(language, rustQuery)
				break
			case "go":
				language = await loadLanguage("go")
				query = new Parser.Query(language, goQuery)
				break
			case "cpp":
			case "hpp":
				language = await loadLanguage("cpp")
				query = new Parser.Query(language, cppQuery)
				break
			case "c":
			case "h":
				language = await loadLanguage("c")
				query = new Parser.Query(language, cQuery)
				break
			case "cs":
				language = await loadLanguage("c_sharp")
				query = new Parser.Query(language, csharpQuery)
				break
			case "rb":
				language = await loadLanguage("ruby")
				query = new Parser.Query(language, rubyQuery)
				break
			case "java":
				language = await loadLanguage("java")
				query = new Parser.Query(language, javaQuery)
				break
			case "php":
				language = await loadLanguage("php")
				query = new Parser.Query(language, phpQuery)
				break
			case "css":
				language = await loadLanguage("css")
				query = new Parser.Query(language, cssQuery)
				break
			case "html":
				language = await loadLanguage("html")
				query = new Parser.Query(language, htmlQuery)
				break
			default:
				throw new Error(`Unsupported language: ${ext}`)
		}

		const parser = new Parser()
		parser.setLanguage(language)
		parsers[parserKey] = { parser, query }
	}

	return parsers
}