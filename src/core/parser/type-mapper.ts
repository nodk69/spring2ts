// Java to TypeScript type mappings
const JAVA_TO_TS_TYPE: Record<string, string> = {
  'String': 'string',
  'string': 'string',
  'Integer': 'number',
  'int': 'number',
  'Long': 'number',
  'long': 'number',
  'Double': 'number',
  'double': 'number',
  'Float': 'number',
  'float': 'number',
  'BigDecimal': 'number',
  'BigInteger': 'number',
  'Boolean': 'boolean',
  'boolean': 'boolean',
  'Character': 'string',
  'char': 'string',
  'Byte': 'number',
  'byte': 'number',
  'Short': 'number',
  'short': 'number',
  'LocalDate': 'string',
  'LocalDateTime': 'string',
  'LocalTime': 'string',
  'Date': 'string',
  'Instant': 'string',
  'ZonedDateTime': 'string',
  'OffsetDateTime': 'string',
  'UUID': 'string',
  'Object': 'unknown',
  'void': 'void',
};

// Java primitive types (cannot be null)
const PRIMITIVE_TYPES = new Set([
  'int', 'long', 'double', 'float', 'boolean', 'byte', 'short', 'char'
]);

const COLLECTION_TYPES = new Set(['List', 'Set', 'Collection', 'Iterable', 'ArrayList', 'HashSet', 'LinkedHashSet', 'TreeSet']);
const MAP_TYPES = new Set(['Map', 'HashMap', 'TreeMap', 'LinkedHashMap', 'ConcurrentHashMap']);

export function mapJavaTypeToTS(javaType: string, knownClasses: Set<string> = new Set()): string {
  if (!javaType) return 'unknown';
  
  const trimmed = javaType.trim();

  if (COLLECTION_TYPES.has(trimmed)) return 'unknown[]';
  if (MAP_TYPES.has(trimmed)) return 'Record<string, unknown>';
  
  // Handle Optional<T>
  const optionalMatch = trimmed.match(/^Optional(?:Int|Long|Double)?<(.+)>$/);
  if (optionalMatch) {
    const innerType = mapJavaTypeToTS(optionalMatch[1], knownClasses);
    return `${innerType} | null`;
  }
  
  // Handle wildcard generics
  if (trimmed.includes('? extends')) {
    const match = trimmed.match(/\? extends (\w+)/);
    if (match) {
      return mapJavaTypeToTS(match[1], knownClasses);
    }
    return 'unknown';
  }
  
  if (trimmed.includes('? super')) {
    return 'unknown';
  }
  
  // Handle generics like List<String> or Map<String, Integer>
  const genericMatch = trimmed.match(/^([\w.]+)<(.+)>$/);
  if (genericMatch) {
    const [, container, inner] = genericMatch;
    const containerName = container.includes('.') ? container.split('.').pop()! : container;
    
    if (COLLECTION_TYPES.has(containerName)) {
      const innerType = parseGenericArguments(inner, knownClasses)[0] || 'unknown';
      return `${innerType}[]`;
    }
    
    if (MAP_TYPES.has(containerName)) {
      const [keyType, valueType] = parseGenericArguments(inner, knownClasses);
      return `Record<${keyType || 'string'}, ${valueType || 'unknown'}>`;
    }
    
    // ResponseEntity, Page, etc.
    const innerTypes = parseGenericArguments(inner, knownClasses);
    return `${containerName}<${innerTypes.join(', ')}>`;
  }
  
  // Handle arrays like String[]
  if (trimmed.endsWith('[]')) {
    const baseType = trimmed.slice(0, -2);
    return `${mapJavaTypeToTS(baseType, knownClasses)}[]`;
  }
  
  // Handle fully qualified names
  const simpleName = trimmed.includes('.') ? trimmed.split('.').pop()! : trimmed;
  
  // Check known mappings
  if (JAVA_TO_TS_TYPE[simpleName]) {
    return JAVA_TO_TS_TYPE[simpleName];
  }
  
  // Check if it's a known DTO class
  if (knownClasses.has(simpleName)) {
    return simpleName;
  }
  
  // Default to the original name
  return simpleName;
}

function parseGenericArguments(inner: string, knownClasses: Set<string>): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = '';
  
  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];
    
    if (char === '<') depth++;
    else if (char === '>') depth--;
    else if (char === ',' && depth === 0) {
      if (current.trim()) {
        args.push(mapJavaTypeToTS(current.trim(), knownClasses));
      }
      current = '';
      continue;
    }
    
    current += char;
  }
  
  if (current.trim()) {
    args.push(mapJavaTypeToTS(current.trim(), knownClasses));
  }
  
  return args;
}

export function isPrimitiveType(javaType: string): boolean {
  const baseType = extractBaseType(javaType);
  return PRIMITIVE_TYPES.has(baseType);
}

export function extractBaseType(javaType: string): string {
  let base = javaType.replace(/<[^>]+>/g, '');
  base = base.replace(/\[\]/g, '');
  base = base.includes('.') ? base.split('.').pop()! : base;
  return base.trim();
}

export function isNullable(annotations: string[], javaType?: string): boolean {
  if (javaType && isPrimitiveType(javaType)) {
    return false;
  }
  
  if (isRequired(annotations)) {
    return false;
  }
  
  if (javaType && javaType.startsWith('Optional<')) {
    return true;
  }
  
  const nullableAnnotations = ['Nullable', 'CheckForNull', 'Null'];
  const hasNullableAnnotation = annotations.some(ann => 
    nullableAnnotations.some(n => ann.includes(n))
  );
  
  if (hasNullableAnnotation) {
    return true;
  }
  
  return true;
}

export function isRequired(annotations: string[]): boolean {
  const requiredAnnotations = ['NotNull', 'NonNull', 'NotEmpty', 'NotBlank'];
  return annotations.some(ann => 
    requiredAnnotations.some(r => ann.includes(r))
  );
}