import { pathExists, readTextFile, writeTextFile } from '../utils/filesystem';
import { joinPaths } from '../utils/paths';

export interface SyncOptions {
  backend?: string;
  frontend?: string;
  config?: string;
  check?: boolean;
  failOnBreaking?: boolean;
  dryRun?: boolean;
  backup?: boolean;
  safe?: boolean;
  isSyncMode?: boolean;
  merge?: boolean;
  incremental?: boolean;
}

export interface Spring2TSConfig {
  backend: string;
  frontend: string;
  failOnBreaking?: boolean;
  exclude?: string[];
  indexFile?: boolean;
  typeMappings?: Record<string, string>;
  incremental?: boolean;
}

export const DEFAULT_CONFIG = {
  backend: './backend/src/main/java',
  frontend: './src/types',
  failOnBreaking: true,
} as const;

export function loadConfig(): Partial<Spring2TSConfig> {
  try {
    const configPath = joinPaths(process.cwd(), '.spring2tsrc.json');
    if (pathExists(configPath)) {
      return JSON.parse(readTextFile(configPath));
    }
  } catch {}
  return {};
}

export function saveConfig(config: Partial<Spring2TSConfig>): void {
  const configPath = joinPaths(process.cwd(), '.spring2tsrc.json');
  const fullConfig = {
    backend: config.backend || DEFAULT_CONFIG.backend,
    frontend: config.frontend || DEFAULT_CONFIG.frontend,
    failOnBreaking: config.failOnBreaking ?? DEFAULT_CONFIG.failOnBreaking,
    ...config,
  };
  writeTextFile(configPath, JSON.stringify(fullConfig, null, 2));
}

export function loadBackendPath(providedPath?: string): { path: string; fromConfig: boolean } {
  if (providedPath) return { path: providedPath, fromConfig: false };
  const config = loadConfig();
  if (config.backend) return { path: config.backend, fromConfig: true };
  return { path: DEFAULT_CONFIG.backend, fromConfig: false };
}

export function loadFrontendPath(providedPath?: string): { path: string; fromConfig: boolean } {
  if (providedPath) return { path: providedPath, fromConfig: false };
  const config = loadConfig();
  if (config.frontend) return { path: config.frontend, fromConfig: true };
  return { path: DEFAULT_CONFIG.frontend, fromConfig: false };
}

export function loadPaths(providedBackend?: string, providedFrontend?: string): {
  backend: { path: string; fromConfig: boolean };
  frontend: { path: string; fromConfig: boolean };
} {
  return {
    backend: loadBackendPath(providedBackend),
    frontend: loadFrontendPath(providedFrontend),
  };
}
