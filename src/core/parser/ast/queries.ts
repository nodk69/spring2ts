import Parser, { Query, SyntaxNode } from 'tree-sitter';
import Java from 'tree-sitter-java';

// Singleton parser for queries
const parser = new Parser();
parser.setLanguage(Java);

/**
 * Pre-compiled Tree-sitter queries for performance
 */
export const Queries = {
  /** Extract all annotations from a node */
  ANNOTATIONS: new Query(Java, `
    (annotation
      name: (identifier) @name
      arguments: (annotation_argument_list)? @args) @annotation
  `),
  
  /** Extract marker annotations (no arguments) */
  MARKER_ANNOTATIONS: new Query(Java, `
    (marker_annotation
      name: (identifier) @name) @annotation
  `),
  
  /** Extract field declarations with their types */
  FIELDS: new Query(Java, `
    (field_declaration
      type: (_) @type
      declarator: (variable_declarator
        name: (identifier) @name)) @field
  `),
  
  /** Extract enum constants */
  ENUM_CONSTANTS: new Query(Java, `
    (enum_declaration
      name: (identifier) @enum_name
      body: (enum_body
        (enum_constant
          name: (identifier) @constant_name)) @body) @enum
  `),
  
  /** Extract class inheritance */
  INHERITANCE: new Query(Java, `
    (class_declaration
      name: (identifier) @class_name
      superclass: (superclass (type_identifier) @extends)?
      super_interfaces: (super_interfaces (type_identifier) @implements)) @class
  `),
  
  /** Extract all class declarations */
  CLASS_DECLARATIONS: new Query(Java, `
    (class_declaration
      name: (identifier) @class_name
      body: (class_body) @body) @class
  `),
  
  /** Extract generic type parameters */
  GENERIC_TYPE: new Query(Java, `
    (generic_type
      (type_identifier) @container
      (type_arguments
        (type_argument
          (_) @type_arg)) @args) @generic
  `)
};

/**
 * Execute a query and group captures by name
 */
export function queryCaptures(
  node: SyntaxNode, 
  query: Query
): Map<string, SyntaxNode[]> {
  const result = new Map<string, SyntaxNode[]>();
  const matches = query.matches(node);
  
  for (const match of matches) {
    for (const capture of match.captures) {
      const list = result.get(capture.name) || [];
      list.push(capture.node);
      result.set(capture.name, list);
    }
  }
  
  return result;
}

/**
 * Execute a query and return first match's captures
 */
export function queryFirst(
  node: SyntaxNode, 
  query: Query
): Map<string, SyntaxNode> | null {
  const matches = query.matches(node);
  if (matches.length === 0) return null;
  
  const result = new Map<string, SyntaxNode>();
  for (const capture of matches[0].captures) {
    result.set(capture.name, capture.node);
  }
  
  return result;
}

/**
 * Parse content and return root node
 */
export function parseContent(content: string): SyntaxNode {
  return parser.parse(content).rootNode;
}

/**
 * Get all matches for a query
 */
export function queryAll(
  node: SyntaxNode, 
  query: Query
): Array<Map<string, SyntaxNode>> {
  const matches = query.matches(node);
  return matches.map(match => {
    const result = new Map<string, SyntaxNode>();
    for (const capture of match.captures) {
      result.set(capture.name, capture.node);
    }
    return result;
  });
}