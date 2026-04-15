export interface AnnotationsTestDto {
  custom_name?: string;
  /** Also accepts: alias1, alias2, alias3 */
  aliasedField?: string;
  requiredField: string;
  nullableField?: string;
  /** Also accepts: nested_alias */
  nested_name: string;
}
