import { SyntaxNode } from 'tree-sitter';
import { DTOClass } from '../../../../types/dto.types';
import { extractTypeText } from './type-extractor';
import { extractFields } from './field-extractor';

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

