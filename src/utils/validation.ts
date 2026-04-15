import * as fs from 'fs';
import * as path from 'path';

/**
 * Validate that a directory exists
 */
export function validateDirectory(dirPath: string): boolean {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Validate that a file exists
 */
export function validateFile(filePath: string): boolean {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Validate that a path is a Java file
 */
export function isJavaFile(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.java');
}

/**
 * Validate that a string is a valid Java class name
 */
export function isValidJavaClassName(className: string): boolean {
  return /^[A-Z][a-zA-Z0-9_]*$/.test(className);
}

/**
 * Validate that a string is a valid Java package name
 */
export function isValidJavaPackageName(packageName: string): boolean {
  return /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/.test(packageName);
}

/**
 * Validate that a string is a valid TypeScript identifier
 */
export function isValidTypeScriptIdentifier(name: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
}

/**
 * Validate config object
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateConfig(config: any): ConfigValidationResult {
  const result: ConfigValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };
  
  // Check backend path
  if (!config.backend) {
    result.errors.push('Missing required field: backend');
    result.valid = false;
  } else if (typeof config.backend !== 'string') {
    result.errors.push('backend must be a string');
    result.valid = false;
  }
  
  // Check frontend path
  if (!config.frontend) {
    result.warnings.push('Missing field: frontend (using default: ./src/types)');
  } else if (typeof config.frontend !== 'string') {
    result.errors.push('frontend must be a string');
    result.valid = false;
  }
  
  // Check failOnBreaking
  if (config.failOnBreaking !== undefined && typeof config.failOnBreaking !== 'boolean') {
    result.errors.push('failOnBreaking must be a boolean');
    result.valid = false;
  }
  
  return result;
}

/**
 * Validate that backend directory contains Java files
 */
export function validateBackendDirectory(backendPath: string): { valid: boolean; javaFileCount: number } {
  let javaFileCount = 0;
  
  function countJavaFiles(dir: string): void {
    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip common non-source directories
          if (!['test', 'tests', 'build', 'target', 'node_modules'].includes(entry.toLowerCase())) {
            countJavaFiles(fullPath);
          }
        } else if (entry.endsWith('.java')) {
          javaFileCount++;
        }
      }
    } catch {
      // Ignore errors
    }
  }
  
  if (validateDirectory(backendPath)) {
    countJavaFiles(backendPath);
  }
  
  return {
    valid: javaFileCount > 0,
    javaFileCount,
  };
}

/**
 * Validate TypeScript output directory is writable
 */
export function validateOutputDirectory(outputPath: string): boolean {
  try {
    if (!fs.existsSync(outputPath)) {
      // Try to create it
      fs.mkdirSync(outputPath, { recursive: true });
    }
    
    // Test write
    const testFile = path.join(outputPath, '.spring2ts-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate file encoding is UTF-8
 */
export function isValidUTF8(filePath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.length === Buffer.byteLength(content, 'utf8');
  } catch {
    return false;
  }
}

/**
 * Sanitize a string for use as a filename
 */
export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

/**
 * Validate that a value is within allowed options
 */
export function validateEnum<T extends string>(value: string, allowed: T[]): value is T {
  return allowed.includes(value as T);
}