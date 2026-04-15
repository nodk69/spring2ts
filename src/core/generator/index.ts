import { ParsedDTO } from '../../types/dto.types';
import { writeFile, ensureDirectory } from '../../utils/file-utils';
import { logger } from '../../utils/logger';
import { generateInterface, generateIndexFile } from './ts-interface';
import { generateEnum } from './ts-enum';
import { formatTypeScript } from './formatter';
import * as path from 'path';

export interface GenerateOptions {
  outputPath: string;
  parsed: ParsedDTO;
}

export async function generateTypeScript(options: GenerateOptions): Promise<void> {
  const { outputPath, parsed } = options;
  
  logger.step(1, 3, 'Generating TypeScript files...');
  
  const allClasses = [...parsed.classes, ...parsed.enums];
  const absoluteOutput = path.resolve(outputPath);
  
  ensureDirectory(absoluteOutput);
  
  let generated = 0;
  
  // Generate enums
  for (const enumDto of parsed.enums) {
    let code = generateEnum(enumDto);
    code = await formatTypeScript(code);
    
    const filePath = path.join(absoluteOutput, `${enumDto.className}.ts`);
    writeFile(filePath, code);
    generated++;
  }
  
  // Generate interfaces
  for (const dto of parsed.classes) {
    let code = generateInterface(dto, allClasses);
    code = await formatTypeScript(code);
    
    const filePath = path.join(absoluteOutput, `${dto.className}.ts`);
    writeFile(filePath, code);
    generated++;
  }
  
  // Generate index.ts
  const indexCode = generateIndexFile(allClasses);
  const formattedIndex = await formatTypeScript(indexCode);
  writeFile(path.join(absoluteOutput, 'index.ts'), formattedIndex);
  generated++;
  
  logger.step(2, 3, `Generated ${generated} TypeScript files`);
  logger.step(3, 3, `Output directory: ${absoluteOutput}`);
}