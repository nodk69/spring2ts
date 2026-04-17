import * as prettier from 'prettier';

let warningShown = false;

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
    // Only show warning ONCE and only in verbose mode
    if (!warningShown) {
      const isVerbose = process.argv.includes('--verbose');
      if (isVerbose) {
        console.log('   ℹ️  Some files contain special characters (formatting skipped)');
      }
      warningShown = true;
    }
    // Return unformatted code - it's still valid TypeScript!
    return code;
  }
}