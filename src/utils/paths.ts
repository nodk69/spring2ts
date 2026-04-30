import * as path from 'path';

export function normalizePath(inputPath: string): string {
  return path.normalize(inputPath).replace(/\\/g, '/');
}

export function resolveFromCwd(inputPath: string): string {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }

  return path.resolve(process.cwd(), inputPath);
}

export function getRelativePath(fullPath: string, basePath: string): string {
  return path.relative(basePath, fullPath);
}

export function getParentDirectories(inputPath: string): string[] {
  const parents: string[] = [];
  let current = path.dirname(inputPath);

  while (current !== path.dirname(current)) {
    parents.push(current);
    current = path.dirname(current);
  }

  return parents;
}

export function toPosixPath(inputPath: string): string {
  return inputPath.replace(/\\/g, '/');
}

export function toWindowsPath(inputPath: string): string {
  return inputPath.replace(/\//g, '\\');
}

export function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

export function getFileNameWithoutExt(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

export function joinPaths(...parts: string[]): string {
  return path.join(...parts);
}

export function getDirectoryName(inputPath: string): string {
  return path.dirname(inputPath);
}

export function isPathWithin(childPath: string, parentPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

export function findCommonAncestor(paths: string[]): string {
  if (paths.length === 0) return '';
  if (paths.length === 1) return path.dirname(paths[0]);

  const splitPaths = paths.map((value) => value.split(path.sep));
  const minLength = Math.min(...splitPaths.map((value) => value.length));

  const commonParts: string[] = [];
  for (let index = 0; index < minLength; index++) {
    const part = splitPaths[0][index];
    if (splitPaths.every((value) => value[index] === part)) {
      commonParts.push(part);
    } else {
      break;
    }
  }

  return commonParts.join(path.sep);
}
