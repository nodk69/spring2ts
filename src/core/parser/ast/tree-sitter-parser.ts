import Parser from 'tree-sitter';
import Java from 'tree-sitter-java';
import { DTOClass, DTOField } from '../../../types/dto.types';
import { mapJavaTypeToTS } from '../type-mapper';

const isVerbose = process.argv.includes('--verbose');

/**
 * Parse Java file using Tree-sitter (reliable modern parser)
 */
export function parseJavaFileWithAST(
  content: string,
  filePath: string,
  knownClasses: Set<string>
): DTOClass[] {
  const dtos: DTOClass[] = [];

  try {
    const parser = new Parser();
    parser.setLanguage(Java);

    const tree = parser.parse(content);
    const root = tree.rootNode;

    let packageName = '';
    const imports: string[] = [];

    for (const child of root.children) {
      if (child.type === 'package_declaration') {
        packageName = child.text.replace(/^package\s+/, '').replace(';', '').trim();
      }
      if (child.type === 'import_declaration') {
        const importPath = child.text.replace(/^import\s+/, '').replace(';', '').trim();
        if (importPath) imports.push(importPath);
      }
    }

    const declarations = root.children.filter(
      (n) => n.type === 'class_declaration' || n.type === 'enum_declaration'
    );

    for (const decl of declarations) {
      if (decl.type === 'class_declaration') {
        dtos.push(extractClass(decl, packageName, imports, filePath, knownClasses));
      } else if (decl.type === 'enum_declaration') {
        dtos.push(extractEnum(decl, packageName, imports, filePath));
      }
    }

    if (isVerbose && dtos.length > 0) {
      const fileName = filePath.split(/[/\\]/).pop();
      console.log(`   🔍 Parsed ${fileName}`);
    }
    return dtos;
  } catch (error: any) {
    console.error(`❌ Tree-sitter failed for ${filePath}: ${error.message}`);
    return [];
  }
}

