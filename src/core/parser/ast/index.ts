// src/core/parser/ast/index.ts
// Barrel file – re-exports the working Tree-sitter parser
// (old java-ast implementation removed because it was broken and untyped)

export { parseJavaFileWithAST } from './tree-sitter-parser';
export { resolveInheritance } from './resolve-inheritance';

// Add any other exports you need from this folder here in the future
// e.g. export * from './types';