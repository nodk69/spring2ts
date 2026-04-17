import chalk from 'chalk';
import { DiffResult, Change } from '../../types/diff.types';
import * as path from 'path';

export function printDiffReport(diff: DiffResult): void {
  console.log('');
  console.log(chalk.bold('📊 Breaking Change Report'));
  console.log(chalk.gray('─'.repeat(60)));
  
  if (diff.changes.length === 0) {
    console.log(chalk.green('✅ No changes detected!'));
    return;
  }
  
  // Group by severity
  const breaking = diff.changes.filter(c => c.severity === 'BREAKING');
  const warnings = diff.changes.filter(c => c.severity === 'WARNING');
  const safe = diff.changes.filter(c => c.severity === 'SAFE');
  
  if (breaking.length > 0) {
    console.log(chalk.red(`\n❌ BREAKING CHANGES (${breaking.length}):`));
    for (const change of breaking) {
      console.log(chalk.red(`   • ${change.message}`));
      if (change.filePath) {
        const relativePath = path.relative(process.cwd(), change.filePath);
        console.log(chalk.gray(`     📁 ${relativePath}`));
      }
      if (change.fieldName) {
        console.log(chalk.gray(`     📍 Field: ${change.fieldName}`));
      }
      console.log('');
    }
  }
  
  if (warnings.length > 0) {
    console.log(chalk.yellow(`\n⚠️  WARNINGS (${warnings.length}):`));
    for (const change of warnings) {
      console.log(chalk.yellow(`   • ${change.message}`));
      if (change.filePath) {
        const relativePath = path.relative(process.cwd(), change.filePath);
        console.log(chalk.gray(`     📁 ${relativePath}`));
      }
    }
  }
  
  if (safe.length > 0) {
    console.log(chalk.green(`\n✅ SAFE CHANGES (${safe.length}):`));
    for (const change of safe) {
      console.log(chalk.gray(`   • ${change.message}`));
    }
  }
  
  console.log('');
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.bold(`Summary: ${breaking.length} breaking, ${warnings.length} warnings, ${safe.length} safe`));
}

export function printCheckResult(diff: DiffResult, isSyncMode: boolean = false): void {
  printDiffReport(diff);
  
  if (diff.hasBreakingChanges) {
    if (isSyncMode) {
      console.log(chalk.yellow('\n⚠️  Breaking changes detected but accepted in sync mode.'));
      console.log(chalk.gray('   Baseline will be updated.'));
    } else {
      console.log(chalk.red('\n❌ Breaking changes detected! Cannot proceed.'));
      console.log(chalk.yellow('\n💡 To fix:'));
      console.log(chalk.gray('   1. Revert the breaking changes, OR'));
      console.log(chalk.gray('   2. Update frontend to handle new types, then run `spring2ts sync`'));
    }
  } else {
    console.log(chalk.green('\n✅ No breaking changes detected. Safe to proceed.'));
  }
}