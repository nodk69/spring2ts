import Parser, { SyntaxNode } from 'tree-sitter';
import Java from 'tree-sitter-java';
import { DTOClass } from '../../../types/dto.types';
import { extractClass } from './extractors/class-extractor';
import { extractEnum } from './extractors/enum-extractor';
import { extractRecord } from './extractors/record-extractor';
import { logger } from '../../../utils/logger';

// ============================================================================
// PARSER SETUP
// ============================================================================

/**
 * Singleton Tree-sitter parser instance.
 * Reusing a single parser is significantly faster than creating a new one per file.
 */
const tsParser = new Parser();
tsParser.setLanguage(Java);

/**
 * Verbose logging flag - enables detailed debug output.
 * Activated via: spring2ts gen --verbose
 */
const isVerbose = process.argv.includes('--verbose');

// ============================================================================
// CONTENT PREPROCESSING
// ============================================================================

/**
 * Decode Java unicode escape sequences in source code.
 * 
 * Java allows unicode escapes anywhere in the source code, even in comments
 * and string literals. For example:
 *   - "na\u006De" becomes "name"
 *   - "\u0048\u0065\u006C\u006C\u006F" becomes "Hello"
 * 
 * This function converts all \uXXXX sequences to their actual characters
 * BEFORE parsing, ensuring the AST reflects the true source code.
 * 
 * @param content - Raw Java source code
 * @returns Source code with all unicode escapes decoded
 */
function decodeUnicodeEscapes(content: string): string {
  return content.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
}

/**
 * Normalize line endings and remove BOM if present.
 * Ensures consistent parsing across different operating systems.
 */
function normalizeContent(content: string): string {
  // Remove UTF-8 BOM if present (some Windows editors add this)
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  
  // Normalize line endings to LF
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

// ============================================================================
// PACKAGE AND IMPORT EXTRACTION
// ============================================================================

/**
 * Extract package declaration from the root AST node.
 * 
 * @example
 * "package com.example.dto;" → "com.example.dto"
 */
function extractPackageName(root: SyntaxNode): string {
  for (const child of root.children) {
    if (child.type === 'package_declaration') {
      return child.text
        .replace(/^package\s+/, '')
        .replace(';', '')
        .trim();
    }
  }
  return '';
}

/**
 * Extract all import declarations from the root AST node.
 * 
 * @example
 * "import java.util.List;" → "java.util.List"
 * "import com.example.dto.*;" → "com.example.dto.*"
 */
function extractImports(root: SyntaxNode): string[] {
  const imports: string[] = [];
  
  for (const child of root.children) {
    if (child.type === 'import_declaration') {
      const importPath = child.text
        .replace(/^import\s+/, '')
        .replace(';', '')
        .trim();
      if (importPath) imports.push(importPath);
    }
  }
  
  return imports;
}

// ============================================================================
// MAIN PARSER
// ============================================================================

/**
 * Parse a Java file using Tree-sitter and extract DTO information.
 * 
 * This is the core parsing function that:
 * 1. Preprocesses the source (unicode escapes, BOM, line endings)
 * 2. Parses the file into an AST using Tree-sitter
 * 3. Extracts package and import information
 * 4. Finds all class, enum, and record declarations
 * 5. Delegates to specialized extractors for each declaration type
 * 
 * Supported Java constructs:
 * - ✅ Classes (public class UserDTO { ... })
 * - ✅ Enums (public enum Status { ... })
 * - ✅ Records (public record UserRecord(...) { ... }) - Java 14+
 * 
 * @param content - Raw Java source code as string
 * @param filePath - Absolute path to the Java file (for error reporting)
 * @param knownClasses - Set of already discovered class names (for type resolution)
 * @returns Array of extracted DTO classes (may be empty if none found)
 */
export function parseJavaFileWithAST(
  content: string,
  filePath: string,
  knownClasses: Set<string>
): DTOClass[] {
  const dtos: DTOClass[] = [];

  try {
    // ========================================================================
    // PHASE 1: Preprocessing
    // ========================================================================
    
    // Decode unicode escapes BEFORE parsing (e.g., \u006E -> n)
    content = decodeUnicodeEscapes(content);
    
    // Normalize content (BOM removal, line endings)
    content = normalizeContent(content);
    
    // ========================================================================
    // PHASE 2: Parse into AST
    // ========================================================================
    
    const tree = tsParser.parse(content);
    const root = tree.rootNode;
    
    // ========================================================================
    // PHASE 3: Extract file-level metadata
    // ========================================================================
    
    const packageName = extractPackageName(root);
    const imports = extractImports(root);
    
    // ========================================================================
    // PHASE 4: Find and process type declarations
    // ========================================================================
    
    // Filter for type declarations: classes, enums, and records
    const declarations = root.children.filter(
      (n: SyntaxNode) => 
        n.type === 'class_declaration' || 
        n.type === 'enum_declaration' ||
        n.type === 'record_declaration'  // Java 14+ records
    );
    
    for (const decl of declarations) {
      // ----------------------------------------------------------------------
      // Class Declaration
      // ----------------------------------------------------------------------
      if (decl.type === 'class_declaration') {
        const extracted = extractClass(decl, packageName, imports, filePath, knownClasses);
        if (extracted) {
          dtos.push(extracted);
        }
      }
      
      // ----------------------------------------------------------------------
      // Enum Declaration
      // ----------------------------------------------------------------------
      else if (decl.type === 'enum_declaration') {
        const extracted = extractEnum(decl, packageName, imports, filePath);
        if (extracted) {
          dtos.push(extracted);
        }
      }
      
      // ----------------------------------------------------------------------
      // Record Declaration (Java 14+)
      // ----------------------------------------------------------------------
      else if (decl.type === 'record_declaration') {
        const extracted = extractRecord(decl, packageName, imports, filePath, knownClasses);
        if (extracted) {
          dtos.push(extracted);
        }
      }
    }
    
    // ========================================================================
    // PHASE 5: Debug output (verbose mode only)
    // ========================================================================
    
    if (isVerbose && dtos.length > 0) {
      const fileName = filePath.split(/[/\\]/).pop();
      const dtoNames = dtos.map(d => d.className).join(', ');
      logger.debug(`   🔍 Parsed ${fileName} → [${dtoNames}]`);
    }
    
    return dtos;
    
  } catch (error: any) {
    // ========================================================================
    // ERROR HANDLING
    // ========================================================================
    
    // Log error but don't crash - continue with other files
    logger.error(`❌ Tree-sitter failed for ${filePath}: ${error.message}`);
    
    // In verbose mode, show more details for debugging
    if (isVerbose) {
      logger.debug(`   Stack trace: ${error.stack}`);
    }
    
    // Return empty array - caller should handle gracefully
    return [];
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a file contains any DTO-relevant declarations.
 * Useful for pre-filtering files before full parsing.
 */
export function hasDTODeclarations(content: string): boolean {
  // Quick regex check before invoking the full parser
  return /(?:public\s+)?(?:class|enum|record)\s+\w+/.test(content);
}

/**
 * Get the singleton parser instance.
 * Useful for testing or if other modules need direct parser access.
 */
export function getParser(): Parser {
  return tsParser;
}