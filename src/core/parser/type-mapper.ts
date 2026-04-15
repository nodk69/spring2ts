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
  'UUID': 'string',
  'Object': 'unknown',
  'void': 'void',
};

// Java primitive types (cannot be null)
const PRIMITIVE_TYPES = new Set([
  'int', 'long', 'double', 'float', 'boolean', 'byte', 'short', 'char'
]);

// Java wrapper types (can be null)
const WRAPPER_TYPES: Record<string, string> = {
  'Integer': 'int',
  'Long': 'long',
  'Double': 'double',
  'Float': 'float',
  'Boolean': 'boolean',
  'Byte': 'byte',
  'Short': 'short',
  'Character': 'char',
};

const COLLECTION_TYPES = ['List', 'Set', 'Collection', 'Iterable', 'ArrayList', 'HashSet'];
const MAP_TYPES = ['Map', 'HashMap', 'TreeMap', 'LinkedHashMap'];

export function mapJavaTypeToTS(javaType: string, knownClasses: Set<string> = new Set()): string {
  // Handle null/undefined
  if (!javaType) return 'unknown';
  
  // Remove whitespace
  const trimmed = javaType.trim();
  
  // Handle Optional<T>
  const optionalMatch = trimmed.match(/^Optional<(.+)>$/);
  if (optionalMatch) {
    const innerType = mapJavaTypeToTS(optionalMatch[1], knownClasses);
    return `${innerType} | null`;
  }
  
  // Handle generics like List<String> or Map<String, Integer>
  const genericMatch = trimmed.match(/^(\w+)<(.+)>$/);
  if (genericMatch) {
    const [, container, inner] = genericMatch;
    
    if (COLLECTION_TYPES.includes(container)) {
      const innerType = mapJavaTypeToTS(inner, knownClasses);
      return `${innerType}[]`;
    }
    
    if (MAP_TYPES.includes(container)) {
      const parts = inner.split(',').map(p => p.trim());
      if (parts.length === 2) {
        const keyType = mapJavaTypeToTS(parts[0], knownClasses);
        const valueType = mapJavaTypeToTS(parts[1], knownClasses);
        return `Record<${keyType}, ${valueType}>`;
      }
    }
    
    // Custom generic class
    const innerType = mapJavaTypeToTS(inner, knownClasses);
    return `${container}<${innerType}>`;
  }
  
  // Handle arrays like String[]
  if (trimmed.endsWith('[]')) {
    const baseType = trimmed.slice(0, -2);
    return `${mapJavaTypeToTS(baseType, knownClasses)}[]`;
  }
  
  // Check known mappings
  if (JAVA_TO_TS_TYPE[trimmed]) {
    return JAVA_TO_TS_TYPE[trimmed];
  }
  
  // Check if it's a known DTO class
  if (knownClasses.has(trimmed)) {
    return trimmed;
  }
  
  // Default to the original name (custom class)
  return trimmed;
}

export function isPrimitiveType(javaType: string): boolean {
  const baseType = extractBaseType(javaType);
  return PRIMITIVE_TYPES.has(baseType);
}

export function isWrapperType(javaType: string): boolean {
  const baseType = extractBaseType(javaType);
  return baseType in WRAPPER_TYPES;
}

export function extractBaseType(javaType: string): string {
  // Remove generics
  let base = javaType.replace(/<[^>]+>/g, '');
  // Remove array brackets
  base = base.replace(/\[\]/g, '');
  return base.trim();
}

export function isNullable(annotations: string[], javaType?: string): boolean {
  // Primitive types CANNOT be null in Java (this overrides everything)
  if (javaType && isPrimitiveType(javaType)) {
    return false;
  }
  
  // If @NotNull, @NotEmpty, or @NotBlank is present, it's REQUIRED (not nullable)
  if (isRequired(annotations)) {
    return false;
  }
  
  // Optional<T> is always nullable
  if (javaType && javaType.startsWith('Optional<')) {
    return true;
  }
  
  // Check for explicit nullable annotations
  const nullableAnnotations = ['Nullable', 'CheckForNull', 'Null'];
  const hasNullableAnnotation = annotations.some(ann => 
    nullableAnnotations.some(n => ann.includes(n))
  );
  
  if (hasNullableAnnotation) {
    return true;
  }
  
  // Default: nullable (wrapper types, String, custom classes are all nullable by default)
  return true;
}

export function isRequired(annotations: string[]): boolean {
  const requiredAnnotations = ['NotNull', 'NotEmpty', 'NotBlank'];
  return annotations.some(ann => 
    requiredAnnotations.some(r => ann.includes(r))
  );
}