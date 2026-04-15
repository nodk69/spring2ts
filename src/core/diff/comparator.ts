import { ParsedDTO, DTOClass, DTOField } from '../../types/dto.types';
import { Change, DiffResult, Severity } from '../../types/diff.types';
import { 
  BREAKING_CHANGE_RULES, 
  WARNING_RULES, 
  SAFE_RULES,
  RuleContext 
} from './rules';

export function compareDTOs(oldParsed: ParsedDTO, newParsed: ParsedDTO): DiffResult {
  const changes: Change[] = [];
  
  const oldClassMap = new Map(oldParsed.classes.map(c => [c.className, c]));
  const newClassMap = new Map(newParsed.classes.map(c => [c.className, c]));
  
  const oldEnumMap = new Map(oldParsed.enums.map(e => [e.className, e]));
  const newEnumMap = new Map(newParsed.enums.map(e => [e.className, e]));
  
  // Check for removed classes
  for (const [className, oldClass] of oldClassMap) {
    if (!newClassMap.has(className)) {
      changes.push({
        type: 'CLASS_REMOVED',
        severity: 'BREAKING',
        className,
        message: `Class ${className} was removed`,
        filePath: oldClass.filePath,
      });
    }
  }
  
  // Check for added classes
  for (const [className, newClass] of newClassMap) {
    if (!oldClassMap.has(className)) {
      changes.push({
        type: 'CLASS_ADDED',
        severity: 'SAFE',
        className,
        message: `Class ${className} was added`,
        filePath: newClass.filePath,
      });
    }
  }
  
  // Compare existing classes using rules
  for (const [className, newClass] of newClassMap) {
    const oldClass = oldClassMap.get(className);
    if (oldClass) {
      const classChanges = compareClassFieldsWithRules(oldClass, newClass);
      changes.push(...classChanges);
    }
  }
  
  // Compare enums
  for (const [className, newEnum] of newEnumMap) {
    const oldEnum = oldEnumMap.get(className);
    if (oldEnum) {
      const enumChanges = compareEnumValues(oldEnum, newEnum);
      changes.push(...enumChanges);
    }
  }
  
  const breaking = changes.filter(c => c.severity === 'BREAKING').length;
  const warning = changes.filter(c => c.severity === 'WARNING').length;
  const safe = changes.filter(c => c.severity === 'SAFE').length;
  
  return {
    hasBreakingChanges: breaking > 0,
    changes,
    summary: { breaking, warning, safe },
  };
}

function compareClassFieldsWithRules(oldClass: DTOClass, newClass: DTOClass): Change[] {
  const changes: Change[] = [];
  
  const oldFieldMap = new Map(oldClass.fields.map(f => [f.name, f]));
  const newFieldMap = new Map(newClass.fields.map(f => [f.name, f]));
  
  // Check all field combinations
  const allFieldNames = new Set([...oldFieldMap.keys(), ...newFieldMap.keys()]);
  
  for (const fieldName of allFieldNames) {
    const oldField = oldFieldMap.get(fieldName);
    const newField = newFieldMap.get(fieldName);
    
    const ctx: RuleContext = { oldClass, newClass, oldField, newField };
    
    // Check breaking rules
    for (const rule of BREAKING_CHANGE_RULES) {
      if (rule.check(ctx)) {
        changes.push({
          type: rule.name.toUpperCase().replace(/-/g, '_') as any,
          severity: rule.severity,
          className: newClass.className,
          fieldName,
          oldValue: oldField?.tsType,
          newValue: newField?.tsType,
          message: rule.message(ctx),
          filePath: newClass.filePath,
        });
        break; // Only apply first matching rule
      }
    }
    
    // Check warning rules (if no breaking rule matched)
    if (!changes.some(c => c.fieldName === fieldName && c.severity === 'BREAKING')) {
      for (const rule of WARNING_RULES) {
        if (rule.check(ctx)) {
          changes.push({
            type: rule.name.toUpperCase().replace(/-/g, '_') as any,
            severity: rule.severity,
            className: newClass.className,
            fieldName,
            message: rule.message(ctx),
            filePath: newClass.filePath,
          });
          break;
        }
      }
    }
    
    // Check safe rules (if no other rule matched)
    if (!changes.some(c => c.fieldName === fieldName)) {
      for (const rule of SAFE_RULES) {
        if (rule.check(ctx)) {
          changes.push({
            type: rule.name.toUpperCase().replace(/-/g, '_') as any,
            severity: rule.severity,
            className: newClass.className,
            fieldName,
            message: rule.message(ctx),
            filePath: newClass.filePath,
          });
          break;
        }
      }
    }
  }
  
  return changes;
}

function compareEnumValues(oldEnum: DTOClass, newEnum: DTOClass): Change[] {
  const changes: Change[] = [];
  
  const oldValues = new Set(oldEnum.enumValues || []);
  const newValues = new Set(newEnum.enumValues || []);
  
  for (const value of oldValues) {
    if (!newValues.has(value)) {
      changes.push({
        type: 'ENUM_VALUE_REMOVED',
        severity: 'BREAKING',
        className: oldEnum.className,
        oldValue: value,
        message: `Enum value ${oldEnum.className}.${value} was removed`,
        filePath: newEnum.filePath,
      });
    }
  }
  
  for (const value of newValues) {
    if (!oldValues.has(value)) {
      changes.push({
        type: 'ENUM_VALUE_ADDED',
        severity: 'SAFE',
        className: newEnum.className,
        newValue: value,
        message: `Enum value ${newEnum.className}.${value} was added`,
        filePath: newEnum.filePath,
      });
    }
  }
  
  return changes;
}