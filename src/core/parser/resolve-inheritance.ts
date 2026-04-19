import { DTOClass } from '../../types/dto.types';

function extractBaseTypeName(qualifiedType: string): string {
  return qualifiedType
    .replace(/<[^>]+>/g, '')
    .replace(/\[\]/g, '')
    .split('.')
    .pop()!;
}

export function resolveInheritance(dtos: DTOClass[]): DTOClass[] {
  const dtoMap = new Map(dtos.map(d => [d.className, d]));
  
  for (const dto of dtos) {
    if (dto.extends) {
      const baseName = extractBaseTypeName(dto.extends);
      if (dtoMap.has(baseName)) {
        const parent = dtoMap.get(baseName)!;
        dto.parentFields = parent.fields;
      }
    }
  }
  
  return dtos;
}