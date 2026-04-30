import * as path from 'path';
import { ParsedDTO } from '../../types/dto.types';
import { DiffResult } from '../../types/diff.types';
import { loadSnapshot, createSnapshot, saveSnapshot } from '../storage/snapshot';
import { compareDTOs } from './comparator';
import { printCheckResult } from './reporter';
import { FrontendUsageReport } from '../../types/frontend-usage.types';

export interface CheckOptions {
  parsed: ParsedDTO;
  baselinePath: string;
  failOnBreaking: boolean;
  updateBaseline: boolean;
  isSyncMode?: boolean;
  frontendUsage?: FrontendUsageReport;
}

export async function checkBreakingChanges(options: CheckOptions): Promise<DiffResult> {
  const { parsed, baselinePath, failOnBreaking, updateBaseline, isSyncMode, frontendUsage } = options;
  
  const oldSnapshot = loadSnapshot(baselinePath);
  
  if (!oldSnapshot) {
    console.log('📸 No baseline snapshot found. Creating new baseline...');
    const snapshot = createSnapshot(parsed);
    saveSnapshot(snapshot, baselinePath);
    
    return {
      hasBreakingChanges: false,
      changes: [],
      summary: { breaking: 0, warning: 0, safe: 0 },
    };
  }
  
  const oldParsed: ParsedDTO = {
    classes: oldSnapshot.classes,
    enums: oldSnapshot.enums,
  };
  
  const diff = compareDTOs(oldParsed, parsed, frontendUsage);
  
  if (updateBaseline) {
    const newSnapshot = createSnapshot(parsed);
    saveSnapshot(newSnapshot, baselinePath);
  }
  
  printCheckResult(diff, isSyncMode);
  
  return diff;
}
