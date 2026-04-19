import { SyntaxNode } from 'tree-sitter';
import { DTOClass } from '../../../../types/dto.types';

/**
 * Extract information from an enum declaration node.
 */
export function extractEnum(
  node: SyntaxNode,
  packageName: string,
  imports: string[],
  filePath: string
): DTOClass | null {
  const className = node.childForFieldName('name')?.text;
  if (!className) return null;
  
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