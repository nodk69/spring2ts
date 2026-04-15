import { ParentDto } from './ParentDto';

export interface ChildDto extends ParentDto {
  childId?: number;
  childName?: string;
}
