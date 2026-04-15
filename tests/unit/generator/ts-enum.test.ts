import { describe, it, expect } from 'vitest';
import { generateEnum } from '../../../src/core/generator/ts-enum';
import { DTOClass } from '../../../src/types/dto.types';

describe('ts-enum', () => {
  describe('generateEnum', () => {
    it('should generate simple enum', () => {
      const enumDto: DTOClass = {
        className: 'Status',
        packageName: 'com.example',
        fields: [],
        imports: [],
        isEnum: true,
        enumValues: ['PENDING', 'ACTIVE', 'COMPLETED'],
        filePath: 'Status.java'
      };

      const result = generateEnum(enumDto);
      expect(result).toContain('export enum Status {');
      expect(result).toContain("PENDING = 'PENDING'");
      expect(result).toContain("ACTIVE = 'ACTIVE'");
      expect(result).toContain("COMPLETED = 'COMPLETED'");
    });

    it('should generate enum with single value', () => {
      const enumDto: DTOClass = {
        className: 'Singleton',
        packageName: 'com.example',
        fields: [],
        imports: [],
        isEnum: true,
        enumValues: ['ONLY'],
        filePath: 'Singleton.java'
      };

      const result = generateEnum(enumDto);
      expect(result).toContain("ONLY = 'ONLY'");
      expect(result).not.toContain(',');
    });

    it('should handle empty enum values', () => {
      const enumDto: DTOClass = {
        className: 'Empty',
        packageName: 'com.example',
        fields: [],
        imports: [],
        isEnum: true,
        enumValues: [],
        filePath: 'Empty.java'
      };

      const result = generateEnum(enumDto);
      expect(result).toContain('export enum Empty {');
      expect(result).toContain('}');
    });
  });
});