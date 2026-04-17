import * as fs from 'fs';

/**
 * Parse TypeScript interface and extract field names and types
 */
function parseExistingInterface(content: string): Map<string, string> {
  const fields = new Map<string, string>();
  
  // Match interface fields: fieldName?: type;
  const fieldRegex = /^\s*(\w+)(\?)?:\s*([^;]+);/gm;
  
  let match;
  while ((match = fieldRegex.exec(content)) !== null) {
    const fieldName = match[1];
    const optional = match[2] || '';
    const fieldType = match[3];
    fields.set(fieldName, `${optional}: ${fieldType}`);
  }
  
  return fields;
}

/**
 * Merge generated interface with existing file
 */
export function mergeInterface(existingPath: string, generated: string): string {
  // If file doesn't exist, just return generated
  if (!fs.existsSync(existingPath)) {
    return generated;
  }
  
  const existing = fs.readFileSync(existingPath, 'utf-8');
  
  // Parse existing fields
  const existingFields = parseExistingInterface(existing);
  
  // Parse generated fields
  const generatedFields = parseExistingInterface(generated);
  
  // Find user-added fields (in existing but not in generated)
  const userFields = new Map<string, string>();
  for (const [name, def] of existingFields) {
    if (!generatedFields.has(name)) {
      userFields.set(name, def);
    }
  }
  
  // If no user fields, just return generated
  if (userFields.size === 0) {
    return generated;
  }
  
  // Insert user fields before the closing brace
  const lines = generated.split('\n');
  const insertIndex = lines.length - 1; // Before the closing '}'
  
  for (const [name, def] of userFields) {
    lines.splice(insertIndex, 0, `  ${name}${def};`);
  }
  
  return lines.join('\n');
}