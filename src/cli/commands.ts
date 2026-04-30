import { parseDTOs } from '../core/parser/index';
import { generateTypeScript } from '../core/generator/index';
import { checkBreakingChanges } from '../core/diff/index';
import { analyzeFrontendUsage, resolveFrontendUsageRoot } from '../core/frontend/usage-analyzer';
import { loadSnapshot } from '../core/storage/snapshot';
import { logger } from '../utils/logger';
import { copyDirectory, ensureDirectory, isDirectory, pathExists, writeTextFile } from '../utils/filesystem';
import { joinPaths, resolveFromCwd } from '../utils/paths';
import { EXIT_CODES } from '../constants/exit-codes';
import chalk from 'chalk';
import { SyncOptions, loadConfig, DEFAULT_CONFIG } from './options';

export async function sync(options: SyncOptions): Promise<void> {
  const startTime = Date.now();
  const config = loadConfig();
  
  let backendPath = options.backend || config.backend || DEFAULT_CONFIG.backend;
  let frontendPath = options.frontend || config.frontend || DEFAULT_CONFIG.frontend;
  
  backendPath = resolveFromCwd(backendPath);
  if (frontendPath) frontendPath = resolveFromCwd(frontendPath);
  
  const checkOnly = options.check || false;
  const failOnBreaking = options.failOnBreaking || config.failOnBreaking || false;
  const dryRun = options.dryRun || false;
  const backup = options.backup || false;
  const safe = options.safe || false;
  const isSyncMode = options.isSyncMode || false;
  const merge = options.merge !== false;
  const incremental = options.incremental || false;
  
  logger.title(`Spring2TS v0.3.0`);
  logger.kv('Backend: ', backendPath);
  if (!checkOnly) logger.kv('Frontend:', frontendPath);
  if (dryRun) logger.kv('Mode:   ', chalk.yellow('DRY RUN'));
  if (safe) logger.kv('Mode:   ', chalk.yellow('SAFE MODE'));
  if (isSyncMode) logger.kv('Mode:   ', chalk.cyan('SYNC (accepting changes)'));
  if (!merge) logger.kv('Mode:   ', chalk.yellow('OVERWRITE (no merge)'));
  if (incremental) logger.kv('Mode:   ', chalk.cyan('INCREMENTAL'));
  logger.blank();
  
  try {
    const parsed = await parseDTOs({ inputPath: backendPath, excludePatterns: [], includeNested: true });
    
    if (parsed.classes.length === 0 && parsed.enums.length === 0) {
      logger.warn(`No Java files found in ${backendPath}`);
    } else {
      logger.success(`Found ${parsed.classes.length} DTOs, ${parsed.enums.length} enums`);
    }
    
    const outputDir = joinPaths(process.cwd(), '.spring2ts');
    ensureDirectory(outputDir);
    writeTextFile(joinPaths(outputDir, 'parsed-dtos.json'), JSON.stringify(parsed, null, 2));

    const baselinePath = joinPaths(outputDir, 'baseline.json');
    const baselineSnapshot = loadSnapshot(baselinePath);

    let frontendUsage;
    if (frontendPath) {
      const frontendUsageRoot = resolveFrontendUsageRoot(frontendPath);
      if (isDirectory(frontendUsageRoot)) {
        const currentClasses = parsed.classes.map((dto) => dto.className);
        const baselineClasses = (baselineSnapshot?.classes || []).map((dto: { className: string }) => dto.className);
        const classNames = [...new Set([...currentClasses, ...baselineClasses])];
        const baselineFieldMap: Record<string, string[]> = Object.fromEntries(
          ((baselineSnapshot?.classes || []) as Array<{ className: string; fields: Array<{ name?: string; jsonName?: string }> }>).map((dto) => [
            dto.className,
            dto.fields
              .map((field) => field.jsonName || field.name)
              .filter((fieldName): fieldName is string => Boolean(fieldName)),
          ])
        );
        const currentFieldMap: Record<string, string[]> = Object.fromEntries(
          parsed.classes.map((dto) => [
            dto.className,
            dto.fields
              .map((field) => field.jsonName || field.name)
              .filter((fieldName): fieldName is string => Boolean(fieldName)),
          ])
        );
        const fieldNamesByClass: Record<string, string[]> = Object.fromEntries(
          classNames.map((className) => [
            className,
            [...new Set([...(baselineFieldMap[className] || []), ...(currentFieldMap[className] || [])])],
          ])
        );

        logger.info(`Analyzing frontend usage in ${frontendUsageRoot}`);
        frontendUsage = await analyzeFrontendUsage(
          frontendUsageRoot,
          classNames,
          fieldNamesByClass,
          [frontendPath]
        );
        writeTextFile(joinPaths(outputDir, 'frontend-usage.json'), JSON.stringify(frontendUsage, null, 2));
      } else if (checkOnly) {
        logger.warn(`Frontend path not found for usage analysis: ${frontendUsageRoot}`);
      }
    }

    const diff = await checkBreakingChanges({
      parsed,
      baselinePath,
      failOnBreaking: isSyncMode ? false : failOnBreaking,
      updateBaseline: !checkOnly || isSyncMode,
      isSyncMode,
      frontendUsage
    });
    
    if (safe && diff.hasBreakingChanges) {
      logger.error('Breaking changes detected. Aborted (--safe mode).');
      process.exit(EXIT_CODES.BREAKING_CHANGE);
    }
    
    if (backup && !checkOnly && frontendPath && !dryRun && pathExists(frontendPath)) {
      const backupPath = `${frontendPath}.backup.${Date.now()}`;
      copyDirectory(frontendPath, backupPath);
      logger.info(`Backup: ${backupPath}`);
    }
    
    if (!checkOnly && frontendPath) {
      if (dryRun) {
        logger.info(`Would generate ${parsed.classes.length + parsed.enums.length + 1} files`);
      } else {
        await generateTypeScript({ 
          outputPath: frontendPath, 
          parsed,
          merge,
          incremental
        });
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
