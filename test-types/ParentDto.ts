import { GrandparentDto } from './GrandparentDto';

export interface ParentDto extends GrandparentDto {
  parentId?: number;
  parentName?: string;
}
