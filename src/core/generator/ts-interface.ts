import { DTOClass, DTOField } from '../../types/dto.types';

const RESERVED_WORDS = new Set([
  'abstract', 'any', 'as', 'asserts', 'async', 'await',
  'bigint', 'boolean', 'break', 'case', 'catch', 'class', 'const',
  'constructor', 'continue', 'debugger', 'declare', 'default', 'delete',
  'do', 'else', 'enum', 'export', 'exports', 'extends', 'false',
  'finally', 'for', 'from', 'function', 'get', 'global', 'goto', 'if',
  'implements', 'import', 'in', 'infer', 'instanceof', 'interface',
  'intrinsic', 'is', 'keyof', 'let', 'module', 'namespace', 'native',
  'never', 'new', 'null', 'number', 'object', 'of', 'opens', 'out',
  'override', 'package', 'permits', 'private', 'protected', 'public',
  'readonly', 'record', 'require', 'requires', 'return', 'sealed', 'set',
  'static', 'string', 'super', 'switch', 'symbol', 'synchronized', 'this',
  'throw', 'to', 'transient', 'true', 'try', 'type', 'types', 'typeof',
  'undefined', 'unique', 'unknown', 'using', 'var', 'void', 'volatile',
  'while', 'with', 'yield', 'final',
]);

export interface GenerationContext {
  classNames: Set<string>;
  enumNames: Set<string>;
  dependencyGraph: Map<string, Set<string>>;
}

function formatPropertyName(propertyName: string): string {
  if (RESERVED_WORDS.has(propertyName)) {
    return `'${propertyName}'`;
  }

  const validIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
  if (!validIdentifier.test(propertyName)) {
    return `'${propertyName}'`;
  }

  return propertyName;
}

function buildDependencyGraph(classes: DTOClass[]): Map<string, Set<string>> {
  return createGenerationContext(classes).dependencyGraph;
}

function hasCircularDependency(
  graph: Map<string, Set<string>>,
  classA: string,
  classB: string
): boolean {
  const depsA = graph.get(classA);
  const depsB = graph.get(classB);

  if (!depsA || !depsB) return false;

  return depsA.has(classB) && depsB.has(classA);
}

export function createGenerationContext(allClasses: DTOClass[]): GenerationContext {
  const classNames = new Set(allClasses.map((dto) => dto.className));
  const enumNames = new Set(
    allClasses.filter((dto) => dto.isEnum).map((dto) => dto.className)
  );

  return {
    classNames,
    enumNames,
    dependencyGraph: buildDependencyGraphInternal(allClasses, classNames, enumNames),
  };
}

export function generateInterface(
  dto: DTOClass,
  allClasses: DTOClass[],
  context: GenerationContext = createGenerationContext(allClasses)
): string {
  const lines: string[] = [];
  const referencedTypes = new Set<string>();
  const localTypeParameters = new Set(dto.typeParameters || []);

  if (dto.extends) {
    for (const referencedType of extractReferencedDtoNames(
      dto.extends,
      context.classNames,
      localTypeParameters
    )) {
      referencedTypes.add(referencedType);
    }
  }

  for (const field of dto.fields) {
    const resolvedFieldType = resolveFieldType(field, context.enumNames);

    for (const referencedType of extractReferencedDtoNames(
      resolvedFieldType,
      context.classNames,
      localTypeParameters
    )) {
      if (referencedType !== dto.className) {
        referencedTypes.add(referencedType);
      }
    }
  }

  if (referencedTypes.size > 0) {
    const imports = Array.from(referencedTypes).sort();
    for (const imp of imports) {
      if (hasCircularDependency(context.dependencyGraph, dto.className, imp)) {
        lines.push(`import type { ${imp} } from './${imp}';`);
      } else {
        lines.push(`import { ${imp} } from './${imp}';`);
      }
    }
    lines.push('');
  }

  const genericSuffix =
    dto.typeParameters && dto.typeParameters.length > 0
      ? `<${dto.typeParameters.join(', ')}>`
      : '';
  const extendsClause = dto.extends ? ` extends ${dto.extends}` : '';
  lines.push(`export interface ${dto.className}${genericSuffix}${extendsClause} {`);

  const parentFieldNames = new Set(dto.parentFields?.map((f) => f.jsonName || f.name) || []);
  const processedFields = new Set<string>();

  for (const field of dto.fields) {
    if (field.jsonIgnore) {
      continue;
    }

    const rawPropertyName = field.jsonName || field.name;

    if (parentFieldNames.has(rawPropertyName) || processedFields.has(rawPropertyName)) {
      continue;
    }
    processedFields.add(rawPropertyName);

    if (field.jacksonWarnings && field.jacksonWarnings.length > 0) {
      for (const warning of field.jacksonWarnings) {
        lines.push(`  /** Warning: ${warning} */`);
      }
    }

    if (field.jsonAliases && field.jsonAliases.length > 0) {
      lines.push(`  /** Also accepts: ${field.jsonAliases.join(', ')} */`);
    }

    const optional = field.nullable ? '?' : '';
    const fieldType = resolveFieldType(field, context.enumNames);
    const propertyName = formatPropertyName(rawPropertyName);

    lines.push(`  ${propertyName}${optional}: ${fieldType};`);
  }

  lines.push('}');
  return lines.join('\n');
}

