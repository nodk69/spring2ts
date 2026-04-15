import * as path from 'path';
import { ParsedDTO } from '../../types/dto.types';
import { DiffResult } from '../../types/diff.types';
import { loadSnapshot, createSnapshot, saveSnapshot } from '../storage/snapshot';
import { compareDTOs } from './comparator';
import { printCheckResult } from './reporter';

export interface CheckOptions {
  parsed: ParsedDTO;
  baselinePath: string;
  failOnBreaking: boolean;
  updateBaseline: boolean;
}

export async function checkBreakingChanges(options: CheckOptions): Promise<DiffResult> {
  const { parsed, baselinePath, failOnBreaking, updateBaseline } = options;
  
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
  
  const diff = compareDTOs(oldParsed, parsed);
  
  if (updateBaseline) {
    const newSnapshot = createSnapshot(parsed);
    saveSnapshot(newSnapshot, baselinePath);
  }
  
  printCheckResult(diff);
  
  return diff;
}