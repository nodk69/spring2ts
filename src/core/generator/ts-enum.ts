import { DTOClass } from '../../types/dto.types';

export function generateEnum(enumDto: DTOClass): string {
  const lines: string[] = [];
  
  lines.push(`export enum ${enumDto.className} {`);
  
  if (enumDto.enumValues) {
    for (let i = 0; i < enumDto.enumValues.length; i++) {
      const value = enumDto.enumValues[i];
      const comma = i < enumDto.enumValues.length - 1 ? ',' : '';
      lines.push(`  ${value} = '${value}'${comma}`);
    }
  }
  
  lines.push('}');
  
  return lines.join('\n');
}