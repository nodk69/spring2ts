import * as syncFs from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ParsedDTO } from '../../types/dto.types';
import { ensureDirectory, fileExists } from '../../utils/filesystem';
import { logger } from '../../utils/logger';
import {
  applyReservedWordQuoting,
  createGenerationContext,
  generateIndexFile,
  generateInterface,
} from './ts-interface';
import { generateEnum } from './ts-enum';
import { formatTypeScript } from './formatter';
import { mergeInterfaceContent } from './merge-interface';

export interface GenerateOptions {
  outputPath: string;
  parsed: ParsedDTO;
  merge?: boolean;
  incremental?: boolean;
}

export async function generateTypeScript(options: GenerateOptions): Promise<void> {
  const { outputPath, parsed, merge = true, incremental = false } = options;

  const uniqueClasses = [...new Map(parsed.classes.map((c) => [c.className, c])).values()];
  const uniqueEnums = [...new Map(parsed.enums.map((e) => [e.className, e])).values()];
  const allClasses = [...uniqueClasses, ...uniqueEnums];
  const generationContext = createGenerationContext(allClasses);

  const absoluteOutput = path.resolve(outputPath);
  ensureDirectory(absoluteOutput);

  let generated = 0;
  let merged = 0;
  let created = 0;
  let skipped = 0;
  const writeQueue = new ConcurrentWriteQueue(50);
  const sourceMtimes = await getSourceMtimes(allClasses);

  await Promise.all(
    uniqueEnums.map(async (enumDto) => {
      const filePath = path.join(absoluteOutput, `${enumDto.className}.ts`);

      if (incremental && isOutputCurrentFromMap(filePath, sourceMtimes, enumDto.filePath)) {
        skipped++;
        return;
      }

      let code = generateEnum(enumDto);
      code = await formatTypeScript(code);
      code = applyReservedWordQuoting(code);

      const changed = await writeGeneratedFileIfChanged(filePath, code);
      if (!changed) {
        skipped++;
        return;
      }

      generated++;
      created++;
    })
  );

  await Promise.all(
    uniqueClasses.map(async (dto) => {
      const filePath = path.join(absoluteOutput, `${dto.className}.ts`);

      if (incremental && isOutputCurrentFromMap(filePath, sourceMtimes, dto.filePath)) {
        skipped++;
        return;
      }

      let code = generateInterface(dto, allClasses, generationContext);
      code = await formatTypeScript(code);
      code = applyReservedWordQuoting(code);

      const existingContent = await readExistingFile(filePath);
      const shouldMerge = merge && existingContent !== null;
      const finalCode = shouldMerge ? mergeInterfaceContent(existingContent, code) : code;
      const changed = await writeQueue.enqueue(writeGeneratedFileIfChanged(filePath, finalCode));

      if (!changed) {
        skipped++;
        return;
      }

      generated++;
      if (shouldMerge) {
        merged++;
      } else {
        created++;
      }

      if (shouldMerge) {
        logger.debug(`Merged ${dto.className}.ts (preserved user fields)`);
      } else {
        logger.debug(`Created ${dto.className}.ts`);
      }
    })
  );

  const indexPath = path.join(absoluteOutput, 'index.ts');
  const latestSourceMtime = getLatestSourceMtime(sourceMtimes);

  if (!(incremental && latestSourceMtime !== null && (await isOutputCurrentByMtime(indexPath, latestSourceMtime)))) {
    const indexCode = generateIndexFile(allClasses);
    const formattedIndex = await formatTypeScript(indexCode);
    const changed = await writeQueue.enqueue(writeGeneratedFileIfChanged(indexPath, formattedIndex));
    if (changed) {
      generated++;
      created++;
    } else {
      skipped++;
    }
  } else {
    skipped++;
  }

  await writeQueue.flush();

  if (merge && merged > 0) {
    logger.info(`Preserved user fields in ${merged} file(s)`);
  }

  if (incremental) {
    logger.info(`Incremental generation skipped ${skipped} up-to-date file(s)`);
  }

  logger.debug(`Generated ${generated} file(s), created ${created}, merged ${merged}`);
}

async function writeGeneratedFileIfChanged(filePath: string, content: string): Promise<boolean> {
  const existing = await readExistingFile(filePath);
  if (existing === content) {
    return false;
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
  return true;
}

async function readExistingFile(filePath: string): Promise<string | null> {
  if (!fileExists(filePath)) {
    return null;
  }

  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function isOutputCurrentFromMap(
  outputFilePath: string,
  sourceMtimes: Map<string, number>,
  sourceFilePath: string | undefined
): boolean {
  if (!sourceFilePath) {
    return false;
  }

  const sourceMtimeMs = sourceMtimes.get(sourceFilePath);
  if (sourceMtimeMs === undefined) {
    return false;
  }

  return fileExists(outputFilePath) && getCachedOutputMtime(outputFilePath) >= sourceMtimeMs;
}

async function isOutputCurrentByMtime(outputFilePath: string, sourceMtimeMs: number): Promise<boolean> {
  try {
    const outputStats = await fs.stat(outputFilePath);
    return outputStats.mtimeMs >= sourceMtimeMs;
  } catch {
    return false;
  }
}

async function getSourceMtimes(dtos: Array<{ filePath: string }>): Promise<Map<string, number>> {
  const uniquePaths = [...new Set(dtos.map((dto) => dto.filePath).filter(Boolean))];
  const sourceMtimes = new Map<string, number>();

  await Promise.all(
    uniquePaths.map(async (filePath) => {
      try {
        const stats = await fs.stat(filePath);
        sourceMtimes.set(filePath, stats.mtimeMs);
      } catch {
        // Ignore missing source files and let callers fall back.
      }
    })
  );

  return sourceMtimes;
}

function getLatestSourceMtime(sourceMtimes: Map<string, number>): number | null {
  if (sourceMtimes.size === 0) {
    return null;
  }

  let latestMtimeMs = 0;
  for (const mtimeMs of sourceMtimes.values()) {
    latestMtimeMs = Math.max(latestMtimeMs, mtimeMs);
  }

  return latestMtimeMs || null;
}

class ConcurrentWriteQueue {
  private readonly pending = new Set<Promise<boolean>>();

  constructor(private readonly maxPending: number) {}

  async enqueue(writeOperation: Promise<boolean>): Promise<boolean> {
    this.pending.add(writeOperation);
    writeOperation.finally(() => {
      this.pending.delete(writeOperation);
    });

    if (this.pending.size >= this.maxPending) {
      await Promise.race(this.pending);
    }

    return writeOperation;
  }

  async flush(): Promise<void> {
    await Promise.all(this.pending);
  }
}

const outputMtimeCache = new Map<string, number>();

function getCachedOutputMtime(filePath: string): number {
  const cached = outputMtimeCache.get(filePath);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const stats = syncFs.statSync(filePath);
    outputMtimeCache.set(filePath, stats.mtimeMs);
    return stats.mtimeMs;
  } catch {
    return -1;
  }
}
