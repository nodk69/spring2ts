import { DTOClass, DTOField } from '../../types/dto.types';
import { Change, Severity } from '../../types/diff.types';

/**
 * Breaking change detection rules
 */

export interface RuleContext {
  oldClass: DTOClass;
  newClass: DTOClass;
  oldField?: DTOField;  // 🔥 Optional - may not exist if field was added
  newField?: DTOField;  // 🔥 Optional - may not exist if field was removed
}

export interface Rule {
  name: string;
  description: string;
  severity: Severity;
  check: (ctx: RuleContext) => boolean;
  message: (ctx: RuleContext) => string;
}

/**
 * All breaking change detection rules
 */
export const BREAKING_CHANGE_RULES: Rule[] = [
  {
    name: 'field-removed',
    description: 'Field removed from DTO',
    severity: 'BREAKING',
    check: (ctx) => !ctx.newField && !!ctx.oldField,
    message: (ctx) => `Field ${ctx.oldClass.className}.${ctx.oldField!.name} was removed`,
  },
  {
    name: 'type-changed',
    description: 'Field type changed',
    severity: 'BREAKING',
    check: (ctx) => {
      if (!ctx.oldField || !ctx.newField) return false;
      return ctx.oldField.tsType !== ctx.newField.tsType;
    },
    message: (ctx) => {
      return `Type of ${ctx.newClass.className}.${ctx.newField!.name} changed from ${ctx.oldField!.javaType} to ${ctx.newField!.javaType} (TS: ${ctx.oldField!.tsType} → ${ctx.newField!.tsType})`;
    },
  },
  {
    name: 'enum-value-removed',
    description: 'Enum value removed',
    severity: 'BREAKING',
    check: () => false, // Handled separately
    message: () => '',
  },
  {
    name: 'class-removed',
    description: 'Entire DTO class removed',
    severity: 'BREAKING',
    check: () => false, // Handled separately
    message: () => '',
  },
];

export const WARNING_RULES: Rule[] = [
  {
    name: 'required-field-added',
    description: 'New required field added',
    severity: 'WARNING',
    check: (ctx) => {
      if (!ctx.newField || ctx.oldField) return false;
      return !ctx.newField.nullable;
    },
    message: (ctx) => `Field ${ctx.newClass.className}.${ctx.newField!.name} was added (required - may break frontend)`,
  },
  {
    name: 'nullability-changed-to-required',
    description: 'Nullable field became required',
    severity: 'WARNING',
    check: (ctx) => {
      if (!ctx.oldField || !ctx.newField) return false;
      return ctx.oldField.nullable && !ctx.newField.nullable;
    },
    message: (ctx) => `Nullability of ${ctx.newClass.className}.${ctx.newField!.name} changed from nullable to required`,
  },
];

export const SAFE_RULES: Rule[] = [
  {
    name: 'optional-field-added',
    description: 'New optional field added',
    severity: 'SAFE',
    check: (ctx) => {
      if (!ctx.newField || ctx.oldField) return false;
      return ctx.newField.nullable;
    },
    message: (ctx) => `Field ${ctx.newClass.className}.${ctx.newField!.name} was added (SAFE)`,
  },
  {
    name: 'nullability-changed-to-nullable',
    description: 'Required field became nullable',
    severity: 'SAFE',
    check: (ctx) => {
      if (!ctx.oldField || !ctx.newField) return false;
      return !ctx.oldField.nullable && ctx.newField.nullable;
    },
    message: (ctx) => `Nullability of ${ctx.newClass.className}.${ctx.newField!.name} changed from required to nullable`,
  },
  {
    name: 'class-added',
    description: 'New DTO class added',
    severity: 'SAFE',
    check: () => false, // Handled separately
    message: () => '',
  },
  {
    name: 'enum-value-added',
    description: 'New enum value added',
    severity: 'SAFE',
    check: () => false, // Handled separately
    message: () => '',
  },
];

/**
 * Get all rules
 */
export function getAllRules(): Rule[] {
  return [...BREAKING_CHANGE_RULES, ...WARNING_RULES, ...SAFE_RULES];
}

/**
 * Check if a change is breaking
 */
export function isBreakingChange(severity: Severity): boolean {
  return severity === 'BREAKING';
}

/**
 * Check if a change is a warning
 */
export function isWarning(severity: Severity): boolean {
  return severity === 'WARNING';
}

/**
 * Check if a change is safe
 */
export function isSafe(severity: Severity): boolean {
  return severity === 'SAFE';
}