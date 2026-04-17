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
  
  // ✅ Dedupe classes by name (fixes duplicate TestDto issue)
  const uniqueClasses = [...new Map(parsed.classes.map(c => [c.className, c])).values()];
  const uniqueEnums = [...new Map(parsed.enums.map(e => [e.className, e])).values()];
  const allClasses = [...uniqueClasses, ...uniqueEnums];
  
  const absoluteOutput = path.resolve(outputPath);
  ensureDirectory(absoluteOutput);
  
  let generated = 0;
  
  // Generate enums
  for (const enumDto of uniqueEnums) {
    let code = generateEnum(enumDto);
    code = await formatTypeScript(code);
    
    const filePath = path.join(absoluteOutput, `${enumDto.className}.ts`);
    writeFile(filePath, code);
    generated++;
    logger.debug(`Generated ${enumDto.className}.ts`);
  }
  
  // Generate interfaces
  for (const dto of uniqueClasses) {
    let code = generateInterface(dto, allClasses);
    code = await formatTypeScript(code);
    
    const filePath = path.join(absoluteOutput, `${dto.className}.ts`);
    writeFile(filePath, code);
    generated++;
    logger.debug(`Generated ${dto.className}.ts`);
  }
  
  // Generate index.ts
  const indexCode = generateIndexFile(allClasses);
  const formattedIndex = await formatTypeScript(indexCode);
  writeFile(path.join(absoluteOutput, 'index.ts'), formattedIndex);
  generated++;
  logger.debug('Generated index.ts');
}