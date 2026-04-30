import { findFilesByExtensions, readTextFile } from '../../utils/filesystem';
import { FrontendClassUsage, FrontendUsageLocation, FrontendUsageReport } from '../../types/frontend-usage.types';
import { getDirectoryName, normalizePath } from '../../utils/paths';

const FRONTEND_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const DEFAULT_EXCLUDES = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/coverage/**'];

export async function analyzeFrontendUsage(
  frontendPath: string,
  classNames: string[],
  fieldNamesByClass: Record<string, string[]>,
  excludedPaths: string[] = []
): Promise<FrontendUsageReport> {
  const files = await findFilesByExtensions(frontendPath, FRONTEND_EXTENSIONS, DEFAULT_EXCLUDES);
  const normalizedExcludedPaths = excludedPaths.map((value) => normalizePath(value).toLowerCase());
  const classes: Record<string, FrontendClassUsage> = {};
  const classConfigs = classNames.map((className) => ({
    className,
    escapedClassName: escapeRegex(className),
    fieldNames: fieldNamesByClass[className] || [],
  }));

  for (const className of classNames) {
    classes[className] = {
      className,
      classLocations: [],
      fields: {},
    };
  }

  for (const filePath of files) {
    const normalizedFilePath = normalizePath(filePath).toLowerCase();
    if (normalizedExcludedPaths.some((excludedPath) => normalizedFilePath.startsWith(excludedPath))) {
      continue;
    }

    const content = readTextFile(filePath);
    const lineStarts = buildLineStartIndexes(content);
    const identifiers = collectIdentifiers(content);
    const candidateClasses = classConfigs.filter((config) => identifiers.has(config.className));

    for (const config of candidateClasses) {
      const classUsage = classes[config.className];
      const searchableNames = [config.className, ...extractAliases(content, config.escapedClassName)];
      const classLocations = dedupeLocations(
        searchableNames.flatMap((name) =>
          findContentMatches(
            content,
            new RegExp(`\\b${escapeRegex(name)}\\b`, 'g'),
            'class',
            filePath,
            lineStarts
          )
        )
      );

      if (classLocations.length > 0) {
        classUsage.classLocations.push(...classLocations);
      }

      if (classLocations.length === 0) {
        continue;
      }

      for (const fieldName of config.fieldNames) {
        const escapedFieldName = escapeRegex(fieldName);
        const fieldLocations = dedupeLocations([
          ...findContentMatches(content, new RegExp(`(?:\\.|\\?\\.)${escapedFieldName}\\b`, 'g'), 'field', filePath, lineStarts),
          ...findContentMatches(content, new RegExp(`\\[['"\`]${escapedFieldName}['"\`]\\]`, 'g'), 'field', filePath, lineStarts),
          ...findContentMatches(content, new RegExp(`\\b${escapedFieldName}\\s*:`, 'g'), 'field', filePath, lineStarts),
          ...findContentMatches(content, new RegExp(`\\b${escapedFieldName}\\s*:\\s*[A-Za-z_$][\\w$]*`, 'g'), 'field', filePath, lineStarts),
          ...findContentMatches(content, new RegExp(`\\{[\\s\\S]{0,200}\\b${escapedFieldName}\\b(?:\\s*:\\s*[A-Za-z_$][\\w$]*)?[\\s\\S]{0,200}\\}`, 'g'), 'field', filePath, lineStarts),
        ]);

        if (fieldLocations.length > 0) {
          const existingLocations = classUsage.fields[fieldName]?.locations || [];
          classUsage.fields[fieldName] = {
            locations: dedupeLocations([...existingLocations, ...fieldLocations]),
          };
        }
      }
    }
  }

  return {
    scannedFiles: files.length,
    classes,
  };
}

export function resolveFrontendUsageRoot(frontendPath: string): string {
  const normalizedPath = normalizePath(frontendPath).toLowerCase();
  if (
    normalizedPath.endsWith('/types') ||
    normalizedPath.endsWith('/generated') ||
    normalizedPath.endsWith('/models') ||
    normalizedPath.endsWith('/dto')
  ) {
    return getDirectoryName(frontendPath);
  }

  return frontendPath;
}

function extractAliases(content: string, escapedClassName: string): string[] {
  const aliases = new Set<string>();
  const patterns = [
    new RegExp(`import\\s+type\\s+\\{[^}]*\\b${escapedClassName}\\s+as\\s+([A-Za-z_$][\\w$]*)`, 'g'),
    new RegExp(`import\\s+\\{[^}]*\\b${escapedClassName}\\s+as\\s+([A-Za-z_$][\\w$]*)`, 'g'),
    new RegExp(`type\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${escapedClassName}\\b`, 'g'),
    new RegExp(`interface\\s+([A-Za-z_$][\\w$]*)\\s+extends\\s+${escapedClassName}\\b`, 'g'),
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      aliases.add(match[1]);
    }
  }

  return Array.from(aliases);
}

function findContentMatches(
  content: string,
  pattern: RegExp,
  kind: 'class' | 'field',
  filePath: string,
  lineStarts: number[]
): FrontendUsageLocation[] {
  const locations: FrontendUsageLocation[] = [];

  for (const match of content.matchAll(pattern)) {
    const index = match.index;
    if (index === undefined) {
      continue;
    }

    locations.push({
      filePath,
      line: getLineNumber(lineStarts, index),
      kind,
      match: match[0],
    });
  }

  return locations;
}

function buildLineStartIndexes(content: string): number[] {
  const lineStarts = [0];

  for (let index = 0; index < content.length; index++) {
    if (content.charCodeAt(index) === 10) {
      lineStarts.push(index + 1);
    }
  }

  return lineStarts;
}

function getLineNumber(lineStarts: number[], index: number): number {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineStarts[mid] <= index) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return high + 1;
}

function collectIdentifiers(content: string): Set<string> {
  const identifiers = new Set<string>();
  const pattern = /\b[A-Za-z_$][\w$]*\b/g;

  for (const match of content.matchAll(pattern)) {
    identifiers.add(match[0]);
  }

  return identifiers;
}

function dedupeLocations(locations: FrontendUsageLocation[]): FrontendUsageLocation[] {
  const seen = new Set<string>();
  const unique: FrontendUsageLocation[] = [];

  for (const location of locations) {
    const key = `${location.filePath}:${location.line}:${location.kind}:${location.match}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(location);
    }
  }

  return unique;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
