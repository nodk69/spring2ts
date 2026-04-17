export interface Spring2TSConfig {
  backend: string;
  frontend: string;
  failOnBreaking?: boolean;
  typeMappings?: Record<string, string>;
  excludePatterns?: string[];
  includeNested?: boolean;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}