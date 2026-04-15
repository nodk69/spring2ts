// Internal DTO representation after parsing Java files

export interface DTOField {
  name: string;
  jsonName?: string;           // @JsonProperty value
  jsonAliases?: string[];      // @JsonAlias values
  javaType: string;
  tsType: string;
  nullable: boolean;
  isEnum: boolean;
  enumName?: string;
  genericType?: string;
  annotations: string[];
}

export interface DTOClass {
  className: string;
  packageName: string;
  fields: DTOField[];
  imports: string[];
  extends?: string;
  implements?: string[];
  isEnum: boolean;
  enumValues?: string[];
  filePath: string;
  parentFields?: DTOField[];
}

export interface ParsedDTO {
  classes: DTOClass[];
  enums: DTOClass[];
}

export interface ParseOptions {
  inputPath: string;
  excludePatterns?: string[];
  includeNested?: boolean;
}