declare module 'tree-sitter' {
  export default class Parser {
    setLanguage(language: any): void;
    parse(content: string): Tree;
  }

  export interface Tree {
    rootNode: SyntaxNode;
  }

  export interface SyntaxNode {
    type: string;
    text: string;
    isNamed: boolean;
    children: SyntaxNode[];
    childForFieldName(fieldName: string): SyntaxNode | null;
  }
}

declare module 'tree-sitter-java' {
  const Java: any;
  export default Java;
}