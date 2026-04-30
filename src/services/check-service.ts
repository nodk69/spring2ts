/**
 * Check command service - Validates for breaking changes
 */

import chalk from 'chalk';
import { BaseService, ServiceResult } from './base-service';
import { loadPaths } from '../cli/options';
import { sync } from '../cli/commands';
import { parseDTOs } from '../core/parser';
import { validateGeneratedTypes } from '../core/validation/type-check';
import { EXIT_CODES } from '../constants/exit-codes';
import { logger } from '../utils/logger';

export interface CheckOptions {
  backend?: string;
  frontend?: string;
}

export class CheckService extends BaseService {
  constructor() {
    super('Check');
  }

  async execute(options: CheckOptions): Promise<ServiceResult> {
    try {
      const paths = loadPaths(options.backend, options.frontend);
      const backendPath = paths.backend.path;
      const frontendPath = paths.frontend.path;
      const configLoaded = paths.backend.fromConfig || paths.frontend.fromConfig;

      if (!backendPath) {
        console.error(chalk.red('No backend path specified.'));
        console.error(chalk.yellow('Run `spring2ts init` first, or use --backend <path>'));
        return {
          success: false,
          exitCode: 1,
          message: 'No backend path specified'
        };
      }

      if (configLoaded) {
        console.log(chalk.gray(`Using config: ${backendPath} -> ${frontendPath}`));
      }

      console.log(chalk.cyan('Checking for breaking changes...'));

      await sync({
        backend: backendPath,
        frontend: frontendPath,
        check: true,
        failOnBreaking: true
      });

      console.log(chalk.cyan('Validating generated TypeScript...'));

      const parsed = await parseDTOs({
        inputPath: backendPath,
        excludePatterns: [],
        includeNested: true
      });
      const typeCheck = await validateGeneratedTypes(parsed);

      if (!typeCheck.success) {
        logger.error('Generated TypeScript has type errors.');
        for (const diagnostic of typeCheck.diagnostics) {
          const location =
            diagnostic.filePath && diagnostic.line && diagnostic.column
              ? `${diagnostic.filePath}:${diagnostic.line}:${diagnostic.column}`
              : 'generated types';
          console.error(chalk.red(`  - ${location} ${diagnostic.message}`));
        }

        return {
          success: false,
          exitCode: EXIT_CODES.TYPE_ERROR,
          message: 'Generated TypeScript failed validation'
        };
      }

      logger.success('Generated TypeScript validation passed.');

      return {
        success: true,
        message: 'No breaking changes or type issues detected'
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
}
