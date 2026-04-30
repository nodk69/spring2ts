import { SyntaxNode } from 'tree-sitter';
import { DTOField } from '../../../../types/dto.types';
import { extractTypeText } from './type-extractor';
import { extractJacksonAnnotations } from '../annotations/jackson';
import { extractValidationAnnotations } from '../annotations/validation';
import { getPosition } from '../annotations/core';
import { logger } from '../../../../utils/logger';


export function extractFields(fieldNode: SyntaxNode, knownClasses: Set<string>): DTOField[] {
  const fields: DTOField[] = [];
  const fieldText = fieldNode.text;  // Full text with annotations!
  
  // Get type information
  const typeNode = fieldNode.childForFieldName('type');
  const javaType = typeNode?.text || 'unknown';
  const tsType = typeNode ? extractTypeText(typeNode, knownClasses) : 'unknown';
  
  // Extract annotations
  const jackson = extractJacksonAnnotations(fieldNode);
  const validation = extractValidationAnnotations(fieldNode);
  
  // FALLBACK: If AST extraction failed, use regex on raw text
  if (!jackson.jsonName && fieldText.includes('@JsonProperty')) {
    const match = fieldText.match(/@JsonProperty\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/);
    if (match) jackson.jsonName = match[1];
  }
  
  if (!jackson.jsonAliases && fieldText.includes('@JsonAlias')) {
    const aliasMatch = fieldText.match(/@JsonAlias\s*\(\s*\{?\s*["']([^"']+)["'](?:\s*,\s*["']([^"']+)["'])*\s*\}?\s*\)/);
    if (aliasMatch) {
      const aliases: string[] = [];
      const aliasRegex = /["']([^"']+)["']/g;
      let m;
      while ((m = aliasRegex.exec(aliasMatch[0])) !== null) {
        aliases.push(m[1]);
      }
      if (aliases.length > 0) jackson.jsonAliases = aliases;
    }
  }
  
  if (!validation.hasNotNull && (fieldText.includes('@NotNull') || fieldText.includes('@NonNull'))) {
    validation.hasNotNull = true;
  }
  
  if (!validation.hasNotEmpty && fieldText.includes('@NotEmpty')) {
    validation.hasNotEmpty = true;
    validation.hasNotNull = true;
  }
  
  if (!validation.hasNotBlank && fieldText.includes('@NotBlank')) {
    validation.hasNotBlank = true;
    validation.hasNotNull = true;
  }

  if (jackson.jsonIgnore || fieldText.includes('@JsonIgnore')) {
    const declarators = fieldNode.children.filter(
      n => n.type === 'variable_declarator'
    );

    for (const decl of declarators) {
      const fieldName = decl.childForFieldName('name')?.text;
      if (fieldName && fieldName !== 'serialVersionUID') {
        logger.debug(`Skipping @JsonIgnore field: ${fieldName}`);
      }
    }

    return fields;
  }
  
  // Determine nullability
  const nullable = !validation.hasNotNull;
  
  // Get position for error reporting
  const position = getPosition(fieldNode);
  
  // Process each declarator
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
