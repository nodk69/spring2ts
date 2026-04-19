import { SyntaxNode } from 'tree-sitter';
import { getAnnotationName, getStringValue, getStringArray, getPosition } from './core';

export interface JacksonData {
  jsonName?: string;
  jsonAliases?: string[];
  jsonIgnore: boolean;
  jsonInclude?: string;
  warnings: string[];
}

/**
 * Optimized - only checks immediate children, not full traversal
 * Since annotations are always direct siblings/predecessors of fields
 */
export function extractJacksonAnnotations(fieldNode: SyntaxNode): JacksonData {
  const result: JacksonData = { jsonIgnore: false, warnings: [] };
  
  // Annotations are always siblings, not children of the field node
  // Check the parent node's children that come before the field
  const parent = fieldNode.parent;
  if (!parent) return result;
  
  // Find annotations that target this field
  const fieldIndex = parent.children.indexOf(fieldNode);
  for (let i = fieldIndex - 1; i >= 0; i--) {
    const sibling = parent.children[i];
    if (sibling.type !== 'annotation' && sibling.type !== 'marker_annotation') {
      break; // Annotations are consecutive, stop when we hit non-annotation
    }
    
    const name = getAnnotationName(sibling);
    
    switch (name) {
      case 'JsonProperty':
        result.jsonName = getStringValue(sibling) || getStringValue(sibling, 'value');
        break;
        
      case 'JsonAlias':
        result.jsonAliases = getStringArray(sibling);
        break;
        
      case 'JsonIgnore':
        result.jsonIgnore = true;
        break;
        
      case 'JsonInclude':
        result.jsonInclude = getStringValue(sibling);
        break;
        
      case 'JsonSerialize':
        result.warnings.push('@JsonSerialize: custom serializer may affect TypeScript type');
        break;
        
      case 'JsonDeserialize':
        result.warnings.push('@JsonDeserialize: custom deserializer detected');
        break;
        
      case 'JsonFormat':
        result.warnings.push('@JsonFormat: serialization format may differ from default');
        break;
        
      case 'JsonUnwrapped':
        result.warnings.push('@JsonUnwrapped: fields will be flattened in JSON');
        break;
        
      case 'JsonTypeInfo':
        result.warnings.push('@JsonTypeInfo: polymorphic type handling detected');
        break;
    }
  }
  
  return result;
}

/**
 * Batch process many fields for better performance
 * Use this when processing entire classes
 */
export function batchExtractJacksonAnnotations(fieldNodes: SyntaxNode[]): Map<SyntaxNode, JacksonData> {
  const results = new Map<SyntaxNode, JacksonData>();
  
  for (const field of fieldNodes) {
    results.set(field, extractJacksonAnnotations(field));
  }
  
  return results;
}