export function extractAnnotations(content: string): string[] {
  const matches = content.matchAll(/@([A-Za-z_][A-Za-z0-9_]*)/g);
  return Array.from(matches, ([, name]) => name);
}

export function extractJsonPropertyName(content: string): string | null {
  const match = content.match(/@JsonProperty\s*\(\s*(?:value\s*=\s*)?"([^"]+)"/);
  return match ? match[1] : null;
}

export function extractJsonAlias(content: string): string[] {
  const match = content.match(/@JsonAlias\s*\(\s*(\{[^)]*\}|"[^"]+")\s*\)/);
  if (!match) {
    return [];
  }

  return Array.from(match[1].matchAll(/"([^"]+)"/g), ([, value]) => value);
}

export function extractEnumValues(content: string): string[] {
  const matches = content.matchAll(/\b([A-Z][A-Z0-9_]*)\b(?=\s*(?:\(|,|$))/g);
  return Array.from(matches, ([, value]) => value);
}
