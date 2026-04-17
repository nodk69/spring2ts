import { DTOClass } from '../../../types/dto.types';

/**
 * Resolve inheritance relationships between DTOs
 */
export function resolveInheritance(dtos: DTOClass[]): DTOClass[] {
  const dtoMap = new Map(dtos.map(d => [d.className, d]));
  
  for (const dto of dtos) {
    if (dto.extends && dtoMap.has(dto.extends)) {
      const parent = dtoMap.get(dto.extends)!;
      dto.parentFields = parent.fields;
    }
  }
  
  return dtos;
}