import * as path from 'path';
import * as fs from 'fs';


//  Normalize path for cross-platform compatibility

export function normalizePath(inputPath: string): string {
  return path.normalize(inputPath).replace(/\\/g, '/');
}


// Resolve path relative to current working directory

export function resolvePath(inputPath: string): string {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }
  return path.resolve(process.cwd(), inputPath);
}


//  Get relative path from base directory
 
export function getRelativePath(fullPath: string, basePath: string): string {
  return path.relative(basePath, fullPath);
}


//  Check if path is a directory
 
export function isDirectory(inputPath: string): boolean {
  try {
    return fs.statSync(inputPath).isDirectory();
  } catch {
    return false;
  }
}


//  Check if path is a file
 
export function isFile(inputPath: string): boolean {
  try {
    return fs.statSync(inputPath).isFile();
  } catch {
    return false;
  }
}


//  Get all parent directories of a path
 
export function getParentDirectories(inputPath: string): string[] {
  const parents: string[] = [];
  let current = path.dirname(inputPath);
  
  while (current !== path.dirname(current)) {
    parents.push(current);
    current = path.dirname(current);
  }
  
  return parents;
}


//  Convert Windows path to POSIX format
 
export function toPosixPath(inputPath: string): string {
  return inputPath.replace(/\\/g, '/');
}

/**
 * Convert POSIX path to Windows format
 */
export function toWindowsPath(inputPath: string): string {
  return inputPath.replace(/\//g, '\\');
}

/**
 * Get file extension in lowercase
 */
export function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * Get file name without extension
 */
export function getFileNameWithoutExt(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

/**
 * Join paths safely
 */
export function joinPaths(...paths: string[]): string {
  return path.join(...paths);
}

/**
 * Check if path is within another path
 */
export function isPathWithin(childPath: string, parentPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Find common ancestor of multiple paths
 */
export function findCommonAncestor(paths: string[]): string {
  if (paths.length === 0) return '';
  if (paths.length === 1) return path.dirname(paths[0]);
  
  const splitPaths = paths.map(p => p.split(path.sep));
  const minLength = Math.min(...splitPaths.map(p => p.length));
  
  let commonParts: string[] = [];
  for (let i = 0; i < minLength; i++) {
    const part = splitPaths[0][i];
    if (splitPaths.every(p => p[i] === part)) {
      commonParts.push(part);
    } else {
      break;
    }
  }
  
  return commonParts.join(path.sep);
}