import { SyntaxNode } from 'tree-sitter';
import { DTOClass } from '../../../../types/dto.types';
import { Queries, queryAll } from '../queries';

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
  
  const enumValues = queryAll(node, Queries.ENUM_CONSTANTS)
    .map((match) => match.get('constant_name')?.text)
    .filter((value): value is string => Boolean(value));

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
