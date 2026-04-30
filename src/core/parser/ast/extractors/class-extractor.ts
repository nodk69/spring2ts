import { SyntaxNode } from 'tree-sitter';
import { DTOClass } from '../../../../types/dto.types';
import { extractTypeText } from './type-extractor';
import { extractFields } from './field-extractor';
import { Queries, queryAll } from '../queries';

/**
 * Extract information from a class declaration node.
 */
export function extractClass(
  node: SyntaxNode,
  packageName: string,
  imports: string[],
  filePath: string,
  knownClasses: Set<string>
): DTOClass | null {
  const className = node.childForFieldName('name')?.text;
  if (!className) return null;
  const typeParameters = extractTypeParameters(node);

  // Extends
  let extendsClass: string | undefined;
  const superclass = node.childForFieldName('superclass');
  if (superclass) {
    const typeNode = superclass.namedChildren.find((c: SyntaxNode) => 
      c.type === 'type_identifier' || c.type === 'generic_type' || c.type === 'scoped_type_identifier'
    );
    extendsClass = typeNode ? extractTypeText(typeNode, knownClasses) : undefined;
  }

  // Implements
  const implementsList: string[] = [];
  const superinterfaces = node.childForFieldName('super_interfaces');
  if (superinterfaces) {
    for (const child of superinterfaces.namedChildren) {
      if (child.type === 'type_identifier' || child.type === 'generic_type' || child.type === 'scoped_type_identifier') {
        const typeName = extractTypeText(child, knownClasses);
        if (typeName) implementsList.push(typeName);
      }
    }
  }

  // Fields
  const fields = [];
  const classBody = node.childForFieldName('body');
  if (classBody) {
    const fieldNodes = queryAll(classBody, Queries.FIELDS)
      .map((match) => match.get('field'))
      .filter((fieldNode): fieldNode is SyntaxNode => fieldNode !== undefined)
      .filter((fieldNode) => fieldNode.parent === classBody);
    const uniqueFieldNodes = new Map<string, SyntaxNode>();

    for (const fieldNode of fieldNodes) {
      uniqueFieldNodes.set(`${fieldNode.startIndex}:${fieldNode.endIndex}`, fieldNode);
    }

    for (const fieldNode of uniqueFieldNodes.values()) {
      if (!fieldNode) {
        continue;
      }
      fields.push(...extractFields(fieldNode, knownClasses));
    }
  }

  return {
    className,
    packageName,
    fields,
    imports,
    typeParameters,
    extends: extendsClass,
    implements: implementsList,
    isEnum: false,
    enumValues: undefined,
    filePath,
  };
}

function extractTypeParameters(node: SyntaxNode): string[] | undefined {
  const typeParametersNode = node.childForFieldName('type_parameters');
  if (!typeParametersNode) {
    return undefined;
  }

  const typeParameters = typeParametersNode.namedChildren
    .filter((child) => child.type === 'type_parameter')
    .map((child) => child.childForFieldName('name')?.text || child.text.split(/\s+/)[0])
    .filter((name): name is string => Boolean(name));

  return typeParameters.length > 0 ? typeParameters : undefined;
}

