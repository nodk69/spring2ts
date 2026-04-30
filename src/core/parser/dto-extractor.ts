import { DTOClass, DTOField } from '../../types/dto.types';
import { extractJsonAlias, extractJsonPropertyName, extractAnnotations, extractEnumValues } from './annotation-parser';
export { resolveInheritance } from './resolve-inheritance';

export function extractPackageName(content: string): string {
  const match = content.match(/package\s+([a-zA-Z0-9_.]+)\s*;/);
  return match ? match[1] : '';
}

export function extractImports(content: string): string[] {
  const matches = content.matchAll(/import\s+(?:static\s+)?([a-zA-Z0-9_.*]+)\s*;/g);
  return Array.from(matches, ([, value]) => value);
}

export function extractClassName(content: string): string {
  const match = content.match(/\b(?:class|interface|enum|record)\s+([A-Za-z_][A-Za-z0-9_]*)/);
  return match ? match[1] : '';
}

export function extractExtends(content: string): string | undefined {
  const match = content.match(/\bextends\s+([A-Za-z_][A-Za-z0-9_]*)/);
  return match ? match[1] : undefined;
}

export function extractImplements(content: string): string[] {
  const match = content.match(/\bimplements\s+([^{]+)/);
  if (!match) {
    return [];
  }

  return match[1]
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isEnum(content: string): boolean {
  return /\benum\b/.test(content);
}

export function extractFields(content: string, knownClasses: Set<string>): DTOField[] {
  const bodyMatch = content.match(/\{([\s\S]*)\}/);
  const body = bodyMatch ? bodyMatch[1] : content;
  const fields: DTOField[] = [];
  const fieldPattern =
    /((?:@\w+(?:\([^)]*\))?\s*)*)(?:private|protected|public)\s+([^;=]+?)\s+([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*)\s*(?:=[^;]+)?;/gs;

  for (const match of body.matchAll(fieldPattern)) {
    const annotationBlock = match[1] ?? '';
    const javaType = match[2].trim();
    const names = match[3].split(',').map((value) => value.trim());

    if (/\bserialVersionUID\b/.test(match[0]) || /\bstatic\b/.test(javaType) || /\btransient\b/.test(javaType)) {
      continue;
    }

    const cleanedJavaType = javaType.replace(/\bfinal\b/g, '').trim();
    const annotations = extractAnnotations(annotationBlock);
    const jsonName = extractJsonPropertyName(annotationBlock) ?? undefined;
    const jsonAliases = extractJsonAlias(annotationBlock);

    for (const name of names) {
      const tsType = mapLegacyJavaTypeToTS(cleanedJavaType, knownClasses);
      fields.push({
        name,
        javaType: cleanedJavaType,
        tsType,
        nullable: !annotations.some((annotation) => ['NotNull', 'NotBlank', 'NotEmpty'].includes(annotation)),
        isEnum: false,
        annotations,
        jsonName,
        jsonAliases: jsonAliases.length > 0 ? jsonAliases : undefined,
      });
    }
  }

  return fields;
}

export function extractDTOFromContent(content: string, filePath: string, knownClasses: Set<string>): DTOClass | null {
  const className = extractClassName(content);
  if (!className) {
    return null;
  }

  const enumDto = isEnum(content);

  return {
    className,
    packageName: extractPackageName(content),
    fields: enumDto ? [] : extractFields(content, knownClasses),
    imports: extractImports(content),
    extends: extractExtends(content),
    implements: extractImplements(content),
    isEnum: enumDto,
    enumValues: enumDto ? extractEnumValues(extractEnumBody(content)) : undefined,
    filePath,
  };
}

function extractEnumBody(content: string): string {
  const match = content.match(/\{([\s\S]*)\}/);
  return match ? match[1].trim() : '';
}

function mapLegacyJavaTypeToTS(javaType: string, knownClasses: Set<string>): string {
  const trimmed = javaType.trim();

  if (trimmed.endsWith('[]')) {
    return `${mapLegacyJavaTypeToTS(trimmed.slice(0, -2), knownClasses)}[]`;
  }

  const genericMatch = trimmed.match(/^([A-Za-z0-9_.]+)<(.+)>$/);
  if (genericMatch) {
    const [, container, args] = genericMatch;
    const argList = splitGenericArgs(args).map((value) => mapLegacyJavaTypeToTS(value, knownClasses));
    const containerName = container.split('.').pop() ?? container;

    if (['List', 'Set', 'Collection', 'Iterable', 'ArrayList'].includes(containerName)) {
      return `${argList[0] ?? 'unknown'}[]`;
    }
    if (['Map', 'HashMap'].includes(containerName)) {
      return `Record<${argList[0] ?? 'string'}, ${argList[1] ?? 'unknown'}>`;
    }

    return `${containerName}<${argList.join(', ')}>`;
  }

  const simpleName = trimmed.split('.').pop() ?? trimmed;
  const mappedTypes: Record<string, string> = {
    String: 'string',
    Integer: 'number',
    int: 'number',
    Long: 'number',
    long: 'number',
    Boolean: 'boolean',
    boolean: 'boolean',
    Double: 'number',
    double: 'number',
    Float: 'number',
    float: 'number',
  };

  if (simpleName in mappedTypes) {
    return mappedTypes[simpleName];
  }

  return knownClasses.has(simpleName) ? simpleName : simpleName;
}

function splitGenericArgs(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (const char of value) {
    if (char === '<') {
      depth++;
    } else if (char === '>') {
      depth--;
    } else if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}
