import { describe, it, expect } from 'vitest';
import { 
  extractAnnotations, 
  extractJsonPropertyName, 
  extractJsonAlias,
  extractEnumValues 
} from '../../../src/core/parser/annotation-parser';

describe('annotation-parser', () => {
  describe('extractAnnotations', () => {
    it('should extract single annotation', () => {
      const code = '@NotNull private String name;';
      expect(extractAnnotations(code)).toEqual(['NotNull']);
    });

    it('should extract multiple annotations', () => {
      const code = '@NotNull @JsonProperty("name") private String field;';
      expect(extractAnnotations(code)).toEqual(['NotNull', 'JsonProperty']);
    });

    it('should extract annotations with parameters', () => {
      const code = '@Size(min=1, max=100) private String name;';
      expect(extractAnnotations(code)).toEqual(['Size']);
    });

    it('should return empty array for no annotations', () => {
      const code = 'private String name;';
      expect(extractAnnotations(code)).toEqual([]);
    });
  });

  describe('extractJsonPropertyName', () => {
    it('should extract simple property name', () => {
      const code = '@JsonProperty("custom_name") private String field;';
      expect(extractJsonPropertyName(code)).toBe('custom_name');
    });

    it('should extract property name with value parameter', () => {
      const code = '@JsonProperty(value = "custom_name") private String field;';
      expect(extractJsonPropertyName(code)).toBe('custom_name');
    });

    it('should return null if no JsonProperty', () => {
      const code = '@NotNull private String field;';
      expect(extractJsonPropertyName(code)).toBeNull();
    });
  });

  describe('extractJsonAlias', () => {
    it('should extract single alias', () => {
      const code = '@JsonAlias({"phone"}) private String field;';
      expect(extractJsonAlias(code)).toEqual(['phone']);
    });

    it('should extract multiple aliases', () => {
      const code = '@JsonAlias({"phone", "mobile", "cell"}) private String field;';
      expect(extractJsonAlias(code)).toEqual(['phone', 'mobile', 'cell']);
    });

    it('should extract aliases without braces', () => {
      const code = '@JsonAlias("phone") private String field;';
      expect(extractJsonAlias(code)).toEqual(['phone']);
    });

    it('should return empty array if no JsonAlias', () => {
      const code = '@NotNull private String field;';
      expect(extractJsonAlias(code)).toEqual([]);
    });
  });

  describe('extractEnumValues', () => {
    it('should extract simple enum values', () => {
      const enumBody = 'VALUE_ONE, VALUE_TWO, VALUE_THREE';
      expect(extractEnumValues(enumBody)).toEqual(['VALUE_ONE', 'VALUE_TWO', 'VALUE_THREE']);
    });

    it('should extract enum values with parameters', () => {
      const enumBody = 'PENDING("Pending"), ACTIVE("Active"), DELETED("Deleted")';
      expect(extractEnumValues(enumBody)).toEqual(['PENDING', 'ACTIVE', 'DELETED']);
    });

    it('should handle empty enum body', () => {
      expect(extractEnumValues('')).toEqual([]);
    });
  });
});