export interface FrontendUsageLocation {
  filePath: string;
  line: number;
  kind: 'class' | 'field';
  match: string;
}

export interface FrontendFieldUsage {
  locations: FrontendUsageLocation[];
}

export interface FrontendClassUsage {
  className: string;
  classLocations: FrontendUsageLocation[];
  fields: Record<string, FrontendFieldUsage>;
}

export interface FrontendUsageReport {
  scannedFiles: number;
  classes: Record<string, FrontendClassUsage>;
}
