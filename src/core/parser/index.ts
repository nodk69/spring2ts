import { findJavaFiles, readJavaFile } from '../../utils/file-utils';
import { logger } from '../../utils/logger';
import { ParsedDTO, DTOClass, ParseOptions } from '../../types/dto.types';
import { extractDTOFromContent, resolveInheritance } from './dto-extractor';
import { parseJavaFile } from './java-ast';

export async function parseDTOs(options: ParseOptions): Promise<ParsedDTO> {
  const { inputPath, excludePatterns = [] } = options;
  
  logger.step(1, 3, `Scanning for Java files in: ${inputPath}`);
  
  // Find all Java files
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
  
  // First pass: collect all class names
  const knownClasses = new Set<string>();
  
  logger.step(2, 3, 'Parsing Java files...');
  
  // Parse all files
  for (const filePath of javaFiles) {
    try {
      const content = readJavaFile(filePath);
      
      // Validate syntax
      const parseResult = parseJavaFile(content, filePath, knownClasses);
      if (!parseResult.success) {
        logger.warn(`Skipping ${filePath}: ${parseResult.error}`);
        continue;
      }
      
      // Extract DTO
      const dto = extractDTOFromContent(content, filePath, knownClasses);
      
      if (dto) {
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
  
  // Resolve inheritance relationships
  resolveInheritance(classes);
  
  // Second pass: update field types with known enum classes
  logger.step(3, 3, 'Resolving types...');
  
  for (const dto of classes) {
    for (const field of dto.fields) {
      // Check if field type is an enum
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
  
  return {
    classes,
    enums,
  };
}