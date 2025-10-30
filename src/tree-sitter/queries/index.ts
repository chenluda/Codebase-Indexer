// Tree-sitter query patterns for different languages
// These queries extract code definitions and structures

export const javascriptQuery = `
(
  (comment)* @doc
  .
  (method_definition
    name: (property_identifier) @name) @definition.method
  (#not-eq? @name "constructor")
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.method)
)

(
  (comment)* @doc
  .
  [
    (class
      name: (_) @name)
    (class_declaration
      name: (_) @name)
  ] @definition.class
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.class)
)

(
  (comment)* @doc
  .
  [
    (function_declaration
      name: (identifier) @name)
    (generator_function_declaration
      name: (identifier) @name)
  ] @definition.function
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.function)
)

(
  (comment)* @doc
  .
  (lexical_declaration
    (variable_declarator
      name: (identifier) @name
      value: [(arrow_function) (function_expression)]) @definition.function)
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.function)
)

(
  (comment)* @doc
  .
  (variable_declaration
    (variable_declarator
      name: (identifier) @name
      value: [(arrow_function) (function_expression)]) @definition.function)
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.function)
)
`

export const typescriptQuery = `
(function_declaration
  name: (identifier) @name) @definition.function

(method_definition
  name: (property_identifier) @name) @definition.method

(class_declaration
  name: (type_identifier) @name) @definition.class

(interface_declaration
  name: (type_identifier) @name) @definition.interface

(type_alias_declaration
  name: (type_identifier) @name) @definition.type

(variable_declarator
  name: (identifier) @name) @definition.variable
`

export const pythonQuery = `
(function_definition
  name: (identifier) @name) @definition.function

(class_definition
  name: (identifier) @name) @definition.class

(assignment
  left: (identifier) @name) @definition.variable
`

export const rustQuery = `
(function_item
  name: (identifier) @name) @definition.function

(struct_item
  name: (type_identifier) @name) @definition.struct

(enum_item
  name: (type_identifier) @name) @definition.enum

(impl_item
  type: (type_identifier) @name) @definition.impl
`

export const goQuery = `
(function_declaration
  name: (identifier) @name) @definition.function

(method_declaration
  name: (field_identifier) @name) @definition.method

(type_declaration
  (type_spec
    name: (type_identifier) @name)) @definition.type
`

// Export all other queries as placeholders for now
export const tsxQuery = typescriptQuery
export const cppQuery = javascriptQuery
export const cQuery = javascriptQuery
export const csharpQuery = javascriptQuery
export const rubyQuery = javascriptQuery
export const javaQuery = javascriptQuery
export const phpQuery = javascriptQuery
export const htmlQuery = javascriptQuery
export const swiftQuery = javascriptQuery
export const kotlinQuery = javascriptQuery
export const cssQuery = javascriptQuery
export const ocamlQuery = javascriptQuery
export const solidityQuery = javascriptQuery
export const tomlQuery = javascriptQuery
export const vueQuery = javascriptQuery
export const luaQuery = javascriptQuery
export const systemrdlQuery = javascriptQuery
export const tlaPlusQuery = javascriptQuery
export const zigQuery = javascriptQuery
export const embeddedTemplateQuery = javascriptQuery
export const elispQuery = javascriptQuery
export const elixirQuery = javascriptQuery
export const scalaQuery = javascriptQuery