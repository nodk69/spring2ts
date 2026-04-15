import { UserDto } from './UserDto';

export interface AdvancedDto extends UserDto {
  /** Also accepts: phone, mobile */
  phone_number?: string;
  middleName?: string | null;
  requiredField: string;
}
