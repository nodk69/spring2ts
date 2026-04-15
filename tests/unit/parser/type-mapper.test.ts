import { describe, it, expect } from 'vitest';
import { 
  mapJavaTypeToTS, 
  isPrimitiveType, 
  isWrapperType,
  isNullable,
  isRequired,
  extractBaseType
} from '../../../src/core/parser/type-mapper';

describe('type-mapper', () => {
  describe('mapJavaTypeToTS', () => {
    it('should map primitive types', () => {
      expect(mapJavaTypeToTS('int')).toBe('number');
      expect(mapJavaTypeToTS('long')).toBe('number');
      expect(mapJavaTypeToTS('boolean')).toBe('boolean');
      expect(mapJavaTypeToTS('double')).toBe('number');
    });

    it('should map wrapper types', () => {
      expect(mapJavaTypeToTS('Integer')).toBe('number');
      expect(mapJavaTypeToTS('Long')).toBe('number');
      expect(mapJavaTypeToTS('Boolean')).toBe('boolean');
      expect(mapJavaTypeToTS('String')).toBe('string');
    });

    it('should map date/time types', () => {
      expect(mapJavaTypeToTS('LocalDateTime')).toBe('string');
      expect(mapJavaTypeToTS('LocalDate')).toBe('string');
      expect(mapJavaTypeToTS('Date')).toBe('string');
      expect(mapJavaTypeToTS('Instant')).toBe('string');
    });

    it('should map collection types', () => {
      expect(mapJavaTypeToTS('List<String>')).toBe('string[]');
      expect(mapJavaTypeToTS('Set<Integer>')).toBe('number[]');
      expect(mapJavaTypeToTS('ArrayList<Boolean>')).toBe('boolean[]');
    });

    it('should map Map types', () => {
      expect(mapJavaTypeToTS('Map<String, Integer>')).toBe('Record<string, number>');
      expect(mapJavaTypeToTS('HashMap<String, Object>')).toBe('Record<string, unknown>');
    });

    it('should map Optional types', () => {
      expect(mapJavaTypeToTS('Optional<String>')).toBe('string | null');
      expect(mapJavaTypeToTS('Optional<Long>')).toBe('number | null');
    });

    it('should map arrays', () => {
      expect(mapJavaTypeToTS('String[]')).toBe('string[]');
      expect(mapJavaTypeToTS('int[]')).toBe('number[]');
    });

    it('should handle known custom classes', () => {
      const knownClasses = new Set(['UserDto', 'OrderDto']);
      expect(mapJavaTypeToTS('UserDto', knownClasses)).toBe('UserDto');
      expect(mapJavaTypeToTS('List<OrderDto>', knownClasses)).toBe('OrderDto[]');
    });
  });

  describe('isPrimitiveType', () => {
    it('should identify primitive types', () => {
      expect(isPrimitiveType('int')).toBe(true);
      expect(isPrimitiveType('long')).toBe(true);
      expect(isPrimitiveType('boolean')).toBe(true);
    });

    it('should return false for non-primitives', () => {
      expect(isPrimitiveType('Integer')).toBe(false);
      expect(isPrimitiveType('String')).toBe(false);
    });
  });

  describe('isWrapperType', () => {
    it('should identify wrapper types', () => {
      expect(isWrapperType('Integer')).toBe(true);
      expect(isWrapperType('Long')).toBe(true);
      expect(isWrapperType('Boolean')).toBe(true);
    });

    it('should return false for primitives', () => {
      expect(isWrapperType('int')).toBe(false);
      expect(isWrapperType('long')).toBe(false);
    });
  });

  describe('isNullable', () => {
    it('should return false for primitive types', () => {
      expect(isNullable([], 'int')).toBe(false);
      expect(isNullable([], 'long')).toBe(false);
      expect(isNullable([], 'boolean')).toBe(false);
    });

    it('should return false if @NotNull present', () => {
      expect(isNullable(['NotNull'], 'String')).toBe(false);
      expect(isNullable(['NotNull'], 'Long')).toBe(false);
    });

    it('should return true for Optional types', () => {
      expect(isNullable([], 'Optional<String>')).toBe(true);
    });

    it('should return true if @Nullable present', () => {
      expect(isNullable(['Nullable'], 'String')).toBe(true);
    });

    it('should return true by default for wrapper types', () => {
      expect(isNullable([], 'String')).toBe(true);
      expect(isNullable([], 'Long')).toBe(true);
    });
  });

  describe('isRequired', () => {
    it('should detect NotNull annotation', () => {
      expect(isRequired(['NotNull'])).toBe(true);
    });

    it('should detect NotEmpty annotation', () => {
      expect(isRequired(['NotEmpty'])).toBe(true);
    });

    it('should detect NotBlank annotation', () => {
      expect(isRequired(['NotBlank'])).toBe(true);
    });

    it('should return false if no required annotation', () => {
      expect(isRequired(['Nullable'])).toBe(false);
      expect(isRequired([])).toBe(false);
    });
  });

  describe('extractBaseType', () => {
    it('should extract base type from generics', () => {
      expect(extractBaseType('List<String>')).toBe('List');
      expect(extractBaseType('Map<String, Integer>')).toBe('Map');
    });

    it('should extract base type from arrays', () => {
      expect(extractBaseType('String[]')).toBe('String');
      expect(extractBaseType('int[]')).toBe('int');
    });

    it('should return same type for simple types', () => {
      expect(extractBaseType('String')).toBe('String');
      expect(extractBaseType('Long')).toBe('Long');
    });
  });
});