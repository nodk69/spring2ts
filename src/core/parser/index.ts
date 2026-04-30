import { findJavaFiles, readTextFile, isDirectory } from '../../utils/filesystem';
import { logger } from '../../utils/logger';
import { ParsedDTO, DTOClass, ParseOptions } from '../../types/dto.types';
import { parseJavaFileWithAST } from './ast/tree-sitter-parser';
import { resolveInheritance } from './resolve-inheritance';
import { parseCache } from '../storage/parse-cache';
import * as fs from 'fs';

export async function parseDTOs(options: ParseOptions): Promise<ParsedDTO> {
  const { inputPath, excludePatterns = [] } = options;

  if (!fs.existsSync(inputPath)) {
    logger.error(`Directory not found: ${inputPath}`);
    logger.info('Please check the backend path and try again.');
    process.exit(1);
  }

  logger.step(1, 3, `Scanning for Java files in: ${inputPath}`);

  const javaFiles = await findJavaFiles(inputPath, [
    '**/test/**',
    '**/tests/**',
    '**/build/**',
    '**/target/**',
    ...excludePatterns,
  ]);

  if (javaFiles.length === 0) {
    logger.warn(`No Java files found in ${inputPath}`);
    return { classes: [], enums: [] };
  }

  logger.success(`Found ${javaFiles.length} Java files`);

  const classes: DTOClass[] = [];
  const enums: DTOClass[] = [];
  const knownClasses = new Set<string>();

  logger.step(2, 3, 'Parsing Java files...');

  let cachedCount = 0;
  let parsedCount = 0;

  for (const filePath of javaFiles) {
    try {
      const content = readTextFile(filePath);
      const fileKey = `file:${filePath}`;

      // Check per-file cache
      let dtos = parseCache.get(fileKey, content);

      if (dtos) {
        cachedCount++;
      } else {
        dtos = parseJavaFileWithAST(content, filePath, knownClasses);
        parseCache.set(fileKey, dtos, content);
        parsedCount++;
      }

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

  logger.info(`Parsed: ${parsedCount} files, Cached: ${cachedCount} files`);

  resolveInheritance(classes);

  logger.step(3, 3, 'Finalizing parsed DTO graph...');
  logger.success(`Parsed ${classes.length} DTOs and ${enums.length} enums`);

  return { classes, enums };
}