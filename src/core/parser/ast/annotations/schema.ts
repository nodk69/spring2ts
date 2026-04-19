import { SyntaxNode } from 'tree-sitter';
import { getAnnotationName, getStringValue, getStringArray, getNumericValue } from './core';

/**
 * Schema-driven annotation extraction
 */
export interface AnnotationRule {
  type: 'flag' | 'string' | 'number' | 'array';
  field: string;
  param?: string;
  implies?: string[];
}

export const JACKSON_RULES: Record<string, AnnotationRule> = {
  'JsonProperty': { type: 'string', field: 'jsonName' },
  'JsonAlias': { type: 'array', field: 'jsonAliases' },
  'JsonIgnore': { type: 'flag', field: 'jsonIgnore' },
  'JsonInclude': { type: 'string', field: 'jsonInclude' },
};

export const VALIDATION_RULES: Record<string, AnnotationRule> = {
  'NotNull': { type: 'flag', field: 'required' },
  'NonNull': { type: 'flag', field: 'required' },
  'NotEmpty': { type: 'flag', field: 'required', implies: ['NotNull'] },
  'NotBlank': { type: 'flag', field: 'required', implies: ['NotNull', 'NotEmpty'] },
  'Email': { type: 'flag', field: 'email' },
  'Pattern': { type: 'string', field: 'pattern', param: 'regexp' },
  'Size': { type: 'flag', field: 'hasSize' },
  'Min': { type: 'number', field: 'min' },
  'Max': { type: 'number', field: 'max' },
};

/**
 * Apply rules to extract annotation data
 */
export function applyRules(
  annotations: SyntaxNode[],
  rules: Record<string, AnnotationRule>
): Record<string, any> {
  const result: Record<string, any> = {};
  const processed = new Set<string>();
  
  const applyRule = (name: string, ann: SyntaxNode) => {
    if (processed.has(name)) return;
    processed.add(name);
    
    const rule = rules[name];
    if (!rule) return;
    
    // Apply current rule
    switch (rule.type) {
      case 'flag':
        result[rule.field] = true;
        break;
      case 'string':
        const strValue = getStringValue(ann, rule.param);
        if (strValue) result[rule.field] = strValue;
        break;
      case 'number':
        const numValue = getNumericValue(ann, rule.param);
        if (numValue !== undefined) result[rule.field] = numValue;
        break;
      case 'array':
        const arrValue = getStringArray(ann);
        if (arrValue.length) result[rule.field] = arrValue;
        break;
    }
    
    // Apply implied rules
    if (rule.implies) {
      for (const implied of rule.implies) {
        if (rules[implied]) {
          applyRule(implied, ann);
        }
      }
    }
  };
  
  for (const ann of annotations) {
    const name = getAnnotationName(ann);
    applyRule(name, ann);
  }
  
  return result;
}