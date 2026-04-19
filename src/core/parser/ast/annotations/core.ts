import { SyntaxNode } from 'tree-sitter';

/**
 * Extract simple annotation name (no package)
 */
export function getAnnotationName(node: SyntaxNode): string {
  const nameNode = node.childForFieldName('name');
  if (nameNode) {
    const fullName = nameNode.text.replace(/^@/, '');
    return fullName.includes('.') ? fullName.split('.').pop()! : fullName;
  }
  return 'Unknown';
}

/**
 * Find all annotations on a node (recursive - use for general AST traversal)
 */
export function findAllAnnotations(node: SyntaxNode): SyntaxNode[] {
  const annotations: SyntaxNode[] = [];
  
  const traverse = (n: SyntaxNode) => {
    if (n.type === 'annotation' || n.type === 'marker_annotation') {
      annotations.push(n);
    }
    for (const child of n.children) {
      traverse(child);
    }
  };
  
  traverse(node);
  return annotations;
}

/**
 * Find annotations that belong to a field (optimized - checks siblings only)
 * Use this for field annotation extraction
 */
export function findFieldAnnotations(fieldNode: SyntaxNode): SyntaxNode[] {
  const annotations: SyntaxNode[] = [];
  const parent = fieldNode.parent;
  
  if (!parent) return annotations;
  
  // Find field's position among siblings
  const fieldIndex = parent.children.indexOf(fieldNode);
  
  // Look backwards for consecutive annotations
  for (let i = fieldIndex - 1; i >= 0; i--) {
    const sibling = parent.children[i];
    if (sibling.type === 'annotation' || sibling.type === 'marker_annotation') {
      annotations.unshift(sibling); // Preserve order
    } else if (sibling.type !== 'modifier') {
      break; // Stop at non-annotation, non-modifier
    }
  }
  
  return annotations;
}

/**
 * Get annotation by name (uses recursive search)
 */
export function findAnnotation(node: SyntaxNode, name: string): SyntaxNode | undefined {
  return findAllAnnotations(node).find(
    ann => getAnnotationName(ann) === name
  );
}

/**
 * Check if node has annotation (uses recursive search)
 */
export function hasAnnotation(node: SyntaxNode, name: string): boolean {
  return findAnnotation(node, name) !== undefined;
}

/**
 * Extract string value from annotation argument
 */
export function getStringValue(node: SyntaxNode, key?: string): string | undefined {
  const args = node.childForFieldName('arguments');
  if (!args) return undefined;
  
  for (const child of args.namedChildren) {
    // @Annotation("value")
    if (child.type === 'string_literal' && !key) {
      return unquote(child.text);
    }
    // @Annotation(key = "value")
    if (child.type === 'element_value_pair') {
      const k = child.childForFieldName('name')?.text;
      const v = child.childForFieldName('value');
      if (k === key && v?.type === 'string_literal') {
        return unquote(v.text);
      }
    }
    // Handle array initializer with single element: @Annotation({"value"})
    if (child.type === 'array_initializer' && !key) {
      const firstElement = child.namedChildren[0];
      if (firstElement?.type === 'string_literal') {
        return unquote(firstElement.text);
      }
    }
  }
  return undefined;
}

/**
 * Extract array of strings from annotation
 */
export function getStringArray(node: SyntaxNode): string[] {
  const args = node.childForFieldName('arguments');
  if (!args) return [];
  
  const values: string[] = [];
  const collect = (n: SyntaxNode) => {
    if (n.type === 'string_literal') {
      values.push(unquote(n.text));
    }
    // Handle array initializer: @Annotation({"a", "b"})
    if (n.type === 'array_initializer') {
      for (const child of n.namedChildren) {
        if (child.type === 'string_literal') {
          values.push(unquote(child.text));
        }
      }
    }
    for (const child of n.namedChildren) {
      collect(child);
    }
  };
  
  collect(args);
  return values;
}

/**
 * Extract numeric value from annotation
 */
export function getNumericValue(node: SyntaxNode, key?: string): number | undefined {
  const args = node.childForFieldName('arguments');
  if (!args) return undefined;
  
  for (const child of args.namedChildren) {
    // Direct number
    if ((child.type === 'decimal_integer_literal' || child.type === 'decimal_floating_point_literal') && !key) {
      return parseFloat(child.text);
    }
    // Key-value pair
    if (child.type === 'element_value_pair') {
      const k = child.childForFieldName('name')?.text;
      const v = child.childForFieldName('value');
      if (k === key && v) {
        if (v.type === 'decimal_integer_literal' || v.type === 'decimal_floating_point_literal') {
          return parseFloat(v.text);
        }
        if (v.type === 'string_literal') {
          const num = parseFloat(unquote(v.text));
          return isNaN(num) ? undefined : num;
        }
      }
    }
  }
  return undefined;
}

function unquote(s: string): string {
  // First remove surrounding quotes
  let result = s.replace(/^["']|["']$/g, '');
  
  // Then unescape in the correct order (backslash first!)
  result = result
    .replace(/\\\\/g, '\\')   // Unescape backslash FIRST
    .replace(/\\"/g, '"')     // Unescape double quote
    .replace(/\\'/g, "'")     // Unescape single quote
    .replace(/\\n/g, '\n')    // Unescape newline
    .replace(/\\r/g, '\r')    // Unescape carriage return
    .replace(/\\t/g, '\t')    // Unescape tab
    .replace(/\\f/g, '\f')    // Unescape form feed
    .replace(/\\b/g, '\b');   // Unescape backspace
    
  return result;
}

/**
 * Get source position from node (for error reporting)
 */
export function getPosition(node: SyntaxNode): {
  start: { line: number; column: number };
  end: { line: number; column: number };
} | undefined {
  if (!node.startPosition || !node.endPosition) return undefined;
  
  return {
    start: { 
      line: node.startPosition.row, 
      column: node.startPosition.column 
    },
    end: { 
      line: node.endPosition.row, 
      column: node.endPosition.column 
    }
  };
}