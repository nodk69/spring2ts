#!/usr/bin/env node

import { Command } from 'commander';
import { sync } from './cli/commands';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

const program = new Command();

program
  .name('spring2ts')
  .description('Zero-config sync between Spring Boot DTOs and TypeScript types')
  .version('0.2.0');

// 🔥 spring2ts init
program
  .command('init')
  .description('Initialize Spring2TS in your project')
  .option('-b, --backend <path>', 'Path to backend DTO folder')
  .option('-f, --frontend <path>', 'Output path for TypeScript types')
  .action(async (options) => {
    const backendPath = options.backend || './backend/src/main/java';
    const frontendPath = options.frontend || './src/types';
    
    console.log(chalk.green('🚀 Initializing Spring2TS v2...'));
    console.log(chalk.blue(`   Backend: ${backendPath}`));
    console.log(chalk.blue(`   Frontend: ${frontendPath}`));
    
    const config = {
      backend: backendPath,
      frontend: frontendPath,
      failOnBreaking: true
    };
    
    const configPath = path.join(process.cwd(), '.spring2tsrc.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log(chalk.green(`✅ Created ${configPath}`));
    console.log(chalk.cyan('\n📋 Next steps:'));
    console.log('  • Run `spring2ts check` to verify setup');
    console.log('  • Run `spring2ts gen --dry-run` to preview changes');
    console.log('  • Run `spring2ts gen --safe` to generate safely');
    console.log('  • Add `spring2ts check` to your CI/CD');
    console.log('');
    
    try {
      await sync({ 
        backend: backendPath, 
        frontend: frontendPath,
        failOnBreaking: false
      });
    } catch (error) {
      console.error(chalk.red('Init failed:'), error);
    }
  });

// 🔥 spring2ts check
program
  .command('check')
  .description('Check for breaking changes (exits with code 3 if found)')
  .option('-b, --backend <path>', 'Path to backend DTO folder')
  .action(async (options) => {
    let backendPath = options.backend;
    let configLoaded = false;
    
    if (!backendPath) {
      try {
        const configPath = path.join(process.cwd(), '.spring2tsrc.json');
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          backendPath = config.backend;
          configLoaded = true;
        }
      } catch {
        // Ignore config errors
      }
    }
    
    if (!backendPath) {
      console.error(chalk.red('❌ No backend path specified.'));
      console.error(chalk.yellow('   Run `spring2ts init` first, or use --backend <path>'));
      process.exit(1);
    }
    
    if (configLoaded) {
      console.log(chalk.gray(`📁 Using config: ${backendPath}`));
    }
    
    console.log(chalk.cyan('🔍 Checking for breaking changes...'));
    
    await sync({ 
      backend: backendPath, 
      check: true, 
      failOnBreaking: true 
    });
  });

// 🔥 spring2ts gen (with new options)
program
  .command('gen')
  .description('Generate TypeScript types')
  .option('-b, --backend <path>', 'Path to backend DTO folder')
  .option('-f, --frontend <path>', 'Output path for TypeScript types')
  .option('--dry-run', 'Show what would be generated without writing files')
  .option('--backup', 'Backup existing types before generating')
  .option('--safe', 'Abort if breaking changes detected')
  .action(async (options) => {
    let backendPath = options.backend;
    let frontendPath = options.frontend;
    let configLoaded = false;
    
    try {
      const configPath = path.join(process.cwd(), '.spring2tsrc.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        backendPath = backendPath || config.backend;
        frontendPath = frontendPath || config.frontend;
        configLoaded = true;
      }
    } catch {
      // Ignore config errors
    }
    
    backendPath = backendPath || './backend/src/main/java';
    frontendPath = frontendPath || './src/types';
    
    if (configLoaded) {
      console.log(chalk.gray(`📁 Using config: ${backendPath} → ${frontendPath}`));
    }
    
    if (options.dryRun) {
      console.log(chalk.yellow('🔍 DRY RUN - No files will be written'));
    }
    if (options.backup) {
      console.log(chalk.yellow('💾 Backup enabled - existing types will be backed up'));
    }
    if (options.safe) {
      console.log(chalk.yellow('🛡️  Safe mode - will abort if breaking changes detected'));
    }
    
    console.log(chalk.green('📝 Generating TypeScript types...'));
    
    await sync({ 
      backend: backendPath, 
      frontend: frontendPath,
      check: false,
      failOnBreaking: options.safe || false,
      dryRun: options.dryRun || false,
      backup: options.backup || false,
      safe: options.safe || false
    });
  });

// 🔥 spring2ts sync (with new options)
program
  .command('sync')
  .description('Generate types and update baseline')
  .option('-b, --backend <path>', 'Path to backend DTO folder')
  .option('-f, --frontend <path>', 'Output path for TypeScript types')
  .option('--dry-run', 'Show what would change without writing files')
  .option('--backup', 'Backup existing types before generating')
  .action(async (options) => {
    let backendPath = options.backend;
    let frontendPath = options.frontend;
    
    try {
      const configPath = path.join(process.cwd(), '.spring2tsrc.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        backendPath = backendPath || config.backend;
        frontendPath = frontendPath || config.frontend;
      }
    } catch {
      // Ignore config errors
    }
    
    backendPath = backendPath || './backend/src/main/java';
    frontendPath = frontendPath || './src/types';
    
    if (options.dryRun) {
      console.log(chalk.yellow('🔍 DRY RUN - No files will be written'));
    }
    
    console.log(chalk.green('🔄 Syncing and updating baseline...'));
    
    await sync({ 
      backend: backendPath, 
      frontend: frontendPath,
      check: false,
      failOnBreaking: false,
      dryRun: options.dryRun || false,
      backup: options.backup || false
    });
  });

// 🔥 spring2ts validate (NEW COMMAND)
program
  .command('validate')
  .description('Validate generated types against runtime API')
  .option('-b, --backend <path>', 'Path to backend DTO folder')
  .option('-u, --url <url>', 'Base URL of running backend (e.g., http://localhost:8080)')
  .action(async (options) => {
    console.log(chalk.cyan('🔍 Validating types against runtime API...'));
    console.log(chalk.yellow('⚠️  This feature is in development.'));
    console.log(chalk.gray('   Will compare DTOs with actual API responses.'));
    // TODO: Implement runtime validation
  });

// 🔥 spring2ts detect (NEW COMMAND)
program
  .command('detect')
  .description('Auto-detect project structure and existing types')
  .action(async () => {
    console.log(chalk.cyan('🔍 Detecting project structure...'));
    console.log(chalk.yellow('⚠️  This feature is in development.'));
    console.log(chalk.gray('   Will scan for existing TypeScript types and suggest config.'));
    // TODO: Implement project detection
  });

// Hidden debug command
program
  .command('parse')
  .description('Parse DTOs and output JSON (for debugging)')
  .option('-b, --backend <path>', 'Path to backend DTO folder')
  .action(async (options) => {
    await sync({ ...options, frontend: undefined, check: false });
  });

// Show help if no command
if (process.argv.length === 2) {
  program.help();
}

program.parse();