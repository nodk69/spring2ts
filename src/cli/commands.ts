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
  dryRun?: boolean;  // 🆕
  backup?: boolean;  // 🆕
  safe?: boolean;    // 🆕
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
  
  let backendPath = options.backend || config.backend || './backend/src/main/java';
  let frontendPath = options.frontend || config.frontend || './src/types';
  
  backendPath = path.resolve(process.cwd(), backendPath);
  if (frontendPath) {
    frontendPath = path.resolve(process.cwd(), frontendPath);
  }
  
  const checkOnly = options.check || false;
  const failOnBreaking = options.failOnBreaking || config.failOnBreaking || false;
  const dryRun = options.dryRun || false;
  const backup = options.backup || false;
  const safe = options.safe || false;
  
  if (dryRun) {
    logger.info('🔍 DRY RUN - No files will be written');
  }
  
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
    
    const baselinePath = path.join(outputDir, 'baseline.json');
    const diff = await checkBreakingChanges({
      parsed,
      baselinePath,
      failOnBreaking,
      updateBaseline: !checkOnly && !dryRun,
    });
    
    // Safe mode - abort if breaking changes
    if (safe && diff.hasBreakingChanges) {
      logger.error('❌ Breaking changes detected. Aborting due to --safe flag.');
      logger.info('   Use --dry-run to see what would change, or run without --safe to proceed anyway.');
      process.exit(EXIT_CODES.BREAKING_CHANGE);
    }
    
    // Backup existing types
    if (backup && !checkOnly && frontendPath && !dryRun) {
      if (fs.existsSync(frontendPath)) {
        const backupPath = `${frontendPath}.backup.${Date.now()}`;
        logger.info(`💾 Backing up existing types to ${backupPath}`);
        fs.cpSync(frontendPath, backupPath, { recursive: true });
      }
    }
    
    // Generate TypeScript
    if (!checkOnly && frontendPath) {
      if (dryRun) {
        // Dry run - show what WOULD be generated
        logger.info('');
        logger.info('📋 Files that would be generated:');
        logger.info(`   Output directory: ${frontendPath}`);
        logger.info(`   Total files: ${parsed.classes.length + parsed.enums.length + 1}`);
        logger.info('');
        logger.info('   Classes:');
        for (const dto of parsed.classes) {
          logger.info(`     • ${dto.className}.ts`);
        }
        logger.info('');
        logger.info('   Enums:');
        for (const enumDto of parsed.enums) {
          logger.info(`     • ${enumDto.className}.ts`);
        }
        logger.info('     • index.ts');
        logger.info('');
        logger.info('✨ Dry run complete. No files were written.');
      } else {
        await generateTypeScript({
          outputPath: frontendPath,
          parsed,
        });
        logger.success('✨ Done!');
      }
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