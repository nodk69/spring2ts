import { parseDTOs } from '../core/parser/index';
import { generateTypeScript } from '../core/generator/index';
import { checkBreakingChanges } from '../core/diff/index';
import { logger } from '../utils/logger';
import { writeFile, ensureDirectory } from '../utils/file-utils';
import * as path from 'path';
import * as fs from 'fs';
import { EXIT_CODES } from '../constants/exit-codes';

export interface SyncOptions {
  backend?: string;
  frontend?: string;
  config?: string;
  check?: boolean;
  failOnBreaking?: boolean;
}

function loadConfig(): Partial<SyncOptions> {
  try {
    const configPath = path.join(process.cwd(), '.spring2tsrc.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch {
    // Ignore config errors
  }
  return {};
}

export async function sync(options: SyncOptions): Promise<void> {
  const config = loadConfig();
  
  // Resolve paths relative to current working directory
  let backendPath = options.backend || config.backend || './backend/src/main/java';
  let frontendPath = options.frontend || config.frontend || './src/types';
  
  // Resolve to absolute paths
  backendPath = path.resolve(process.cwd(), backendPath);
  if (frontendPath) {
    frontendPath = path.resolve(process.cwd(), frontendPath);
  }
  
  const checkOnly = options.check || false;
  const failOnBreaking = options.failOnBreaking || config.failOnBreaking || false;
  
  if (!checkOnly && frontendPath) {
    logger.info(`   Backend: ${backendPath}`);
    logger.info(`   Frontend: ${frontendPath}`);
  } else if (checkOnly) {
    logger.info(`   Backend: ${backendPath}`);
  }
  
  try {
    const parsed = await parseDTOs({
      inputPath: backendPath,
      excludePatterns: [],
      includeNested: true,
    });
    
    if (!checkOnly) {
      logger.success(`Parsed ${parsed.classes.length} classes and ${parsed.enums.length} enums`);
    }
    
    const outputDir = path.join(process.cwd(), '.spring2ts');
    ensureDirectory(outputDir);
    
    writeFile(
      path.join(outputDir, 'parsed-dtos.json'),
      JSON.stringify(parsed, null, 2)
    );
    
    // Check for breaking changes
    const baselinePath = path.join(outputDir, 'baseline.json');
    const diff = await checkBreakingChanges({
      parsed,
      baselinePath,
      failOnBreaking,
      updateBaseline: !checkOnly,
    });
    
    // Generate TypeScript (skip if check-only or no frontend path)
    if (!checkOnly && frontendPath) {
      await generateTypeScript({
        outputPath: frontendPath,
        parsed,
      });
      logger.success('✨ Done!');
    }
    
    if (failOnBreaking && diff.hasBreakingChanges) {
      logger.error('Breaking changes detected. Exiting with error.');
      process.exit(EXIT_CODES.BREAKING_CHANGE);
    }
    
  } catch (error) {
    logger.error(`Failed: ${error}`);
    process.exit(EXIT_CODES.UNKNOWN_ERROR);
  }
}