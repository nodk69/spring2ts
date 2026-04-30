import * as fs from 'fs';
import { ParsedDTO } from '../../types/dto.types';
import { Snapshot } from '../../types/diff.types';
import { ensureDirectory, pathExists, readTextFile, removeFile, writeTextFile } from '../../utils/filesystem';
import { getDirectoryName } from '../../utils/paths';

/**
 * Create a snapshot from parsed DTOs
 */
export function createSnapshot(parsed: ParsedDTO, version: string = '1.0.0'): Snapshot {
  return {
    timestamp: new Date().toISOString(),
    version,
    classes: structuredClone(parsed.classes),
    enums: structuredClone(parsed.enums),
  };
}

/**
 * Save snapshot to file
 */
export function saveSnapshot(snapshot: Snapshot, filePath: string): void {
  ensureDirectory(getDirectoryName(filePath));
  writeTextFile(filePath, JSON.stringify(snapshot, null, 2));
}

/**
 * Load snapshot from file
 */
export function loadSnapshot(filePath: string): Snapshot | null {
  try {
    if (!pathExists(filePath)) {
      return null;
    }
    const content = readTextFile(filePath);
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to load snapshot:', error);
    return null;
  }
}

/**
 * Check if snapshot exists
 */
export function snapshotExists(filePath: string): boolean {
  return pathExists(filePath);
}

/**
 * Get snapshot age (in milliseconds)
 */
export function getSnapshotAge(filePath: string): number | null {
  try {
    if (!pathExists(filePath)) {
      return null;
    }
    const stats = fs.statSync(filePath);
    return Date.now() - stats.mtimeMs;
  } catch {
    return null;
  }
}

/**
 * Delete snapshot
 */
export function deleteSnapshot(filePath: string): void {
  if (pathExists(filePath)) {
    removeFile(filePath);
  }
}

/**
 * Compare two snapshots (returns true if different)
 */
export function hasSnapshotChanged(oldSnapshot: Snapshot, newSnapshot: Snapshot): boolean {
  const oldJson = JSON.stringify({ classes: oldSnapshot.classes, enums: oldSnapshot.enums });
  const newJson = JSON.stringify({ classes: newSnapshot.classes, enums: newSnapshot.enums });
  return oldJson !== newJson;
}
