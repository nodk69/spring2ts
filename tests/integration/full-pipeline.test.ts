import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseDTOs } from '../../src/core/parser/index';
import { generateTypeScript } from '../../src/core/generator/index';
import { checkBreakingChanges } from '../../src/core/diff/index';
import { createSnapshot, saveSnapshot } from '../../src/core/storage/snapshot';

const TEST_DIR = path.join(process.cwd(), 'test-output');
const FIXTURES_DIR = path.join(process.cwd(), 'tests/fixtures/java');

describe('Full Pipeline Integration', () => {
  beforeAll(() => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('should parse DTOs from fixtures', async () => {
    const parsed = await parseDTOs({
      inputPath: FIXTURES_DIR,
      excludePatterns: [],
      includeNested: true
    });

    expect(parsed.classes.length).toBeGreaterThan(0);
    expect(parsed.classes.some(c => c.className === 'UserDto')).toBe(true);
  });

  it('should generate TypeScript files', async () => {
    const parsed = await parseDTOs({
      inputPath: FIXTURES_DIR,
      excludePatterns: [],
      includeNested: true
    });

    const outputDir = path.join(TEST_DIR, 'generated');
    await generateTypeScript({
      outputPath: outputDir,
      parsed
    });

    expect(fs.existsSync(outputDir)).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'index.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'UserDto.ts'))).toBe(true);
  });

  it('should detect breaking changes', async () => {
    const parsed = await parseDTOs({
      inputPath: FIXTURES_DIR,
      excludePatterns: [],
      includeNested: true
    });

    const baselinePath = path.join(TEST_DIR, 'baseline.json');
    const snapshot = createSnapshot(parsed);
    saveSnapshot(snapshot, baselinePath);

    // Modify a class to create breaking change
    const modifiedParsed = { ...parsed };
    const userDto = modifiedParsed.classes.find(c => c.className === 'UserDto')!;
    userDto.fields = userDto.fields.filter(f => f.name !== 'email');

    const diff = await checkBreakingChanges({
      parsed: modifiedParsed,
      baselinePath,
      failOnBreaking: false,
      updateBaseline: false
    });

    expect(diff.hasBreakingChanges).toBe(true);
    expect(diff.changes).toContainEqual(expect.objectContaining({
      type: 'FIELD_REMOVED',
      className: 'UserDto',
      fieldName: 'email'
    }));
  });

  it('should handle empty backend directory gracefully', async () => {
    const emptyDir = path.join(TEST_DIR, 'empty');
    fs.mkdirSync(emptyDir, { recursive: true });

    const parsed = await parseDTOs({
      inputPath: emptyDir,
      excludePatterns: [],
      includeNested: true
    });

    expect(parsed.classes).toHaveLength(0);
    expect(parsed.enums).toHaveLength(0);
  });
});