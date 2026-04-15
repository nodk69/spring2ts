import { parse } from 'java-parser';
import { DTOClass } from '../../types/dto.types.js';
import { logger } from '../../utils/logger.js';

// Simple regex-based parser as fallback/primary since java-parser can be complex
// For Phase 1, we'll use regex-based extraction which works well for DTOs

export interface ParseResult {
  success: boolean;
  dto?: DTOClass;
  error?: string;
}

export function parseJavaFile(content: string, filePath: string, knownClasses: Set<string>): ParseResult {
  try {
    // First try the Java parser library for validation
    const ast = parse(content);
    
    if (!ast) {
      return {
        success: false,
        error: 'Failed to parse Java file: empty AST',
      };
    }
    
    // The actual extraction is done by dto-extractor
    // This function just validates the syntax
    
    return {
      success: true,
    };
  } catch (error) {
    logger.debug(`Java parser error in ${filePath}: ${error}`);
    
    // Fall back to regex-based extraction
    return {
      success: true, // Still return success, extraction will happen in DTO extractor
    };
  }
}

export function validateJavaSyntax(content: string): boolean {
  try {
    parse(content);
    return true;
  } catch {
    return false;
  }
}