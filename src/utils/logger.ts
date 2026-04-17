import chalk from 'chalk';

// Track if we're in verbose mode
const isVerbose = process.argv.includes('--verbose') || process.env.VERBOSE === '1';

// Track if we've shown certain warnings
const shownWarnings = new Set<string>();

export const logger = {
  // Headers and titles
  title: (message: string) => {
    console.log('');
    console.log(chalk.bold.cyan(`🚀 ${message}`));
  },
  
  // Section headers
  section: (message: string) => {
    console.log('');
    console.log(chalk.bold.white(` ${message}`));
  },
  
  // Key-value pairs (clean)
  kv: (key: string, value: string) => {
    console.log(`   ${chalk.gray(key)} ${value}`);
  },
  
  // Success messages (minimal)
  success: (message: string) => {
    console.log(chalk.green(`✅ ${message}`));
  },
  
  // Errors (loud - these matter)
  error: (message: string) => {
    console.error('');
    console.error(chalk.red(`❌ ${message}`));
  },
  
  // Warnings (shown once)
  warn: (message: string) => {
    if (!shownWarnings.has(message)) {
      shownWarnings.add(message);
      console.log(chalk.yellow(`⚠️  ${message}`));
    }
  },
  
  // Info (subtle)
  info: (message: string) => {
    console.log(chalk.blue('ℹ'), message);
  },
  
  // Debug (only in verbose mode)
  debug: (message: string) => {
    if (isVerbose) {
      console.log(chalk.gray(`   🔍 ${message}`));
    }
  },
  
  // Progress steps (clean)
  step: (step: number, total: number, message: string) => {
    console.log(chalk.cyan(`[${step}/${total}]`), message);
  },
  
  // Empty line for spacing
  blank: () => console.log(''),
  
  // Divider
  divider: () => console.log(chalk.gray('─'.repeat(50))),
};