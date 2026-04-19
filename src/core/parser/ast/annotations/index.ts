/**
 * Java Annotation Processing Module
 * 
 * Core utilities + Jackson + Validation annotations
 */

// Core - Basic annotation parsing
export {
  getAnnotationName,
  findAllAnnotations,
  findFieldAnnotations,
  findAnnotation,
  hasAnnotation,
  getStringValue,
  getStringArray,
  getNumericValue,
  getPosition,
} from './core';

// Jackson - JSON annotations
export type { JacksonData } from './jackson';
export { 
  extractJacksonAnnotations, 
  batchExtractJacksonAnnotations 
} from './jackson';

// Validation - Bean Validation annotations
export type { ValidationData } from './validation';
export { 
  extractValidationAnnotations, 
  extractFullValidation 
} from './validation';

// Schema - Generic rule engine
export type { AnnotationRule } from './schema';
export { 
  applyRules, 
  JACKSON_RULES, 
  VALIDATION_RULES 
} from './schema';

// Re-export for convenience
export type { SyntaxNode } from 'tree-sitter';