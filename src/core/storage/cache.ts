import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { ensureDirectory } from '../../utils/file-utils';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  key: string;
}

interface CacheOptions {
  ttl?: number; // Default TTL in ms (default: 1 hour)
  cacheDir?: string; // Cache directory
}

const DEFAULT_TTL = 60 * 60 * 1000; // 1 hour
const DEFAULT_CACHE_DIR = '.spring2ts/cache';

/**
 * Simple file-based cache for parsed DTOs
 */
export class Cache<T> {
  private cacheDir: string;
  private defaultTTL: number;

  constructor(options: CacheOptions = {}) {
    this.cacheDir = options.cacheDir || path.join(process.cwd(), DEFAULT_CACHE_DIR);
    this.defaultTTL = options.ttl || DEFAULT_TTL;
    ensureDirectory(this.cacheDir);
  }

  /**
   * Generate cache key from input
   */
  private generateKey(input: string): string {
    return crypto.createHash('md5').update(input).digest('hex');
  }

  /**
   * Get cache file path for a key
   */
  private getCachePath(key: string): string {
    return path.join(this.cacheDir, `${key}.json`);
  }

  /**
   * Set a value in cache
   */
  set(key: string, value: T, ttl?: number): void {
    const cacheKey = this.generateKey(key);
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      key: cacheKey,
    };
    
    fs.writeFileSync(this.getCachePath(cacheKey), JSON.stringify(entry, null, 2), 'utf-8');
  }

  /**
   * Get a value from cache
   */
  get(key: string): T | null {
    const cacheKey = this.generateKey(key);
    const cachePath = this.getCachePath(cacheKey);
    
    if (!fs.existsSync(cachePath)) {
      return null;
    }
    
    try {
      const content = fs.readFileSync(cachePath, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(content);
      
      // Check if expired
      if (Date.now() - entry.timestamp > entry.ttl) {
        fs.unlinkSync(cachePath);
        return null;
      }
      
      return entry.data;
    } catch {
      return null;
    }
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete a key from cache
   */
  delete(key: string): void {
    const cacheKey = this.generateKey(key);
    const cachePath = this.getCachePath(cacheKey);
    
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    if (fs.existsSync(this.cacheDir)) {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          fs.unlinkSync(path.join(this.cacheDir, file));
        }
      }
    }
  }

  /**
   * Get cache stats
   */
  stats(): { count: number; size: number } {
    let count = 0;
    let size = 0;
    
    if (fs.existsSync(this.cacheDir)) {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          count++;
          const stats = fs.statSync(path.join(this.cacheDir, file));
          size += stats.size;
        }
      }
    }
    
    return { count, size };
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): number {
    let cleaned = 0;
    
    if (fs.existsSync(this.cacheDir)) {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const cachePath = path.join(this.cacheDir, file);
          try {
            const content = fs.readFileSync(cachePath, 'utf-8');
            const entry: CacheEntry<T> = JSON.parse(content);
            
            if (Date.now() - entry.timestamp > entry.ttl) {
              fs.unlinkSync(cachePath);
              cleaned++;
            }
          } catch {
            // Delete corrupted cache files
            fs.unlinkSync(cachePath);
            cleaned++;
          }
        }
      }
    }
    
    return cleaned;
  }
}

/**
 * Create a cache instance for parsed DTOs
 */
export function createParsedDTOCache(): Cache<any> {
  return new Cache({
    ttl: 30 * 60 * 1000, // 30 minutes
    cacheDir: path.join(process.cwd(), '.spring2ts/cache/parsed'),
  });
}

/**
 * Cache key generator for file paths
 */
export function generateFileCacheKey(filePath: string, content: string): string {
  return `${filePath}:${crypto.createHash('md5').update(content).digest('hex')}`;
}