/** Extract @JsonProperty value from field text */
function extractJsonProperty(fieldText: string): string | undefined {
  const match = fieldText.match(/@JsonProperty\s*\(\s*(?:value\s*=\s*)?["']([^"']*)["']/);
  return match ? match[1] : undefined;
}

/** Extract @JsonAlias values from field text */
function extractJsonAliases(fieldText: string): string[] | undefined {
  const match = fieldText.match(/@JsonAlias\s*\(\s*\{?\s*["']([^"']+)["'](?:\s*,\s*["']([^"']+)["'])*\s*\}?\s*\)/);
  if (!match) return undefined;
  
  const aliases: string[] = [];
  const aliasRegex = /["']([^"']+)["']/g;
  let m;
  while ((m = aliasRegex.exec(match[0])) !== null) {
    aliases.push(m[1]);
  }
  return aliases.length > 0 ? aliases : undefined;
}

/** Check if field has @JsonIgnore annotation */
function hasJsonIgnore(fieldText: string, annotations: string[]): boolean {
  return annotations.includes('JsonIgnore') || fieldText.includes('@JsonIgnore');
}

/** Check for annotations that affect type but can't be inferred */
function getJacksonWarnings(fieldText: string, annotations: string[]): string[] {
  const warnings: string[] = [];
  if (annotations.includes('JsonSerialize') || fieldText.includes('@JsonSerialize')) {
    warnings.push(`@JsonSerialize detected - type may differ from Java type`);
  }
  if (annotations.includes('JsonFormat') || fieldText.includes('@JsonFormat')) {
    warnings.push(`@JsonFormat detected - serialization format may differ`);
  }
  if (annotations.includes('JsonUnwrapped') || fieldText.includes('@JsonUnwrapped')) {
    warnings.push(`@JsonUnwrapped detected - fields are flattened in response`);
  }
  return warnings;
}

/** Extract a regular class */
function extractClass(
  node: Parser.SyntaxNode,
  packageName: string,
  imports: string[],
  filePath: string,
  knownClasses: Set<string>
): DTOClass {
  const className = node.childForFieldName('name')?.text || 'Unknown';

  let extendsClass: string | undefined;
  const superclass = node.childForFieldName('superclass');
  if (superclass) {
    const typeNode = superclass.children.find((c: Parser.SyntaxNode) => c.isNamed);
    extendsClass = typeNode ? extractTypeText(typeNode) : undefined;
  }

  const implementsList: string[] = [];
  const superinterfaces = node.childForFieldName('super_interfaces');
  if (superinterfaces) {
    for (const child of superinterfaces.children) {
      if (child.isNamed && child.type !== 'implements') {
        const typeName = extractTypeText(child);
        if (typeName) implementsList.push(typeName);
      }
    }
  }

  const fields: DTOField[] = [];
  const classBody = node.childForFieldName('body');
  if (classBody) {
    for (const member of classBody.children) {
      if (member.type === 'field_declaration') {
        fields.push(...extractFields(member, knownClasses));
      }
    }
  }

  return {
    className,
    packageName,
    fields,
    imports,
    extends: extendsClass,
    implements: implementsList,
    isEnum: false,
    enumValues: undefined,
    filePath,
  };
}

/** Extract fields from a field_declaration node */
function extractFields(
  fieldNode: Parser.SyntaxNode,
  knownClasses: Set<string>
): DTOField[] {
  const fields: DTOField[] = [];
  const fieldText = fieldNode.text;

  const annotations: string[] = [];
  let hasNotNull = false;

  /** Helper to process any annotation node */
  const processAnnotation = (node: Parser.SyntaxNode) => {
    const raw = node.childForFieldName('name')?.text || node.text || '';
    let annName = raw.replace(/^@/, '').split('(')[0].trim();
    
    if (annName.includes('.')) {
      annName = annName.split('.').pop() || annName;
    }
    
    if (!annotations.includes(annName)) {
      annotations.push(annName);
    }
    
    // Support @NotNull, @Nonnull, @NonNull (including lombok.NonNull)
    const normalized = annName.toLowerCase();
    if (normalized === 'notnull' || normalized === 'nonnull') {
      hasNotNull = true;
    }
  };

  // ✅ Traverse ALL direct children for annotations
  for (const child of fieldNode.children) {
    if (child.type === 'annotation' || child.type === 'marker_annotation') {
      processAnnotation(child);
    }
  }

  // ✅ Also check inside modifiers node (some parsers put annotations there)
  const modifiersNode = fieldNode.childForFieldName('modifiers');
  if (modifiersNode) {
    for (const mod of modifiersNode.children) {
      if (mod.type === 'annotation' || mod.type === 'marker_annotation') {
        processAnnotation(mod);
      }
    }
  }

  // ✅ SUPER ROBUST FALLBACK: Raw text scan (catches Lombok @NonNull even if node parsing is quirky)
  if (!hasNotNull) {
    const lowerText = fieldText.toLowerCase();
    if (lowerText.includes('@notnull') || lowerText.includes('@nonnull')) {
      hasNotNull = true;
    }
  }

  // Extract Jackson annotations
  const jsonName = extractJsonProperty(fieldText);
  const jsonAliases = extractJsonAliases(fieldText);
  const jsonIgnore = hasJsonIgnore(fieldText, annotations);
  const jacksonWarnings = getJacksonWarnings(fieldText, annotations);

  // EARLY RETURN: If @JsonIgnore, skip this field entirely
  if (jsonIgnore) {
    return fields;
  }

  const typeNode = fieldNode.childForFieldName('type');
  const javaType = typeNode ? extractTypeText(typeNode) : 'unknown';

  const declarators = fieldNode.children.filter((n) => n.type === 'variable_declarator');
  for (const decl of declarators) {
    const nameNode = decl.childForFieldName('name');
    const fieldName = nameNode?.text;
    if (!fieldName || fieldName === 'serialVersionUID') continue;

    const tsType = mapJavaTypeToTS(javaType, knownClasses);
    const nullable = !hasNotNull;

    fields.push({
      name: fieldName,
      javaType,
      tsType,
      nullable,
      isEnum: false,
      annotations,
      jsonName,
      jsonAliases,
      jsonIgnore,
      jacksonWarnings,
    });
  }

  return fields;
}

/** Extract enum */
function extractEnum(
  node: Parser.SyntaxNode,
  packageName: string,
  imports: string[],
  filePath: string
): DTOClass {
  const className = node.childForFieldName('name')?.text || 'Unknown';
  const enumValues: string[] = [];

  const body = node.childForFieldName('body');
  if (body) {
    for (const child of body.children) {
      if (child.type === 'enum_constant') {
        const value = child.childForFieldName('name')?.text;
        if (value) enumValues.push(value);
      }
    }
  }

  return {
    className,
    packageName,
    fields: [],
    imports,
    extends: undefined,
    implements: [],
    isEnum: true,
    enumValues,
    filePath,
  };
}

/** Recursively stringify a type node */
function extractTypeText(node: Parser.SyntaxNode): string {
  if (!node) return 'unknown';

  if (node.type === 'array_type') {
    const elem = node.childForFieldName('element');
    const dims = (node.text.match(/\[\]/g) || []).length;
    return `${extractTypeText(elem!)}${'[]'.repeat(dims)}`;
  }

  if (node.type === 'generic_type') {
    const base = node.childForFieldName('type')?.text || '';
    const typeArgs = node.children.find((c) => c.type === 'type_arguments');
    if (typeArgs) {
      const args = typeArgs.children
        .filter((c) => c.isNamed)
        .map(extractTypeText)
        .join(', ');
      return `${base}<${args}>`;
    }
    return base;
  }

  if (['type_identifier', 'scoped_type_identifier'].includes(node.type)) {
    return node.text;
  }

  return node.text || 'unknown';
}