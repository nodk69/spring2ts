import { SyntaxNode } from 'tree-sitter';
import { DTOField } from '../../../../types/dto.types';
import { extractTypeText } from './type-extractor';
import { extractJacksonAnnotations } from '../annotations/jackson';
import { extractValidationAnnotations } from '../annotations/validation';
import { getPosition } from '../annotations/core';


export function extractFields(
  fieldNode: SyntaxNode,
  knownClasses: Set<string>
): DTOField[] {
  const fields: DTOField[] = [];
  
  // Get type information
  const typeNode = fieldNode.childForFieldName('type');
  const javaType = typeNode?.text || 'unknown';
  const tsType = typeNode ? extractTypeText(typeNode, knownClasses) : 'unknown';
  
  // Extract annotations
  const jackson = extractJacksonAnnotations(fieldNode);
  const validation = extractValidationAnnotations(fieldNode);
  
  // Skip if @JsonIgnore
  if (jackson.jsonIgnore) {
    return fields;
  }
  
  // Determine nullability
  const nullable = !validation.hasNotNull;
  
  // Get position for error reporting
  const position = getPosition(fieldNode);

  //  // Collect annotation names for metadata
  // const allAnnotationNames = findFieldAnnotations(fieldNode)
  //   .map(getAnnotationName);
  
  // Process each declarator (handles `private String a, b;`)
  const declarators = fieldNode.children.filter(
    n => n.type === 'variable_declarator'
  );
  
  for (const decl of declarators) {
    const nameNode = decl.childForFieldName('name');
    const fieldName = nameNode?.text;
    
    if (!fieldName || fieldName === 'serialVersionUID') continue;
    
    fields.push({
      name: fieldName,
      javaType,
      tsType,
      nullable,
      isEnum: false,
      annotations: [],
      jsonName: jackson.jsonName,
      jsonAliases: jackson.jsonAliases,
      jsonIgnore: jackson.jsonIgnore,
      jacksonWarnings: jackson.warnings,
      position
    } as DTOField);
  }
  
  return fields;
}