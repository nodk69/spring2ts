import { DTOClass, DTOField } from '../../types/dto.types';
import { 
  extractAnnotations, 
  extractEnumValues, 
  extractJsonPropertyName,
  extractJsonAlias 
} from './annotation-parser';
import { mapJavaTypeToTS, isNullable } from './type-mapper';

export function extractPackageName(content: string): string {
  const packageMatch = content.match(/package\s+([\w.]+)\s*;/);
  return packageMatch ? packageMatch[1] : '';
}

export function extractImports(content: string): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+([\w.*]+)\s*;/g;
  
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  return imports;
}

export function extractClassName(content: string): string {
  const classMatch = content.match(/(?:public\s+)?(?:class|interface|enum|record)\s+(\w+)/);
  return classMatch ? classMatch[1] : '';
}

export function extractExtends(content: string): string | undefined {
  const extendsMatch = content.match(/extends\s+(\w+)/);
  return extendsMatch ? extendsMatch[1] : undefined;
}

export function extractImplements(content: string): string[] {
  const implementsMatch = content.match(/implements\s+([^{]+)/);
  if (!implementsMatch) return [];
  
  return implementsMatch[1]
    .split(',')
    .map(i => i.trim())
    .filter(i => i.length > 0);
}

export function isEnum(content: string): boolean {
  return /\benum\s+\w+/.test(content);
}

export function extractFields(content: string, knownClasses: Set<string>): DTOField[] {
  const fields: DTOField[] = [];
  
  // Remove block comments
  let cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove line comments that are alone on their line
  cleanContent = cleanContent.replace(/^\s*\/\/.*$/gm, '');
  
  // Match fields with optional annotations on previous lines
  // This pattern captures the annotations and the field declaration
  const fieldPattern = /((?:@[^\n]+\n\s*)*)(?:private|protected|public)\s+(?:static\s+)?(?:final\s+)?(\w+(?:<[^>]+>)?(?:\[\])?)\s+(\w+)\s*[=;]/g;
  
  let match;
  while ((match = fieldPattern.exec(cleanContent)) !== null) {
    const annotationBlock = match[1] || '';
    const fullMatch = match[0];
    const javaType = match[2];
    const fieldName = match[3];
    
    // Skip serialVersionUID
    if (fieldName === 'serialVersionUID') continue;
    
    // Combine annotations with field for parsing
    const fieldCode = annotationBlock + fullMatch;
    
    const annotations = extractAnnotations(fieldCode);
    const tsType = mapJavaTypeToTS(javaType, knownClasses);
    const nullable = isNullable(annotations, javaType);
    
    // Extract JSON property name and aliases
    const jsonName = extractJsonPropertyName(fieldCode);
    const jsonAliases = extractJsonAlias(fieldCode);
    
    fields.push({
      name: fieldName,
      jsonName: jsonName || undefined,
      jsonAliases: jsonAliases.length > 0 ? jsonAliases : undefined,
      javaType,
      tsType,
      nullable,
      isEnum: false,
      annotations,
    });
  }
  
  return fields;
}

export function extractDTOFromContent(
  content: string, 
  filePath: string, 
  knownClasses: Set<string>
): DTOClass | null {
  const className = extractClassName(content);
  if (!className) return null;
  
  const isEnumClass = isEnum(content);
  
  const dto: DTOClass = {
    className,
    packageName: extractPackageName(content),
    fields: [],
    imports: extractImports(content),
    extends: extractExtends(content),
    implements: extractImplements(content),
    isEnum: isEnumClass,
    filePath,
  };
  
  if (isEnumClass) {
    const enumBodyMatch = content.match(/\{([\s\S]*)\}/);
    if (enumBodyMatch) {
      dto.enumValues = extractEnumValues(enumBodyMatch[1]);
    }
  } else {
    dto.fields = extractFields(content, knownClasses);
  }
  
  return dto;
}

export function resolveInheritance(dtos: DTOClass[]): DTOClass[] {
  const dtoMap = new Map(dtos.map(d => [d.className, d]));
  
  for (const dto of dtos) {
    if (dto.extends && dtoMap.has(dto.extends)) {
      const parent = dtoMap.get(dto.extends)!;
      dto.parentFields = parent.fields;
    }
  }
  
  return dtos;
}