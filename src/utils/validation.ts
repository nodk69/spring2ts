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
