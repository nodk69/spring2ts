/**
 * Gen command service - Generates TypeScript types
 */

import chalk from 'chalk';
import { BaseService, ServiceResult } from './base-service';
import { loadPaths } from '../cli/options';
import { sync } from '../cli/commands';

export interface GenOptions {
  backend?: string;
  frontend?: string;
  dryRun?: boolean;
  backup?: boolean;
  safe?: boolean;
  merge?: boolean;
  incremental?: boolean;
}

export class GenService extends BaseService {
  constructor() {
    super('Generate');
  }

  async execute(options: GenOptions): Promise<ServiceResult> {
    try {
      const paths = loadPaths(options.backend, options.frontend);
      const backendPath = paths.backend.path;
      const frontendPath = paths.frontend.path;
      const configLoaded = paths.backend.fromConfig || paths.frontend.fromConfig;

      if (configLoaded) {
        console.log(chalk.gray(`Using config: ${backendPath} -> ${frontendPath}`));
      }

      const modes: string[] = [];
      if (options.dryRun) {
        console.log(chalk.yellow('DRY RUN - No files will be written'));
        modes.push('dry-run');
      }
      if (options.backup) {
        console.log(chalk.yellow('Backup enabled - existing types will be backed up'));
        modes.push('backup');
      }
      if (options.safe) {
        console.log(chalk.yellow('Safe mode - will abort if breaking changes detected'));
        modes.push('safe');
      }
      if (!options.merge) {
        console.log(chalk.yellow('Merge disabled - files will be overwritten'));
        modes.push('overwrite');
      }
      if (options.incremental) {
        console.log(chalk.yellow('Incremental generation enabled'));
        modes.push('incremental');
      }

      console.log(chalk.green('Generating TypeScript types...'));

      await sync({
        backend: backendPath,
        frontend: frontendPath,
        check: false,
        failOnBreaking: options.safe || false,
        dryRun: options.dryRun || false,
        backup: options.backup || false,
        safe: options.safe || false,
        merge: options.merge,
        incremental: options.incremental || false,
      });

      return {
        success: true,
        message: options.dryRun ? 'Dry run completed' : 'Types generated successfully',
        data: { modes },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
}
