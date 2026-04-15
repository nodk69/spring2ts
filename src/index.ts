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
  .version('0.1.0');

// 🔥 spring2ts init
program
  .command('init')
  .description('Initialize Spring2TS in your project')
  .option('-b, --backend <path>', 'Path to backend DTO folder')
  .option('-f, --frontend <path>', 'Output path for TypeScript types')
  .action(async (options) => {
    const backendPath = options.backend || './backend/src/main/java';
    const frontendPath = options.frontend || './src/types';
    
    console.log(chalk.green('🚀 Initializing Spring2TS...'));
    console.log(chalk.blue(`   Backend: ${backendPath}`));
    console.log(chalk.blue(`   Frontend: ${frontendPath}`));
    
    // Create config file
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
    console.log('  • Run `spring2ts gen` to generate types');
    console.log('  • Add `spring2ts check` to your CI/CD');
    console.log('');
    
    // Run initial sync
    try {
      await sync({ 
        backend: backendPath, 
        frontend: frontendPath,
        failOnBreaking: false  // Don't fail on init
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
    // Load config if exists
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

// 🔥 spring2ts gen
program
  .command('gen')
  .description('Generate TypeScript types')
  .option('-b, --backend <path>', 'Path to backend DTO folder')
  .option('-f, --frontend <path>', 'Output path for TypeScript types')
  .action(async (options) => {
    // Load config if exists
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
    
    console.log(chalk.green('📝 Generating TypeScript types...'));
    
    await sync({ 
      backend: backendPath, 
      frontend: frontendPath,
      check: false,
      failOnBreaking: false
    });
  });

// 🔥 spring2ts sync
program
  .command('sync')
  .description('Generate types and update baseline')
  .option('-b, --backend <path>', 'Path to backend DTO folder')
  .option('-f, --frontend <path>', 'Output path for TypeScript types')
  .action(async (options) => {
    // Load config if exists
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
    
    console.log(chalk.green('🔄 Syncing and updating baseline...'));
    
    await sync({ 
      backend: backendPath, 
      frontend: frontendPath,
      check: false,
      failOnBreaking: false
    });
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