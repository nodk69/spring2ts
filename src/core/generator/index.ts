import { ParsedDTO } from '../../types/dto.types';
import { writeFile, ensureDirectory, fileExists } from '../../utils/file-utils';
import { logger } from '../../utils/logger';
import { generateInterface, generateIndexFile } from './ts-interface';
import { generateEnum } from './ts-enum';
import { formatTypeScript } from './formatter';
import { mergeInterface } from './merge-interface';  // ✅ NEW
import * as path from 'path';

export interface GenerateOptions {
  outputPath: string;
  parsed: ParsedDTO;
  merge?: boolean;  
}

export async function generateTypeScript(options: GenerateOptions): Promise<void> {
  const { outputPath, parsed, merge = true } = options;  // ✅ Default to merge
  
  const uniqueClasses = [...new Map(parsed.classes.map(c => [c.className, c])).values()];
  const uniqueEnums = [...new Map(parsed.enums.map(e => [e.className, e])).values()];
  const allClasses = [...uniqueClasses, ...uniqueEnums];
  
  const absoluteOutput = path.resolve(outputPath);
  ensureDirectory(absoluteOutput);
  
  let generated = 0;
  let merged = 0;
  let created = 0;
  
  // Generate enums (no merge needed - simple overwrite is fine)
  for (const enumDto of uniqueEnums) {
    let code = generateEnum(enumDto);
    code = await formatTypeScript(code);
    
    const filePath = path.join(absoluteOutput, `${enumDto.className}.ts`);
    writeFile(filePath, code);
    generated++;
  }
  
  // Generate interfaces (WITH MERGE!)
  for (const dto of uniqueClasses) {
    let code = generateInterface(dto, allClasses);
    code = await formatTypeScript(code);
    
    const filePath = path.join(absoluteOutput, `${dto.className}.ts`);
    
    if (merge && fileExists(filePath)) {
      const mergedCode = mergeInterface(filePath, code);
      writeFile(filePath, mergedCode);
      merged++;
      logger.debug(`Merged ${dto.className}.ts (preserved user fields)`);
    } else {
      writeFile(filePath, code);
      created++;
      logger.debug(`Created ${dto.className}.ts`);
    }
    generated++;
  }
  
  // Generate index.ts (always overwrite - no user customizations needed)
  const indexCode = generateIndexFile(allClasses);
  const formattedIndex = await formatTypeScript(indexCode);
  writeFile(path.join(absoluteOutput, 'index.ts'), formattedIndex);
  generated++;
  
  if (merge && merged > 0) {
    logger.info(`Preserved user fields in ${merged} file(s)`);
  }
}