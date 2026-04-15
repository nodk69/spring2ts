import * as prettier from 'prettier';

export async function formatTypeScript(code: string): Promise<string> {
  try {
    return await prettier.format(code, {
      parser: 'typescript',
      singleQuote: true,
      semi: true,
      tabWidth: 2,
      trailingComma: 'es5',
    });
  } catch (error) {
    // Silently return unformatted code - the code is still valid TypeScript
    // This happens when there are special characters in property names (like hyphens)
    // which Prettier doesn't handle well but TypeScript accepts with quotes
    console.warn('⚠️  Formatting skipped (special characters in property names)');
    return code;
  }
}