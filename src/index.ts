#!/usr/bin/env node

import { Command } from 'commander';
import {
  InitService,
  CheckService,
  GenService,
  SyncService,
  ValidateService,
  DetectService,
  ParseService
} from './services';

const program = new Command();

program
  .name('spring2ts')
  .description('Zero-config sync between Spring Boot DTOs and TypeScript types')
  .version('0.3.0');

// spring2ts init
program
  .command('init')
  .description('Initialize Spring2TS in your project')
  .option('-b, --backend <path>', 'Path to backend DTO folder')
  .option('-f, --frontend <path>', 'Output path for TypeScript types')
  .action(async (options) => {
    const service = new InitService();
    const result = await service.execute(options);
    if (!result.success && result.exitCode) {
      process.exit(result.exitCode);
    }
  });

// spring2ts check
program
  .command('check')
  .description('Check for breaking changes and generated TypeScript errors')
  .option('-b, --backend <path>', 'Path to backend DTO folder')
  .option('-f, --frontend <path>', 'Path to frontend source folder')
  .option('--fail-on-breaking', 'Exit with code 3 on breaking changes')
  .action(async (options) => {
    const service = new CheckService();
    const result = await service.execute(options);
    if (!result.success && result.exitCode) {
      process.exit(result.exitCode);
    }
  });

// spring2ts gen
program
  .command('gen')
  .description('Generate TypeScript types')
  .option('-b, --backend <path>', 'Path to backend DTO folder')
  .option('-f, --frontend <path>', 'Output path for TypeScript types')
  .option('--dry-run', 'Show what would be generated without writing files')
  .option('--backup', 'Backup existing types before generating')
  .option('--safe', 'Abort if breaking changes detected')
  .option('--no-merge', 'Disable incremental updates (overwrite all files)')
  .option('--incremental', 'Only regenerate files whose Java source changed')
  .action(async (options) => {
    const service = new GenService();
    const result = await service.execute(options);
    if (!result.success && result.exitCode) {
      process.exit(result.exitCode);
    }
  });

// spring2ts sync
program
  .command('sync')
  .description('Generate types and update baseline (accepts breaking changes)')
  .option('-b, --backend <path>', 'Path to backend DTO folder')
  .option('-f, --frontend <path>', 'Output path for TypeScript types')
  .option('--dry-run', 'Show what would change without writing files')
  .option('--backup', 'Backup existing types before generating')
  .option('--no-merge', 'Disable incremental updates (overwrite all files)')
  .option('--incremental', 'Only regenerate files whose Java source changed')
  .action(async (options) => {
    const service = new SyncService();
    const result = await service.execute(options);
    if (!result.success && result.exitCode) {
      process.exit(result.exitCode);
    }
  });

// spring2ts validate
program
  .command('validate')
  .description('Validate that generated TypeScript compiles cleanly')
  .option('-b, --backend <path>', 'Path to backend DTO folder')
  .option('-u, --url <url>', 'Base URL of running backend')
  .option('--validate-responses', 'Call GET APIs and compare live responses against DTOs and OpenAPI')
  .option('--sample-size <number>', 'Number of array items to inspect per endpoint', (value) => parseInt(value, 10), 3)
  .option('--timeout <seconds>', 'Timeout per request in seconds', (value) => parseInt(value, 10), 5)
  .option('--include-auth', 'Include endpoints that require authentication')
  .option('--endpoints <paths>', 'Comma-separated list of endpoints to validate')
  .action(async (options) => {
    const service = new ValidateService();
    const result = await service.execute(options);
    if (!result.success && result.exitCode) {
      process.exit(result.exitCode);
    }
  });

// spring2ts detect
program
  .command('detect')
  .description('Auto-detect project structure and existing types')
  .action(async () => {
    const service = new DetectService();
    await service.execute();
  });

// Hidden debug command
program
  .command('parse')
  .description('Parse DTOs and output JSON (for debugging)')
  .option('-b, --backend <path>', 'Path to backend DTO folder')
  .action(async (options) => {
    const service = new ParseService();
    const result = await service.execute(options);
    if (!result.success && result.exitCode) {
      process.exit(result.exitCode);
    }
  });

// Show help if no command
if (process.argv.length === 2) {
  program.help();
}

program.parse();
