import * as fs from 'fs';
import * as crypto from 'crypto';
import { logger } from '../../utils/logger';
import { ensureDirectory, pathExists, readTextFile } from '../../utils/filesystem';
import { joinPaths } from '../../utils/paths';

interface CacheEntry {
  data: any;
  sourceHash: string;
  timestamp: number;
}

export class ParseCache {
  private cacheDir: string;
  private memoryCache = new Map<string, CacheEntry>();
  private readonly MAX_MEMORY_ENTRIES = 500;
  
  constructor() {
    this.cacheDir = joinPaths(process.cwd(), '.spring2ts/cache/parse');
    this.ensureDir();
  }
  
  private ensureDir(): void {
    ensureDirectory(this.cacheDir);
  }
  
  private getKey(input: string): string {
    return crypto.createHash('md5').update(input).digest('hex');
  }
  
  private getPath(key: string): string {
    return joinPaths(this.cacheDir, `${key}.json`);
  }
  
  /**
   * Get cached data if source hasn't changed
   */
  get(key: string, sourceContent?: string): any | null {
    const cacheKey = this.getKey(key);
    
    // Check memory first
    const memEntry = this.memoryCache.get(cacheKey);
    if (memEntry) {
      if (sourceContent) {
        const currentHash = this.hashContent(sourceContent);
        if (memEntry.sourceHash !== currentHash) {
          this.memoryCache.delete(cacheKey);
          return null;
        }
      }
      return memEntry.data;
    }
    
    // Check disk
    const cachePath = this.getPath(cacheKey);
    if (!pathExists(cachePath)) return null;
    
    try {
      const entry: CacheEntry = JSON.parse(readTextFile(cachePath));
      
      if (sourceContent) {
        const currentHash = this.hashContent(sourceContent);
        if (entry.sourceHash !== currentHash) {
          fs.unlinkSync(cachePath);
          return null;
        }
      }
      
      // Cache in memory
      this.memoryCache.set(cacheKey, entry);
      this.evictIfNeeded();
      
      return entry.data;
    } catch (error) {
      logger.debug(`Cache read failed for ${key}: ${error}`);
      return null;
    }
  }
  
  /**
   * Store data in cache with source hash
   */
  set(key: string, data: any, sourceContent?: string): void {
    const cacheKey = this.getKey(key);
    const sourceHash = sourceContent 
      ? this.hashContent(sourceContent) 
      : crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
    
    const entry: CacheEntry = {
      data,
      sourceHash,
      timestamp: Date.now()
    };
    
    // Store in memory
    this.memoryCache.set(cacheKey, entry);
    this.evictIfNeeded();
    
    // Persist to disk
    try {
      fs.writeFileSync(this.getPath(cacheKey), JSON.stringify(entry, null, 2));
    } catch (error) {
      logger.debug(`Cache write failed for ${key}: ${error}`);
    }
  }
  
  /**
   * Check if cache has valid entry
   */
  has(key: string, sourceContent?: string): boolean {
    return this.get(key, sourceContent) !== null;
  }
  
  /**
   * Clear all cache
   */
  clear(): void {
    this.memoryCache.clear();
    if (pathExists(this.cacheDir)) {
      fs.rmSync(this.cacheDir, { recursive: true, force: true });
    }
    this.ensureDir();
  }
  
  /**
   * Get cache statistics
   */
  getStats(): { memoryEntries: number; diskEntries: number } {
    let diskEntries = 0;
    if (pathExists(this.cacheDir)) {
      diskEntries = fs.readdirSync(this.cacheDir).filter(f => f.endsWith('.json')).length;
    }
    return {
      memoryEntries: this.memoryCache.size,
      diskEntries
    };
  }
  
  private hashContent(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }
  
  private evictIfNeeded(): void {
    if (this.memoryCache.size > this.MAX_MEMORY_ENTRIES) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
      }
    }
  }
}

// Singleton instance
export const parseCache = new ParseCache();
