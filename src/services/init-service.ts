/**
 * Init command service - Initializes Spring2TS configuration
 */

import chalk from 'chalk';
import { BaseService, ServiceResult } from './base-service';
import { loadPaths, saveConfig, Spring2TSConfig } from '../cli/options';
import { sync } from '../cli/commands';
import { pathExists } from '../utils/filesystem';
import { joinPaths, resolveFromCwd } from '../utils/paths';

export interface InitOptions {
  backend?: string;
  frontend?: string;
}

export class InitService extends BaseService {
  constructor() {
    super('Init');
  }

  async execute(options: InitOptions): Promise<ServiceResult> {
    try {
      const paths = loadPaths(options.backend, options.frontend);
      const backendPath = paths.backend.path;
      const frontendPath = paths.frontend.path;

      console.log(chalk.green('Initializing Spring2TS v0.3.0...'));
      console.log(chalk.blue(`   Backend: ${backendPath}`));
      console.log(chalk.blue(`   Frontend: ${frontendPath}`));

      const config: Spring2TSConfig = {
        backend: backendPath,
        frontend: frontendPath,
        failOnBreaking: true
      };

      saveConfig(config);

      const configPath = joinPaths(process.cwd(), '.spring2tsrc.json');
      console.log(chalk.green(`Created ${configPath}`));
      console.log(chalk.cyan('\nNext steps:'));
      console.log('  - Run `spring2ts check` to verify setup');
      console.log('  - Run `spring2ts gen --dry-run` to preview changes');
      console.log('  - Run `spring2ts gen --safe` to generate safely');
      console.log('  - Add `spring2ts check` to your CI/CD');
      console.log('');

      const resolvedBackendPath = resolveFromCwd(backendPath);
      if (!pathExists(resolvedBackendPath)) {
        console.log(chalk.yellow('Skipping initial sync because the backend path does not exist yet.'));
        return {
          success: true,
          data: { configPath, config }
        };
      }

      try {
        await sync({
          backend: backendPath,
          frontend: frontendPath,
          failOnBreaking: false
        });
      } catch (error) {
        console.error(chalk.red('Initial sync failed:'), error);
      }

      return {
        success: true,
        data: { configPath, config }
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
}
