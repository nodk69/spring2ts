// src/core/parser/ast/extractors/record-extractor.ts
import { SyntaxNode } from 'tree-sitter';
import { DTOClass, DTOField } from '../../../../types/dto.types';
import { extractTypeText } from './type-extractor';
import { extractJacksonAnnotations } from '../annotations/jackson';
import { extractValidationAnnotations } from '../annotations/validation';
import { findFieldAnnotations, getAnnotationName } from '../annotations/core';

/**
 * Extract information from a record declaration node (Java 14+).
 * 
 * @example
 * public record UserRecord(
 *     @JsonProperty("user_id") Long id,      // Record component
 *     @NotNull String name,                  // With validation
 *     String email                           // Plain field
 * ) implements Serializable {}
 * 
 * @param node - The record_declaration AST node
 * @param packageName - Java package name
 * @param imports - Import statements from the file
 * @param filePath - Source file path
 * @param knownClasses - Set of known class names for type resolution
 */
export function extractRecord(
  node: SyntaxNode,
  packageName: string,
  imports: string[],
  filePath: string,
  knownClasses: Set<string>
): DTOClass | null {
  // Get record name
  const className = node.childForFieldName('name')?.text;
  if (!className) return null;
  
  // Extract record components (fields)
  const fields: DTOField[] = [];
  const params = node.childForFieldName('parameters');
  
  if (params) {
    for (const param of params.namedChildren) {
      // Only process formal_parameter nodes (skip commas, etc.)
      if (param.type === 'formal_parameter') {
        const field = extractRecordField(param, knownClasses);
        if (field) fields.push(field);
      }
    }
  }
  
  // Extract implemented interfaces
  const implementsList = extractImplementedInterfaces(node, knownClasses);
  
  return {
    className,
    packageName,
    fields,
    imports,
    extends: undefined,        // Records cannot extend classes
    implements: implementsList,
    isEnum: false,
    enumValues: undefined,
    filePath,
  };
}

/**
 * Extract a single field from a record parameter (component).
 * 
 * @param param - The formal_parameter node from the record declaration
 * @param knownClasses - Set of known class names for type resolution
 * @returns DTOField or null if field should be skipped (e.g., @JsonIgnore)
 */
function extractRecordField(
  param: SyntaxNode,
  knownClasses: Set<string>
): DTOField | null {
  // Get type and name nodes
  const typeNode = param.childForFieldName('type');
  const nameNode = param.childForFieldName('name');
  
  if (!typeNode || !nameNode) return null;
  
  const fieldName = nameNode.text;
  const javaType = typeNode.text;
  const tsType = extractTypeText(typeNode, knownClasses);
  
  // Skip serialVersionUID if present (unlikely in records but for consistency)
  if (fieldName === 'serialVersionUID') return null;
  
  // ✅ REUSE EXISTING EXTRACTORS - No duplication!
  const jackson = extractJacksonAnnotations(param);
  const validation = extractValidationAnnotations(param);
  
  // Skip if @JsonIgnore
  if (jackson.jsonIgnore) return null;
  
  // Use optimized field annotation finder for metadata
  const annotationNodes = findFieldAnnotations(param);
  const annotationNames = annotationNodes.map(getAnnotationName);
  
  // Determine nullability (required fields cannot be null)
  const nullable = !validation.hasNotNull;
  
  return {
    name: fieldName,
    javaType,
    tsType,
    nullable,
    isEnum: false,
    annotations: annotationNames,
    jsonName: jackson.jsonName,
    jsonAliases: jackson.jsonAliases,
    jsonIgnore: jackson.jsonIgnore,
    jacksonWarnings: jackson.warnings,
  };
}

/**
 * Extract implemented interfaces from a record declaration.
 * 
 * @example
 * record UserRecord(String name) implements Serializable, Comparable<UserRecord> {}
 * // Returns: ['Serializable', 'Comparable<UserRecord>']
 */
function extractImplementedInterfaces(
  node: SyntaxNode,
  knownClasses: Set<string>
): string[] {
  const interfaces: string[] = [];
  const superinterfaces = node.childForFieldName('super_interfaces');
  
  if (!superinterfaces) return interfaces;
  
  for (const child of superinterfaces.namedChildren) {
    if (child.type === 'type_identifier' || child.type === 'generic_type') {
      const typeName = extractTypeText(child, knownClasses);
      if (typeName) interfaces.push(typeName);
    }
  }
  
  return interfaces;
}

/**
 * Batch extract multiple records from a file.
 * Useful when processing a compilation unit with multiple records.
 */
export function extractRecords(
  nodes: SyntaxNode[],
  packageName: string,
  imports: string[],
  filePath: string,
  knownClasses: Set<string>
): DTOClass[] {
  const records: DTOClass[] = [];
  
  for (const node of nodes) {
    if (node.type === 'record_declaration') {
      const record = extractRecord(node, packageName, imports, filePath, knownClasses);
      if (record) records.push(record);
    }
  }
  
  return records;
}