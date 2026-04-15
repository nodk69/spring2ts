import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const CLI_PATH = path.join(process.cwd(), 'dist/index.js');
const TEST_DIR = path.join(process.cwd(), 'test-cli-output');
const FIXTURES_DIR = path.join(process.cwd(), 'tests/fixtures/java');

describe('CLI Integration', () => {
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

  it('should show help', () => {
    const output = execSync(`node ${CLI_PATH} --help`).toString();
    expect(output).toContain('Usage: spring2ts');
    expect(output).toContain('init');
    expect(output).toContain('check');
    expect(output).toContain('gen');
    expect(output).toContain('sync');
  });

  it('should show version', () => {
    const output = execSync(`node ${CLI_PATH} --version`).toString().trim();
    expect(output).toMatch(/\d+\.\d+\.\d+/);
  });

  it('should run gen command', () => {
    const outputDir = path.join(TEST_DIR, 'types');
    const output = execSync(`node ${CLI_PATH} gen --backend ${FIXTURES_DIR} --frontend ${outputDir}`).toString();
    
    expect(output).toContain('Generating TypeScript types');
    expect(fs.existsSync(outputDir)).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'index.ts'))).toBe(true);
  });

  it('should run check command', () => {
    const output = execSync(`node ${CLI_PATH} check --backend ${FIXTURES_DIR}`).toString();
    expect(output).toContain('Breaking Change Report');
  });

  it('should return exit code 3 on breaking changes', () => {
    // Create a modified version with breaking change
    const testBackend = path.join(TEST_DIR, 'backend');
    fs.mkdirSync(testBackend, { recursive: true });
    
    const testDto = path.join(testBackend, 'TestDto.java');
    fs.writeFileSync(testDto, 'package com.test; public class TestDto { private Long id; }');

    // First run to create baseline
    execSync(`node ${CLI_PATH} sync --backend ${testBackend} --frontend ${TEST_DIR}/out`);

    // Modify to create breaking change
    fs.writeFileSync(testDto, 'package com.test; public class TestDto { private String id; }');

    try {
      execSync(`node ${CLI_PATH} check --backend ${testBackend} --fail-on-breaking`);
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.status).toBe(3);
    }
  });

  it('should create config file with init', () => {
    const configDir = path.join(TEST_DIR, 'init-test');
    fs.mkdirSync(configDir, { recursive: true });
    
    process.chdir(configDir);
    execSync(`node ${CLI_PATH} init --backend ./backend --frontend ./types`);
    
    expect(fs.existsSync('.spring2tsrc.json')).toBe(true);
    const config = JSON.parse(fs.readFileSync('.spring2tsrc.json', 'utf-8'));
    expect(config.backend).toBe('./backend');
    expect(config.frontend).toBe('./types');
    
    process.chdir('../..');
  });
});