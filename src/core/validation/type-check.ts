import * as fs from 'fs';
import * as os from 'os';
import ts from 'typescript';
import { generateTypeScript } from '../generator';
import { ParsedDTO } from '../../types/dto.types';
import { joinPaths } from '../../utils/paths';

export interface TypeCheckDiagnostic {
  filePath?: string;
  line?: number;
  column?: number;
  message: string;
}

export interface TypeCheckResult {
  success: boolean;
  diagnostics: TypeCheckDiagnostic[];
}

export async function validateGeneratedTypes(parsed: ParsedDTO): Promise<TypeCheckResult> {
  const tempRoot = fs.mkdtempSync(joinPaths(os.tmpdir(), 'spring2ts-typecheck-'));

  try {
    await generateTypeScript({
      outputPath: tempRoot,
      parsed,
      merge: false,
    });

    const sourceFiles = fs
      .readdirSync(tempRoot)
      .filter((fileName) => fileName.endsWith('.ts'))
      .map((fileName) => joinPaths(tempRoot, fileName));

    const program = ts.createProgram(sourceFiles, {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.Node16,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      skipLibCheck: true,
      ignoreDeprecations: '6.0',
      moduleResolution: ts.ModuleResolutionKind.Node16,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);

    return {
      success: diagnostics.length === 0,
      diagnostics: diagnostics.map(toDiagnostic),
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function toDiagnostic(diagnostic: ts.Diagnostic): TypeCheckDiagnostic {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');

  if (!diagnostic.file || diagnostic.start === undefined) {
    return { message };
  }

  const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);

  return {
    filePath: diagnostic.file.fileName,
    line: line + 1,
    column: character + 1,
    message,
  };
}
