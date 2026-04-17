import { findJavaFiles, readJavaFile } from '../../utils/file-utils';
import { logger } from '../../utils/logger';
import { ParsedDTO, DTOClass, ParseOptions } from '../../types/dto.types';
import { parseJavaFileWithAST } from './ast/tree-sitter-parser';
import { resolveInheritance } from './ast/resolve-inheritance';

export async function parseDTOs(options: ParseOptions): Promise<ParsedDTO> {
  const { inputPath, excludePatterns = [] } = options;
  
  logger.step(1, 3, `Scanning for Java files in: ${inputPath}`);
  
  const javaFiles = await findJavaFiles(inputPath, [
    '**/test/**',
    '**/tests/**',
    '**/build/**',
    '**/target/**',
    ...excludePatterns,
  ]);
  
  logger.success(`Found ${javaFiles.length} Java files`);
  
  const classes: DTOClass[] = [];
  const enums: DTOClass[] = [];
  const knownClasses = new Set<string>();
  
  logger.step(2, 3, 'Parsing Java files...');
  
  // ✅ USE TREE-SITTER PARSER (WITH JACKSON SUPPORT!)
  for (const filePath of javaFiles) {
    try {
      const content = readJavaFile(filePath);
      const dtos = parseJavaFileWithAST(content, filePath, knownClasses);
      
      for (const dto of dtos) {
        knownClasses.add(dto.className);
        
        if (dto.isEnum) {
          enums.push(dto);
        } else {
          classes.push(dto);
        }
      }
    } catch (error) {
      logger.error(`Failed to parse ${filePath}: ${error}`);
    }
  }
  
  resolveInheritance(classes);
  
  logger.step(3, 3, 'Resolving types...');
  
  for (const dto of classes) {
    for (const field of dto.fields) {
      const baseType = field.javaType.replace(/<[^>]+>/, '').replace('[]', '');
      if (knownClasses.has(baseType)) {
        const isEnumType = enums.some(e => e.className === baseType);
        field.isEnum = isEnumType;
        if (isEnumType) {
          field.enumName = baseType;
        }
      }
    }
  }
  
  logger.success(`Parsed ${classes.length} DTOs and ${enums.length} enums`);
  
  return { classes, enums };
}