import { describe, it, expect } from 'vitest';
import { 
  extractPackageName,
  extractImports,
  extractClassName,
  extractExtends,
  extractImplements,
  isEnum,
  extractFields,
  extractDTOFromContent,
  resolveInheritance
} from '../../../src/core/parser/dto-extractor';
import { DTOClass } from '../../../src/types/dto.types';

describe('dto-extractor', () => {
  describe('extractPackageName', () => {
    it('should extract package name', () => {
      const content = 'package com.example.dto;';
      expect(extractPackageName(content)).toBe('com.example.dto');
    });

    it('should extract package name with spaces', () => {
      const content = 'package  com.example.dto ;';
      expect(extractPackageName(content)).toBe('com.example.dto');
    });

    it('should return empty string if no package', () => {
      const content = 'public class UserDto {}';
      expect(extractPackageName(content)).toBe('');
    });
  });

  describe('extractImports', () => {
    it('should extract single import', () => {
      const content = 'import java.util.List;';
      expect(extractImports(content)).toEqual(['java.util.List']);
    });

    it('should extract multiple imports', () => {
      const content = `
        import java.util.List;
        import java.time.LocalDateTime;
        import com.example.BaseDto;
      `;
      expect(extractImports(content)).toEqual([
        'java.util.List',
        'java.time.LocalDateTime',
        'com.example.BaseDto'
      ]);
    });

    it('should extract static imports', () => {
      const content = 'import static java.util.Collections.emptyList;';
      expect(extractImports(content)).toEqual(['java.util.Collections.emptyList']);
    });

    it('should return empty array if no imports', () => {
      const content = 'public class UserDto {}';
      expect(extractImports(content)).toEqual([]);
    });
  });

  describe('extractClassName', () => {
    it('should extract class name', () => {
      const content = 'public class UserDto { }';
      expect(extractClassName(content)).toBe('UserDto');
    });

    it('should extract class name without public', () => {
      const content = 'class UserDto { }';
      expect(extractClassName(content)).toBe('UserDto');
    });

    it('should extract interface name', () => {
      const content = 'public interface UserService { }';
      expect(extractClassName(content)).toBe('UserService');
    });

    it('should extract enum name', () => {
      const content = 'public enum Status { }';
      expect(extractClassName(content)).toBe('Status');
    });

    it('should extract record name', () => {
      const content = 'public record UserRecord(String name) { }';
      expect(extractClassName(content)).toBe('UserRecord');
    });

    it('should return empty string if no class', () => {
      const content = 'package com.example;';
      expect(extractClassName(content)).toBe('');
    });
  });

  describe('extractExtends', () => {
    it('should extract extends class', () => {
      const content = 'public class ChildDto extends ParentDto { }';
      expect(extractExtends(content)).toBe('ParentDto');
    });

    it('should return undefined if no extends', () => {
      const content = 'public class UserDto { }';
      expect(extractExtends(content)).toBeUndefined();
    });
  });

  describe('extractImplements', () => {
    it('should extract single interface', () => {
      const content = 'public class UserDto implements Serializable { }';
      expect(extractImplements(content)).toEqual(['Serializable']);
    });

    it('should extract multiple interfaces', () => {
      const content = 'public class UserDto implements Serializable, Cloneable { }';
      expect(extractImplements(content)).toEqual(['Serializable', 'Cloneable']);
    });

    it('should return empty array if no implements', () => {
      const content = 'public class UserDto { }';
      expect(extractImplements(content)).toEqual([]);
    });
  });

  describe('isEnum', () => {
    it('should return true for enum', () => {
      const content = 'public enum Status { ACTIVE, INACTIVE }';
      expect(isEnum(content)).toBe(true);
    });

    it('should return false for class', () => {
      const content = 'public class UserDto { }';
      expect(isEnum(content)).toBe(false);
    });

    it('should return false for interface', () => {
      const content = 'public interface UserService { }';
      expect(isEnum(content)).toBe(false);
    });
  });

  describe('extractFields', () => {
    it('should extract simple fields', () => {
      const content = `
        public class UserDto {
          private Long id;
          private String name;
        }
      `;
      const fields = extractFields(content, new Set());
      expect(fields).toHaveLength(2);
      expect(fields[0].name).toBe('id');
      expect(fields[0].javaType).toBe('Long');
      expect(fields[1].name).toBe('name');
      expect(fields[1].javaType).toBe('String');
    });

    it('should extract fields with annotations', () => {
      const content = `
        public class UserDto {
          @NotNull
          private String name;
          
          @Nullable
          private String email;
        }
      `;
      const fields = extractFields(content, new Set());
      expect(fields).toHaveLength(2);
      expect(fields[0].annotations).toContain('NotNull');
      expect(fields[1].annotations).toContain('Nullable');
    });

    it('should skip serialVersionUID', () => {
      const content = `
        public class UserDto {
          private static final long serialVersionUID = 1L;
          private Long id;
        }
      `;
      const fields = extractFields(content, new Set());
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('id');
    });

    it('should extract generic fields', () => {
      const content = `
        public class UserDto {
          private List<String> names;
          private Map<String, Integer> scores;
        }
      `;
      const fields = extractFields(content, new Set());
      expect(fields).toHaveLength(2);
      expect(fields[0].javaType).toBe('List<String>');
      expect(fields[1].javaType).toBe('Map<String, Integer>');
    });

    it('should extract array fields', () => {
      const content = `
        public class UserDto {
          private String[] tags;
          private int[] scores;
        }
      `;
      const fields = extractFields(content, new Set());
      expect(fields).toHaveLength(2);
      expect(fields[0].javaType).toBe('String[]');
      expect(fields[1].javaType).toBe('int[]');
    });

    it('should handle multiple fields on one line', () => {
      const content = `
        public class UserDto {
          private int x, y, z;
        }
      `;
      const fields = extractFields(content, new Set());
      expect(fields).toHaveLength(3);
      expect(fields[0].name).toBe('x');
      expect(fields[1].name).toBe('y');
      expect(fields[2].name).toBe('z');
    });

    it('should extract fields with @JsonProperty', () => {
      const content = `
        public class UserDto {
          @JsonProperty("custom_name")
          private String fieldName;
        }
      `;
      const fields = extractFields(content, new Set());
      expect(fields).toHaveLength(1);
      expect(fields[0].jsonName).toBe('custom_name');
    });
  });

  describe('extractDTOFromContent', () => {
    it('should extract complete DTO', () => {
      const content = `
        package com.example.dto;
        
        import java.time.LocalDateTime;
        
        public class UserDto {
          private Long id;
          
          @NotNull
          private String name;
        }
      `;
      
      const dto = extractDTOFromContent(content, 'UserDto.java', new Set());
      expect(dto).not.toBeNull();
      expect(dto!.className).toBe('UserDto');
      expect(dto!.packageName).toBe('com.example.dto');
      expect(dto!.imports).toContain('java.time.LocalDateTime');
      expect(dto!.fields).toHaveLength(2);
      expect(dto!.isEnum).toBe(false);
    });

    it('should extract enum', () => {
      const content = `
        package com.example.dto;
        
        public enum Status {
          ACTIVE,
          INACTIVE,
          PENDING
        }
      `;
      
      const dto = extractDTOFromContent(content, 'Status.java', new Set());
      expect(dto).not.toBeNull();
      expect(dto!.className).toBe('Status');
      expect(dto!.isEnum).toBe(true);
      expect(dto!.enumValues).toEqual(['ACTIVE', 'INACTIVE', 'PENDING']);
    });

    it('should return null if no class found', () => {
      const content = 'package com.example;';
      const dto = extractDTOFromContent(content, 'empty.java', new Set());
      expect(dto).toBeNull();
    });
  });

  describe('resolveInheritance', () => {
    it('should set parent fields on child classes', () => {
      const parentDto: DTOClass = {
        className: 'ParentDto',
        packageName: 'com.example',
        fields: [
          { name: 'id', javaType: 'Long', tsType: 'number', nullable: true, isEnum: false, annotations: [] }
        ],
        imports: [],
        isEnum: false,
        filePath: 'ParentDto.java'
      };

      const childDto: DTOClass = {
        className: 'ChildDto',
        packageName: 'com.example',
        fields: [
          { name: 'name', javaType: 'String', tsType: 'string', nullable: true, isEnum: false, annotations: [] }
        ],
        imports: [],
        extends: 'ParentDto',
        isEnum: false,
        filePath: 'ChildDto.java'
      };

      const dtos = [parentDto, childDto];
      resolveInheritance(dtos);

      expect(childDto.parentFields).toBeDefined();
      expect(childDto.parentFields).toHaveLength(1);
      expect(childDto.parentFields![0].name).toBe('id');
    });

    it('should handle classes without extends', () => {
      const dto: DTOClass = {
        className: 'StandaloneDto',
        packageName: 'com.example',
        fields: [],
        imports: [],
        isEnum: false,
        filePath: 'StandaloneDto.java'
      };

      const dtos = [dto];
      resolveInheritance(dtos);

      expect(dto.parentFields).toBeUndefined();
    });

    it('should handle missing parent class', () => {
      const childDto: DTOClass = {
        className: 'ChildDto',
        packageName: 'com.example',
        fields: [],
        imports: [],
        extends: 'NonExistentParent',
        isEnum: false,
        filePath: 'ChildDto.java'
      };

      const dtos = [childDto];
      resolveInheritance(dtos);

      expect(childDto.parentFields).toBeUndefined();
    });
  });
});