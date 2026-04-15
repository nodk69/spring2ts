import { describe, it, expect } from 'vitest';
import { compareDTOs } from '../../../src/core/diff/comparator';
import { ParsedDTO } from '../../../src/types/dto.types';

describe('comparator', () => {
  const createBaseParsed = (): ParsedDTO => ({
    classes: [
      {
        className: 'UserDto',
        packageName: 'com.example',
        fields: [
          { name: 'id', javaType: 'Long', tsType: 'number', nullable: true, isEnum: false, annotations: [] },
          { name: 'name', javaType: 'String', tsType: 'string', nullable: false, isEnum: false, annotations: ['NotNull'] },
          { name: 'email', javaType: 'String', tsType: 'string', nullable: true, isEnum: false, annotations: [] }
        ],
        imports: [],
        isEnum: false,
        filePath: 'UserDto.java'
      }
    ],
    enums: [
      {
        className: 'Status',
        packageName: 'com.example',
        fields: [],
        imports: [],
        isEnum: true,
        enumValues: ['ACTIVE', 'INACTIVE'],
        filePath: 'Status.java'
      }
    ]
  });

  describe('field changes', () => {
    it('should detect field removal as BREAKING', () => {
      const oldParsed = createBaseParsed();
      const newParsed = createBaseParsed();
      newParsed.classes[0].fields = newParsed.classes[0].fields.filter(f => f.name !== 'email');

      const result = compareDTOs(oldParsed, newParsed);
      expect(result.hasBreakingChanges).toBe(true);
      expect(result.changes).toContainEqual(expect.objectContaining({
        type: 'FIELD_REMOVED',
        severity: 'BREAKING',
        className: 'UserDto',
        fieldName: 'email'
      }));
    });

    it('should detect type change as BREAKING', () => {
      const oldParsed = createBaseParsed();
      const newParsed = createBaseParsed();
      const emailField = newParsed.classes[0].fields.find(f => f.name === 'email')!;
      emailField.javaType = 'Integer';
      emailField.tsType = 'number';

      const result = compareDTOs(oldParsed, newParsed);
      expect(result.hasBreakingChanges).toBe(true);
      expect(result.changes).toContainEqual(expect.objectContaining({
        type: 'TYPE_CHANGED',
        severity: 'BREAKING',
        className: 'UserDto',
        fieldName: 'email'
      }));
    });

    it('should detect required field addition as WARNING', () => {
      const oldParsed = createBaseParsed();
      const newParsed = createBaseParsed();
      newParsed.classes[0].fields.push({
        name: 'phone',
        javaType: 'String',
        tsType: 'string',
        nullable: false,
        isEnum: false,
        annotations: ['NotNull']
      });

      const result = compareDTOs(oldParsed, newParsed);
      expect(result.summary.warning).toBe(1);
      expect(result.changes).toContainEqual(expect.objectContaining({
        type: 'FIELD_ADDED',
        severity: 'WARNING',
        className: 'UserDto',
        fieldName: 'phone'
      }));
    });

    it('should detect optional field addition as SAFE', () => {
      const oldParsed = createBaseParsed();
      const newParsed = createBaseParsed();
      newParsed.classes[0].fields.push({
        name: 'nickname',
        javaType: 'String',
        tsType: 'string',
        nullable: true,
        isEnum: false,
        annotations: []
      });

      const result = compareDTOs(oldParsed, newParsed);
      expect(result.summary.safe).toBe(1);
      expect(result.changes).toContainEqual(expect.objectContaining({
        type: 'FIELD_ADDED',
        severity: 'SAFE',
        className: 'UserDto',
        fieldName: 'nickname'
      }));
    });

    it('should detect nullability change to required as WARNING', () => {
      const oldParsed = createBaseParsed();
      const newParsed = createBaseParsed();
      const emailField = newParsed.classes[0].fields.find(f => f.name === 'email')!;
      emailField.nullable = false;

      const result = compareDTOs(oldParsed, newParsed);
      expect(result.summary.warning).toBe(1);
      expect(result.changes).toContainEqual(expect.objectContaining({
        type: 'NULLABILITY_CHANGED',
        severity: 'WARNING',
        className: 'UserDto',
        fieldName: 'email'
      }));
    });
  });

  describe('class changes', () => {
    it('should detect class removal as BREAKING', () => {
      const oldParsed = createBaseParsed();
      const newParsed: ParsedDTO = { classes: [], enums: [] };

      const result = compareDTOs(oldParsed, newParsed);
      expect(result.hasBreakingChanges).toBe(true);
      expect(result.changes).toContainEqual(expect.objectContaining({
        type: 'CLASS_REMOVED',
        severity: 'BREAKING',
        className: 'UserDto'
      }));
    });

    it('should detect class addition as SAFE', () => {
      const oldParsed: ParsedDTO = { classes: [], enums: [] };
      const newParsed = createBaseParsed();

      const result = compareDTOs(oldParsed, newParsed);
      expect(result.changes).toContainEqual(expect.objectContaining({
        type: 'CLASS_ADDED',
        severity: 'SAFE',
        className: 'UserDto'
      }));
    });
  });

  describe('enum changes', () => {
    it('should detect enum value removal as BREAKING', () => {
      const oldParsed = createBaseParsed();
      const newParsed = createBaseParsed();
      newParsed.enums[0].enumValues = ['ACTIVE'];

      const result = compareDTOs(oldParsed, newParsed);
      expect(result.hasBreakingChanges).toBe(true);
      expect(result.changes).toContainEqual(expect.objectContaining({
        type: 'ENUM_VALUE_REMOVED',
        severity: 'BREAKING',
        className: 'Status'
      }));
    });

    it('should detect enum value addition as SAFE', () => {
      const oldParsed = createBaseParsed();
      const newParsed = createBaseParsed();
      newParsed.enums[0].enumValues = ['ACTIVE', 'INACTIVE', 'PENDING'];

      const result = compareDTOs(oldParsed, newParsed);
      expect(result.changes).toContainEqual(expect.objectContaining({
        type: 'ENUM_VALUE_ADDED',
        severity: 'SAFE',
        className: 'Status'
      }));
    });
  });

  describe('no changes', () => {
    it('should return empty changes when identical', () => {
      const oldParsed = createBaseParsed();
      const newParsed = createBaseParsed();

      const result = compareDTOs(oldParsed, newParsed);
      expect(result.hasBreakingChanges).toBe(false);
      expect(result.changes).toHaveLength(0);
    });
  });
});