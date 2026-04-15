import { describe, it, expect } from 'vitest';
import { 
  BREAKING_CHANGE_RULES, 
  WARNING_RULES, 
  SAFE_RULES,
  getAllRules,
  isBreakingChange,
  isWarning,
  isSafe
} from '../../../src/core/diff/rules';
import { DTOClass, DTOField } from '../../../src/types/dto.types';

describe('diff rules', () => {
  const createContext = (oldField?: DTOField, newField?: DTOField) => ({
    oldClass: { className: 'TestDto' } as DTOClass,
    newClass: { className: 'TestDto' } as DTOClass,
    oldField,
    newField
  });

  describe('BREAKING_CHANGE_RULES', () => {
    it('should have field-removed rule', () => {
      const rule = BREAKING_CHANGE_RULES.find(r => r.name === 'field-removed')!;
      expect(rule).toBeDefined();
      expect(rule.severity).toBe('BREAKING');
      
      const ctx = createContext(
        { name: 'field', javaType: 'String', tsType: 'string', nullable: true, isEnum: false, annotations: [] },
        undefined
      );
      expect(rule.check(ctx)).toBe(true);
    });

    it('should have type-changed rule', () => {
      const rule = BREAKING_CHANGE_RULES.find(r => r.name === 'type-changed')!;
      expect(rule).toBeDefined();
      expect(rule.severity).toBe('BREAKING');
      
      const ctx = createContext(
        { name: 'field', javaType: 'String', tsType: 'string', nullable: true, isEnum: false, annotations: [] },
        { name: 'field', javaType: 'Integer', tsType: 'number', nullable: true, isEnum: false, annotations: [] }
      );
      expect(rule.check(ctx)).toBe(true);
    });
  });

  describe('WARNING_RULES', () => {
    it('should have required-field-added rule', () => {
      const rule = WARNING_RULES.find(r => r.name === 'required-field-added')!;
      expect(rule).toBeDefined();
      expect(rule.severity).toBe('WARNING');
      
      const ctx = createContext(
        undefined,
        { name: 'newField', javaType: 'String', tsType: 'string', nullable: false, isEnum: false, annotations: ['NotNull'] }
      );
      expect(rule.check(ctx)).toBe(true);
    });

    it('should have nullability-changed-to-required rule', () => {
      const rule = WARNING_RULES.find(r => r.name === 'nullability-changed-to-required')!;
      expect(rule).toBeDefined();
      expect(rule.severity).toBe('WARNING');
      
      const ctx = createContext(
        { name: 'field', javaType: 'String', tsType: 'string', nullable: true, isEnum: false, annotations: [] },
        { name: 'field', javaType: 'String', tsType: 'string', nullable: false, isEnum: false, annotations: ['NotNull'] }
      );
      expect(rule.check(ctx)).toBe(true);
    });
  });

  describe('SAFE_RULES', () => {
    it('should have optional-field-added rule', () => {
      const rule = SAFE_RULES.find(r => r.name === 'optional-field-added')!;
      expect(rule).toBeDefined();
      expect(rule.severity).toBe('SAFE');
      
      const ctx = createContext(
        undefined,
        { name: 'newField', javaType: 'String', tsType: 'string', nullable: true, isEnum: false, annotations: [] }
      );
      expect(rule.check(ctx)).toBe(true);
    });

    it('should have nullability-changed-to-nullable rule', () => {
      const rule = SAFE_RULES.find(r => r.name === 'nullability-changed-to-nullable')!;
      expect(rule).toBeDefined();
      expect(rule.severity).toBe('SAFE');
      
      const ctx = createContext(
        { name: 'field', javaType: 'String', tsType: 'string', nullable: false, isEnum: false, annotations: ['NotNull'] },
        { name: 'field', javaType: 'String', tsType: 'string', nullable: true, isEnum: false, annotations: [] }
      );
      expect(rule.check(ctx)).toBe(true);
    });
  });

  describe('getAllRules', () => {
    it('should return all rules', () => {
      const allRules = getAllRules();
      expect(allRules.length).toBe(
        BREAKING_CHANGE_RULES.length + WARNING_RULES.length + SAFE_RULES.length
      );
    });
  });

  describe('severity helpers', () => {
    it('isBreakingChange should return true for BREAKING', () => {
      expect(isBreakingChange('BREAKING')).toBe(true);
      expect(isBreakingChange('WARNING')).toBe(false);
      expect(isBreakingChange('SAFE')).toBe(false);
    });

    it('isWarning should return true for WARNING', () => {
      expect(isWarning('BREAKING')).toBe(false);
      expect(isWarning('WARNING')).toBe(true);
      expect(isWarning('SAFE')).toBe(false);
    });

    it('isSafe should return true for SAFE', () => {
      expect(isSafe('BREAKING')).toBe(false);
      expect(isSafe('WARNING')).toBe(false);
      expect(isSafe('SAFE')).toBe(true);
    });
  });
});