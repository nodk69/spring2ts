import Parser, { SyntaxNode } from 'tree-sitter';
import Java from 'tree-sitter-java';
import { DTOClass } from '../../../types/dto.types';
import { extractClass } from './extractors/class-extractor';
import { extractEnum } from './extractors/enum-extractor';
import { extractRecord } from './extractors/record-extractor';
import { Queries, queryAll } from './queries';
import { logger } from '../../../utils/logger';

const tsParser = new Parser();
tsParser.setLanguage(Java);
const isVerbose = process.argv.includes('--verbose');

function decodeUnicodeEscapes(content: string): string {
  return content.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function normalizeContent(content: string): string {
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function extractPackageName(root: SyntaxNode): string {
  for (const child of root.children) {
    if (child.type === 'package_declaration') return child.text.replace(/^package\s+/, '').replace(';', '').trim();
  }
  return '';
}

function extractImports(root: SyntaxNode): string[] {
  const imports: string[] = [];
  for (const child of root.children) {
    if (child.type === 'import_declaration') {
      const p = child.text.replace(/^import\s+/, '').replace(';', '').trim();
      if (p) imports.push(p);
    }
  }
  return imports;
}

export function parseJavaFileWithAST(
  content: string,
  filePath: string,
  knownClasses: Set<string>
): DTOClass[] {
  const dtos: DTOClass[] = [];

  try {
    content = decodeUnicodeEscapes(content);
    content = normalizeContent(content);

    const tree = tsParser.parse(content);
    const root = tree.rootNode;

    const packageName = extractPackageName(root);
    const importsList = extractImports(root);

    // Find classes using queries (FAST!)
    const classMatches = queryAll(root, Queries.CLASS_DECLARATIONS);
    for (const match of classMatches) {
      const classNode = match.get('class');
      if (classNode) {
        const extracted = extractClass(classNode, packageName, importsList, filePath, knownClasses);
        if (extracted) dtos.push(extracted);
      }
    }

    // Find enums manually (they're simple)
    const declarations = root.children.filter(
      (n: SyntaxNode) => n.type === 'enum_declaration' || n.type === 'record_declaration'
    );

    for (const decl of declarations) {
      if (decl.type === 'enum_declaration') {
        const extracted = extractEnum(decl, packageName, importsList, filePath);
        if (extracted) dtos.push(extracted);
      } else if (decl.type === 'record_declaration') {
        const extracted = extractRecord(decl, packageName, importsList, filePath, knownClasses);
        if (extracted) dtos.push(extracted);
      }
    }

    if (isVerbose && dtos.length > 0) {
      const fileName = filePath.split(/[/\\]/).pop();
      logger.debug(`   Parsed ${fileName} -> [${dtos.map(d => d.className).join(', ')}]`);
    }

    return dtos;
  } catch (error: any) {
    logger.error(`Tree-sitter failed for ${filePath}: ${error.message}`);
    return [];
  }
}

export function hasDTODeclarations(content: string): boolean {
  return /(?:public\s+)?(?:class|enum|record)\s+\w+/.test(content);
}

export function getParser(): Parser {
  return tsParser;
}