export function generateIndexFile(classes: DTOClass[]): string {
  const lines: string[] = ['// Auto-generated by Spring2TS', '// DO NOT EDIT MANUALLY', ''];
  for (const dto of classes) lines.push(`export * from './${dto.className}';`);
  return lines.join('\n');
}

function extractReferencedDtoNames(
  tsType: string,
  classNames: Set<string>,
  localTypeParameters: Set<string>
): string[] {
  const matches = tsType.match(/\b([A-Z]\w*)\b/g) || [];

  return matches.filter((match) => classNames.has(match) && !localTypeParameters.has(match));
}

function buildDependencyGraphInternal(
  classes: DTOClass[],
  classNames: Set<string>,
  enumNames: Set<string>
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  for (const dto of classes) {
    const dependencies = new Set<string>();
    const localTypeParameters = new Set(dto.typeParameters || []);

    if (dto.extends) {
      for (const referencedType of extractReferencedDtoNames(
        dto.extends,
        classNames,
        localTypeParameters
      )) {
        dependencies.add(referencedType);
      }
    }

    for (const field of dto.fields) {
      const resolvedType = resolveFieldType(field, enumNames);
      for (const referencedType of extractReferencedDtoNames(
        resolvedType,
        classNames,
        localTypeParameters
      )) {
        dependencies.add(referencedType);
      }
    }

    graph.set(dto.className, dependencies);
  }

  return graph;
}

function resolveFieldType(field: DTOField, enumNames: Set<string>): string {
  const enumName = resolveEnumName(field, enumNames);
  return enumName ?? field.tsType;
}

function resolveEnumName(field: DTOField, enumNames: Set<string>): string | undefined {
  if (field.enumName && enumNames.has(field.enumName)) {
    return field.enumName;
  }

  if (field.isEnum && enumNames.has(field.tsType)) {
    return field.tsType;
  }

  const baseType = extractBaseTypeName(field.javaType);
  if (enumNames.has(baseType)) {
    return baseType;
  }

  return undefined;
}

function extractBaseTypeName(qualifiedType: string): string {
  let base = qualifiedType.replace(/<[^>]+>/g, '').replace(/\[\]/g, '').trim();

  if (base.includes('.')) {
    base = base.split('.').pop()!;
  }

  return base;
}

/**
 * Replace placeholder tokens with quoted reserved words.
 * Called AFTER Prettier formatting to prevent quote stripping.
 */
export function applyReservedWordQuoting(code: string): string {
  const reservedWords = [
    'class', 'interface', 'enum', 'extends', 'implements',
    'package', 'import', 'public', 'private', 'protected',
    'static', 'final', 'abstract', 'default', 'const', 'goto',
    'yield', 'var', 'module', 'record', 'sealed', 'permits',
    'nonSealed', 'assert', 'synchronized', 'volatile', 'transient',
    'native', 'strictfp', 'export', 'delete', 'do', 'from', 'get',
    'in', 'instanceof', 'new', 'of', 'set', 'super', 'switch',
    'this', 'throw', 'try', 'typeof', 'void', 'while', 'with',
  ];

  for (const word of reservedWords) {
    const regex = new RegExp(`__QUOTED_${word}__`, 'g');
    code = code.replace(regex, `'${word}'`);
  }
  return code;
}
