import chalk from 'chalk';
import { DiffResult, Change } from '../../types/diff.types';
import * as path from 'path';

export function printDiffReport(diff: DiffResult): void {
  console.log('');
  console.log(chalk.bold('Breaking Change Report'));
  console.log(chalk.gray('-'.repeat(60)));

  if (diff.changes.length === 0) {
    console.log(chalk.green('No changes detected.'));
    return;
  }

  const breaking = diff.changes.filter((change) => change.severity === 'BREAKING');
  const warnings = diff.changes.filter((change) => change.severity === 'WARNING');
  const safe = diff.changes.filter((change) => change.severity === 'SAFE');

  if (breaking.length > 0) {
    console.log(chalk.red(`\nBREAKING CHANGES (${breaking.length}):`));
    for (const change of breaking) {
      printChange(change, chalk.red);
    }
  }

  if (warnings.length > 0) {
    console.log(chalk.yellow(`\nWARNINGS (${warnings.length}):`));
    for (const change of warnings) {
      printChange(change, chalk.yellow);
    }
  }

  if (safe.length > 0) {
    console.log(chalk.green(`\nSAFE CHANGES (${safe.length}):`));
    for (const change of safe) {
      console.log(chalk.gray(`   - ${change.message}`));
    }
  }

  console.log('');
  console.log(chalk.gray('-'.repeat(60)));
  console.log(chalk.bold(`Summary: ${breaking.length} breaking, ${warnings.length} warnings, ${safe.length} safe`));
}

export function printCheckResult(diff: DiffResult, isSyncMode: boolean = false): void {
  printDiffReport(diff);

  if (diff.hasBreakingChanges) {
    if (isSyncMode) {
      console.log(chalk.yellow('\nBreaking changes detected but accepted in sync mode.'));
      console.log(chalk.gray('Baseline will be updated.'));
    } else {
      console.log(chalk.red('\nBreaking changes detected. Cannot proceed.'));
      console.log(chalk.yellow('\nTo fix:'));
      console.log(chalk.gray('  1. Revert the breaking changes, OR'));
      console.log(chalk.gray('  2. Update frontend to handle new types, then run `spring2ts sync`'));
    }
  } else {
    console.log(chalk.green('\nNo breaking changes detected. Safe to proceed.'));
  }
}

function printChange(change: Change, color: typeof chalk.red): void {
  console.log(color(`   - ${change.message}`));
  if (change.filePath) {
    console.log(chalk.gray(`     File: ${path.relative(process.cwd(), change.filePath)}`));
  }
  if (change.fieldName) {
    console.log(chalk.gray(`     Field: ${change.fieldName}`));
  }

  printFrontendUsage(change);
  console.log('');
}

function printFrontendUsage(change: Change): void {
  if (!change.frontendUsage) {
    return;
  }

  if (!change.frontendUsage.isUsed) {
    console.log(chalk.gray('     Frontend: no direct usage found'));
    return;
  }

  console.log(chalk.cyan(`     Frontend: used in ${change.frontendUsage.locations.length} location(s)`));
  for (const location of change.frontendUsage.locations.slice(0, 3)) {
    console.log(chalk.gray(`       - ${path.relative(process.cwd(), location.filePath)}:${location.line}`));
  }
}
