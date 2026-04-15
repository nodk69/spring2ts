export interface EdgeCasesDto {
  class?: string;
  interface?: string;
  enum?: string;
  'field-name'?: string;
  'field.name'?: string;
  thisIsAVeryLongFieldNameThatShouldStillWorkCorrectly?: string;
  CONSTANT?: string;
}
