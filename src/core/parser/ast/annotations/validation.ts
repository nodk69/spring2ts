import { SyntaxNode } from 'tree-sitter';
import { findFieldAnnotations, getAnnotationName, getStringValue, getNumericValue } from './core';

export interface ValidationData {
  hasNotNull: boolean;
  hasNotEmpty: boolean;
  hasNotBlank: boolean;
  hasEmail: boolean;
  pattern?: string;
  min?: number;
  max?: number;
  sizeMin?: number;
  sizeMax?: number;
  // Additional useful fields for validation
  decimalMin?: string;
  decimalMax?: string;
  positive?: boolean;
  negative?: boolean;
  past?: boolean;
  future?: boolean;
}

/**
 * Extract validation annotations from a field node
 * Uses optimized sibling traversal for performance
 */
export function extractValidationAnnotations(fieldNode: SyntaxNode): ValidationData {
  const result: ValidationData = {
    hasNotNull: false,
    hasNotEmpty: false,
    hasNotBlank: false,
    hasEmail: false
  };
  
  // Use optimized field annotation finder instead of recursive findAllAnnotations
  const annotations = findFieldAnnotations(fieldNode);
  
  for (const ann of annotations) {
    const name = getAnnotationName(ann);
    
    switch (name) {
      // Null/empty checks
      case 'NotNull':
      case 'NonNull':
      case 'Nonnull':
        result.hasNotNull = true;
        break;
        
      case 'NotEmpty':
        result.hasNotEmpty = true;
        result.hasNotNull = true; // @NotEmpty implies @NotNull
        break;
        
      case 'NotBlank':
        result.hasNotBlank = true;
        result.hasNotNull = true;
        result.hasNotEmpty = true;
        break;
        
      // String validations
      case 'Email':
        result.hasEmail = true;
        break;
        
      case 'Pattern':
        result.pattern = getStringValue(ann, 'regexp') || getStringValue(ann);
        break;
        
      // Size validations
      case 'Size':
        result.sizeMin = getNumericValue(ann, 'min');
        result.sizeMax = getNumericValue(ann, 'max');
        // Handle default values according to Bean Validation spec
        if (result.sizeMin === undefined) result.sizeMin = 0;
        if (result.sizeMax === undefined) result.sizeMax = Number.MAX_SAFE_INTEGER;
        break;
        
      // Numeric validations
      case 'Min':
        result.min = getNumericValue(ann, 'value') || getNumericValue(ann);
        break;
        
      case 'Max':
        result.max = getNumericValue(ann, 'value') || getNumericValue(ann);
        break;
        
      case 'DecimalMin':
        result.decimalMin = getStringValue(ann, 'value') || getStringValue(ann);
        break;
        
      case 'DecimalMax':
        result.decimalMax = getStringValue(ann, 'value') || getStringValue(ann);
        break;
        
      // Positive/Negative
      case 'Positive':
      case 'PositiveOrZero':
        result.positive = true;
        break;
        
      case 'Negative':
      case 'NegativeOrZero':
        result.negative = true;
        break;
        
      // Date validations  
      case 'Past':
      case 'PastOrPresent':
        result.past = true;
        break;
        
      case 'Future':
      case 'FutureOrPresent':
        result.future = true;
        break;
    }
  }
  
  return result;
}

/**
 * Process both field and its getter method for validation
 * This is more comprehensive for Bean Validation
 */
export function extractFullValidation(
  fieldNode: SyntaxNode, 
  getterNode?: SyntaxNode
): ValidationData {
  const fieldResult = extractValidationAnnotations(fieldNode);
  
  if (getterNode) {
    const getterResult = extractValidationAnnotations(getterNode);
    
    // Merge results (getter annotations override/add to field annotations)
    return {
      ...fieldResult,
      ...getterResult,
      // Special handling for merged fields
      sizeMin: getterResult.sizeMin ?? fieldResult.sizeMin,
      sizeMax: getterResult.sizeMax ?? fieldResult.sizeMax,
      min: getterResult.min ?? fieldResult.min,
      max: getterResult.max ?? fieldResult.max,
      pattern: getterResult.pattern ?? fieldResult.pattern,
      decimalMin: getterResult.decimalMin ?? fieldResult.decimalMin,
      decimalMax: getterResult.decimalMax ?? fieldResult.decimalMax
    };
  }
  
  return fieldResult;
}

/**
 * Batch extract validation annotations from multiple fields
 */
export function batchExtractValidationAnnotations(
  fieldNodes: SyntaxNode[]
): Map<SyntaxNode, ValidationData> {
  const results = new Map<SyntaxNode, ValidationData>();
  
  for (const field of fieldNodes) {
    results.set(field, extractValidationAnnotations(field));
  }
  
  return results;
}