import { SyntaxNode } from 'tree-sitter';
import { mapJavaTypeToTS } from '../../type-mapper';

/**
 * Recursively extract and map a Java type to its TypeScript equivalent.
 */
export function extractTypeText(node: SyntaxNode, knownClasses: Set<string>): string {
  if (!node) return 'unknown';

  // Array types
  if (node.type === 'array_type') {
    const elem = node.childForFieldName('element');
    const dims = (node.text.match(/\[\]/g) || []).length;
    const baseType = extractTypeText(elem!, knownClasses);
    return `${baseType}${'[]'.repeat(dims)}`;
  }

  // Generic types (List<T>, Map<K,V>, Optional<T>)
  if (node.type === 'generic_type') {
    const containerNode = node.childForFieldName('type');
    const container = containerNode?.text || '';
    const typeArgs = node.childForFieldName('type_arguments');
    
    if (typeArgs) {
      const args = typeArgs.namedChildren
        .filter((c: SyntaxNode) => 
          c.type !== '<' && c.type !== '>' && c.type !== ','
        )
        .map(c => extractTypeText(c, knownClasses));
      
      const javaType = `${container}<${args.join(', ')}>`;
      return mapJavaTypeToTS(javaType, knownClasses);
    }
    
    return mapJavaTypeToTS(container, knownClasses);
  }

  // Simple identifiers
  if (node.type === 'type_identifier' || node.type === 'scoped_type_identifier') {
    return mapJavaTypeToTS(node.text, knownClasses);
  }
  
  // Wildcard types (? extends T)
  if (node.type === 'wildcard') {
    const bound = node.childForFieldName('bound');
    if (bound) {
      return 'unknown';
    }
    return 'unknown';
  }

  return mapJavaTypeToTS(node.text || 'unknown', knownClasses);
}