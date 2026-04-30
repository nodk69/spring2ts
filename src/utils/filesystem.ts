import * as fs from 'fs';
import { getDirectoryName, joinPaths, resolveFromCwd } from './paths';

export function pathExists(inputPath: string): boolean {
  return fs.existsSync(inputPath);
}

export function isDirectory(inputPath: string): boolean {
  try {
    return fs.statSync(inputPath).isDirectory();
  } catch {
    return false;
  }
}

export function isFile(inputPath: string): boolean {
  try {
    return fs.statSync(inputPath).isFile();
  } catch {
    return false;
  }
}

export function ensureDirectory(dirPath: string): void {
  if (!pathExists(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function writeTextFile(filePath: string, content: string): void {
  ensureDirectory(getDirectoryName(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function readTextFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

export function fileExists(filePath: string): boolean {
  return pathExists(filePath);
}

export function copyDirectory(sourcePath: string, targetPath: string): void {
  fs.cpSync(sourcePath, targetPath, { recursive: true });
}

export function removeFile(filePath: string): void {
  fs.unlinkSync(filePath);
}

export function isWritableDirectory(dirPath: string): boolean {
  try {
    ensureDirectory(dirPath);
    const testFile = joinPaths(dirPath, '.spring2ts-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return true;
  } catch {
    return false;
  }
}

export function countJavaFiles(inputPath: string): number {
  if (!isDirectory(inputPath)) {
    return 0;
  }

  let javaFileCount = 0;
  const absoluteInputPath = resolveFromCwd(inputPath);
  const shouldSkipDirectory = createExcludeMatcher([
    '**/test/**',
    '**/tests/**',
    '**/build/**',
    '**/target/**',
    '**/node_modules/**',
  ]);

  function walk(dir: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = joinPaths(dir, entry.name);
        if (entry.isDirectory()) {
          if (!shouldSkipDirectory(toRelativeScanPath(fullPath, absoluteInputPath))) {
            walk(fullPath);
          }
          continue;
        }

        if (entry.isFile() && entry.name.endsWith('.java')) {
          javaFileCount++;
        }
      }
    } catch {
      // Ignore unreadable directories.
    }
  }

  walk(inputPath);
  return javaFileCount;
}

export async function findJavaFiles(inputPath: string, excludePatterns: string[] = []): Promise<string[]> {
  return findFilesByExtensions(inputPath, ['.java'], excludePatterns);
}

export async function findFilesByExtensions(
  inputPath: string,
  extensions: string[],
  excludePatterns: string[] = []
): Promise<string[]> {
  const files: string[] = [];
  const absolutePath = resolveFromCwd(inputPath);

  if (!isDirectory(absolutePath)) {
    return files;
  }

  const normalizedExtensions = new Set(extensions.map((extension) => extension.toLowerCase()));
  const shouldExclude = createExcludeMatcher(excludePatterns);

  function scanDirectory(dir: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = joinPaths(dir, entry.name);
        if (shouldExclude(toRelativeScanPath(fullPath, absolutePath))) {
          continue;
        }

        if (entry.isDirectory()) {
          scanDirectory(fullPath);
          continue;
        }

        if (entry.isFile() && normalizedExtensions.has(getFileExtension(entry.name))) {
          files.push(fullPath);
        }
      }
    } catch {
      // Ignore unreadable directories and files.
    }
  }

  scanDirectory(absolutePath);
  return files;
}

function getFileExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf('.');
  return lastDotIndex >= 0 ? fileName.slice(lastDotIndex).toLowerCase() : '';
}

function toRelativeScanPath(fullPath: string, rootPath: string): string {
  const normalizedFullPath = fullPath.replace(/\\/g, '/');
  const normalizedRootPath = rootPath.replace(/\\/g, '/').replace(/\/+$/g, '');

  if (!normalizedFullPath.startsWith(normalizedRootPath)) {
    return normalizedFullPath;
  }

  const relativePath = normalizedFullPath.slice(normalizedRootPath.length).replace(/^\/+/, '');
  return relativePath || '.';
}

function createExcludeMatcher(patterns: string[]): (fullPath: string) => boolean {
  const normalizedPatterns = patterns
    .map((pattern) => pattern.replace(/\\/g, '/').toLowerCase())
    .map((pattern) => pattern.replace(/\*\*/g, '*'))
    .map((pattern) => pattern.split('*').map((segment) => segment.replace(/^\/+|\/+$/g, '')).filter(Boolean))
    .filter((segments) => segments.length > 0);

  if (normalizedPatterns.length === 0) {
    return () => false;
  }

  return (fullPath: string): boolean => {
    const normalizedPath = fullPath.replace(/\\/g, '/').toLowerCase();
    const boundedPath = `/${normalizedPath.replace(/^\/+|\/+$/g, '')}/`;
    return normalizedPatterns.some((segments) =>
      segments.every((segment) => boundedPath.includes(`/${segment}/`))
    );
  };
}
