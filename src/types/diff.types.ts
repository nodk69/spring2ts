export type ChangeType = 
  | 'FIELD_ADDED'
  | 'FIELD_REMOVED'
  | 'TYPE_CHANGED'
  | 'NULLABILITY_CHANGED'
  | 'ENUM_VALUE_ADDED'
  | 'ENUM_VALUE_REMOVED'
  | 'CLASS_ADDED'
  | 'CLASS_REMOVED';

export type Severity = 'BREAKING' | 'WARNING' | 'SAFE';

export interface Change {
  type: ChangeType;
  severity: Severity;
  className: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  message: string;
   filePath?: string;     
  lineNumber?: number;
}

export interface DiffResult {
  hasBreakingChanges: boolean;
  changes: Change[];
  summary: {
    breaking: number;
    warning: number;
    safe: number;
  };
}

export interface Snapshot {
  timestamp: string;
  version: string;
  classes: any[];
  enums: any[];
}