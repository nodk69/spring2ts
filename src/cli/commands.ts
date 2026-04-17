import { parseDTOs } from '../core/parser/index';
import { generateTypeScript } from '../core/generator/index';
import { checkBreakingChanges } from '../core/diff/index';
import { logger } from '../utils/logger';
import { writeFile, ensureDirectory } from '../utils/file-utils';
import * as path from 'path';
import * as fs from 'fs';
import { EXIT_CODES } from '../constants/exit-codes';
import chalk from 'chalk';

export interface SyncOptions {
  backend?: string;
  frontend?: string;
  config?: string;
  check?: boolean;
  failOnBreaking?: boolean;
  dryRun?: boolean;
  backup?: boolean;
  safe?: boolean;
  isSyncMode?: boolean;
}

function loadConfig(): Partial<SyncOptions> {
  try {
    const configPath = path.join(process.cwd(), '.spring2tsrc.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch {}
  return {};
}

export async function sync(options: SyncOptions): Promise<void> {
  const startTime = Date.now();
  const config = loadConfig();
  
  let backendPath = options.backend || config.backend || './backend/src/main/java';
  let frontendPath = options.frontend || config.frontend || './src/types';
  
  backendPath = path.resolve(process.cwd(), backendPath);
  if (frontendPath) frontendPath = path.resolve(process.cwd(), frontendPath);
  
  const checkOnly = options.check || false;
  const failOnBreaking = options.failOnBreaking || config.failOnBreaking || false;
  const dryRun = options.dryRun || false;
  const backup = options.backup || false;
  const safe = options.safe || false;
  const isSyncMode = options.isSyncMode || false;
  
  // === CLEAN OUTPUT ===
  logger.title(`Spring2TS v0.3.0`);
  logger.kv('Backend: ', backendPath);
  if (!checkOnly) logger.kv('Frontend:', frontendPath);
  if (dryRun) logger.kv('Mode:   ', chalk.yellow('DRY RUN'));
  if (safe) logger.kv('Mode:   ', chalk.yellow('SAFE MODE'));
  if (isSyncMode) logger.kv('Mode:   ', chalk.cyan('SYNC (accepting changes)'));
  logger.blank();
  
  try {
    // Parse
    const parsed = await parseDTOs({ inputPath: backendPath, excludePatterns: [], includeNested: true });
    
    if (parsed.classes.length === 0 && parsed.enums.length === 0) {
      logger.warn(`No Java files found in ${backendPath}`);
    } else {
      logger.success(`Found ${parsed.classes.length} DTOs, ${parsed.enums.length} enums`);
    }
    
    // Check breaking changes
    const outputDir = path.join(process.cwd(), '.spring2ts');
    ensureDirectory(outputDir);
    writeFile(path.join(outputDir, 'parsed-dtos.json'), JSON.stringify(parsed, null, 2));
    
    const baselinePath = path.join(outputDir, 'baseline.json');
    const diff = await checkBreakingChanges({
      parsed,
      baselinePath,
      failOnBreaking: isSyncMode ? false : failOnBreaking,
      updateBaseline: !checkOnly || isSyncMode,
      isSyncMode
    });
    
    // Safe mode abort
    if (safe && diff.hasBreakingChanges) {
      logger.error('Breaking changes detected. Aborted (--safe mode).');
      process.exit(EXIT_CODES.BREAKING_CHANGE);
    }
    
    // Backup
    if (backup && !checkOnly && frontendPath && !dryRun && fs.existsSync(frontendPath)) {
      const backupPath = `${frontendPath}.backup.${Date.now()}`;
      fs.cpSync(frontendPath, backupPath, { recursive: true });
      logger.info(`Backup: ${backupPath}`);
    }
    
    // Generate
    if (!checkOnly && frontendPath) {
      if (dryRun) {
        logger.info(`Would generate ${parsed.classes.length + parsed.enums.length + 1} files`);
      } else {
        await generateTypeScript({ outputPath: frontendPath, parsed });
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.success(`Generated ${parsed.classes.length + parsed.enums.length + 1} files in ${elapsed}s`);
      }
    }
    
    if (failOnBreaking && diff.hasBreakingChanges && !isSyncMode) {
      process.exit(EXIT_CODES.BREAKING_CHANGE);
    }
    
  } catch (error) {
    logger.error(`Failed: ${error}`);
    process.exit(EXIT_CODES.UNKNOWN_ERROR);
  }
}