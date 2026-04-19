/**
 * Check if a field has the @JsonIgnore annotation.
 */
export function hasJsonIgnore(fieldText: string, annotations: string[]): boolean {
  return annotations.includes('JsonIgnore') || fieldText.includes('@JsonIgnore');
}

/**
 * Generate warnings for Jackson annotations that affect serialization.
 */
export function getJacksonWarnings(fieldText: string, annotations: string[]): string[] {
  const warnings: string[] = [];
  
  if (annotations.includes('JsonSerialize') || fieldText.includes('@JsonSerialize')) {
    warnings.push(`@JsonSerialize detected - type may differ from Java type`);
  }
  if (annotations.includes('JsonDeserialize') || fieldText.includes('@JsonDeserialize')) {
    warnings.push(`@JsonDeserialize detected - custom deserializer may affect parsing`);
  }
  if (annotations.includes('JsonFormat') || fieldText.includes('@JsonFormat')) {
    warnings.push(`@JsonFormat detected - serialization format may differ`);
  }
  if (annotations.includes('JsonUnwrapped') || fieldText.includes('@JsonUnwrapped')) {
    warnings.push(`@JsonUnwrapped detected - fields are flattened in response`);
  }
  if (annotations.includes('JsonTypeInfo') || fieldText.includes('@JsonTypeInfo')) {
    warnings.push(`@JsonTypeInfo detected - polymorphic type handling in use`);
  }
  if (annotations.includes('JsonBackReference') || fieldText.includes('@JsonBackReference')) {
    warnings.push(`@JsonBackReference detected - bidirectional relationship (ignored in TS)`);
  }
  if (annotations.includes('JsonManagedReference') || fieldText.includes('@JsonManagedReference')) {
    warnings.push(`@JsonManagedReference detected - bidirectional relationship (ignored in TS)`);
  }
  
  return warnings;
}