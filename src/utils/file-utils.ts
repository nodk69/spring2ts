import * as fs from 'fs';
import * as path from 'path';

export async function findJavaFiles(inputPath: string, excludePatterns: string[] = []): Promise<string[]> {
  const files: string[] = [];
  const absolutePath = path.resolve(inputPath);
  
  // Check if directory exists
  if (!fs.existsSync(absolutePath)) {
    console.log(`⚠️  Directory not found: ${absolutePath}`);
    return files;
  }
  
  // Check if it's actually a directory
  const stat = fs.statSync(absolutePath);
  if (!stat.isDirectory()) {
    return files;
  }
  
  function scanDirectory(dir: string): void {
    try {
      const entries = fs.readdirSync(dir);
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        
        // Skip excluded patterns
        let shouldExclude = false;
        for (const pattern of excludePatterns) {
          if (fullPath.includes(pattern.replace(/\*/g, ''))) {
            shouldExclude = true;
            break;
          }
        }
        
        if (shouldExclude) continue;
        
        try {
          const entryStat = fs.statSync(fullPath);
          
          if (entryStat.isDirectory()) {
            scanDirectory(fullPath);
          } else if (entry.endsWith('.java')) {
            files.push(fullPath);
          }
        } catch {
          // Skip files that can't be accessed
        }
      }
    } catch {
      // Skip directories that can't be scanned
    }
  }
  
  scanDirectory(absolutePath);
  
  return files;
}

export function readJavaFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

export function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function writeFile(filePath: string, content: string): void {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}