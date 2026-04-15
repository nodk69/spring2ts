export function extractAnnotations(fieldCode: string): string[] {
  const annotations: string[] = [];
  
  // Pattern to match annotations like @NotNull, @Size(min=1), @JsonProperty("name")
  const annotationRegex = /@(\w+)(?:\([^)]*\))?/g;
  
  let match;
  while ((match = annotationRegex.exec(fieldCode)) !== null) {
    annotations.push(match[1]);
  }
  
  return annotations;
}

/**
 * Extract @JsonProperty value
 * Example: @JsonProperty("user_name") -> "user_name"
 */
export function extractJsonPropertyName(fieldCode: string): string | null {
  const jsonPropertyRegex = /@JsonProperty\s*\(\s*(?:value\s*=\s*)?"([^"]+)"\s*\)/;
  const match = fieldCode.match(jsonPropertyRegex);
  return match ? match[1] : null;
}

/**
 * Extract @JsonAlias values
 * Example: @JsonAlias({"name", "fullName"}) -> ["name", "fullName"]
 */
export function extractJsonAlias(fieldCode: string): string[] {
  const aliasRegex = /@JsonAlias\s*\(\s*\{?\s*"([^"]+)"(?:\s*,\s*"([^"]+)")*\s*\}?\s*\)/;
  const match = fieldCode.match(aliasRegex);
  
  if (!match) return [];
  
  // Extract all quoted strings
  const quotesRegex = /"([^"]+)"/g;
  const aliases: string[] = [];
  let quoteMatch;
  while ((quoteMatch = quotesRegex.exec(match[0])) !== null) {
    aliases.push(quoteMatch[1]);
  }
  return aliases;
}

export function extractEnumValues(enumBody: string): string[] {
  const values: string[] = [];
  
  // Remove comments
  const cleanBody = enumBody
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Extract enum constants (before any methods or semicolon)
  const enumConstantsMatch = cleanBody.match(/^\s*([^;{]*)/);
  if (enumConstantsMatch) {
    const constants = enumConstantsMatch[1]
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0);
    
    // Remove any parentheses content (like VALUE("display"))
    for (const constant of constants) {
      const nameMatch = constant.match(/^(\w+)/);
      if (nameMatch) {
        values.push(nameMatch[1]);
      }
    }
  }
  
  return values;
}