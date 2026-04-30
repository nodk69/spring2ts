/**
 * Sync command service - Generates types and updates baseline
 */

import chalk from 'chalk';
import { BaseService, ServiceResult } from './base-service';
import { loadPaths } from '../cli/options';
import { sync } from '../cli/commands';

export interface SyncCommandOptions {
  backend?: string;
  frontend?: string;
  dryRun?: boolean;
  backup?: boolean;
  merge?: boolean;
  incremental?: boolean;
}

export class SyncService extends BaseService {
  constructor() {
    super('Sync');
  }

  async execute(options: SyncCommandOptions): Promise<ServiceResult> {
    try {
      const paths = loadPaths(options.backend, options.frontend);
      const backendPath = paths.backend.path;
      const frontendPath = paths.frontend.path;

      const modes: string[] = [];
      if (options.dryRun) {
        console.log(chalk.yellow('DRY RUN - No files will be written'));
        modes.push('dry-run');
      }
      if (!options.merge) {
        console.log(chalk.yellow('Merge disabled - files will be overwritten'));
        modes.push('overwrite');
      }
      if (options.incremental) {
        console.log(chalk.yellow('Incremental generation enabled'));
        modes.push('incremental');
      }

      console.log(chalk.green('Syncing and updating baseline...'));

      await sync({
        backend: backendPath,
        frontend: frontendPath,
        check: false,
        failOnBreaking: false,
        dryRun: options.dryRun || false,
        backup: options.backup || false,
        isSyncMode: true,
        merge: options.merge,
        incremental: options.incremental || false,
      });

      return {
        success: true,
        message: options.dryRun ? 'Dry run completed' : 'Sync completed successfully',
        data: { modes },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
}
