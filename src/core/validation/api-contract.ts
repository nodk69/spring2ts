import { ParsedDTO, DTOClass, DTOField } from '../../types/dto.types';

type JsonSchema = Record<string, any>;
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface ApiSchemaField {
  name: string;
  required: boolean;
  type: string;
}

export interface ApiResponseSchema {
  name: string;
  fields: ApiSchemaField[];
  source: string;
}

export interface RuntimeExtraField {
  dto: string;
  apiField: string;
}

export interface RuntimeTypeMismatch {
  dto: string;
  field: string;
  dtoType: string;
  apiType: string;
}

export interface RuntimeRequiredMismatch {
  dto: string;
  field: string;
  dtoRequired: boolean;
  apiRequired: boolean;
}

export interface RuntimeMissingField {
  dto: string;
  field: string;
}

export interface RuntimeValidationReport {
  matched: string[];
  missing: string[];
  extraFields: RuntimeExtraField[];
  typeMismatches: RuntimeTypeMismatch[];
  missingFields: RuntimeMissingField[];
  requiredMismatches: RuntimeRequiredMismatch[];
  warnings: string[];
  source?: string;
  schemas: ApiResponseSchema[];
  error?: string;
}

export interface RuntimeEndpointTypeMismatch {
  field: string;
  dtoType: string;
  responseType: string;
}

export interface RuntimeEndpointFieldsReport {
  matching: string[];
  extra: string[];
  missing: string[];
  typeMismatches: RuntimeEndpointTypeMismatch[];
}

export interface DiscoveredEndpoint {
  endpoint: string;
  method: 'GET';
  url: string;
  dtoClass?: string;
  responseType: string;
  source: string;
  schema?: JsonSchema;
}

export interface EndpointCallResult {
  ok: boolean;
  status: number;
  responseType?: string;
  body?: JsonValue;
  skipped?: 'auth_required' | 'non_json' | 'empty' | 'timeout' | 'network_error' | 'http_error';
  error?: string;
}

export interface RuntimeEndpointValidationReport {
  endpoint: string;
  method: 'GET';
  dtoClass?: string;
  responseType: string;
  sampleSize: number;
  fields: RuntimeEndpointFieldsReport;
  openApiMatch: boolean;
  status?: number;
  skipped?: string;
  error?: string;
}

export interface RuntimeEndpointValidationOptions {
  sampleSize?: number;
  timeoutSeconds?: number;
  includeAuth?: boolean;
  endpoints?: string[];
}

export interface RuntimeEndpointValidationSummary {
  endpoints: RuntimeEndpointValidationReport[];
  warnings: string[];
  source?: string;
  discovered: number;
  checked: number;
  skipped: number;
  error?: string;
}

interface FetchOptions {
  expectJson?: boolean;
  timeoutMs?: number;
}

interface OpenApiSpecLoadResult {
  document: JsonSchema;
  source: string;
}

interface FieldTypeMapEntry {
  observed: Set<string>;
  count: number;
}

interface ShapeSummary {
  responseType: string;
  sampleSize: number;
  fields: Map<string, FieldTypeMapEntry>;
}

const OPENAPI_NOT_FOUND_MESSAGE = 'No OpenAPI spec found, try installing springdoc-openapi';
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RESPONSE_SAMPLE_SIZE = 3;
const MAX_NESTED_DEPTH = 3;
const PAGE_COLLECTION_KEYS = ['content', 'data', 'items'] as const;

export async function validateAgainstRuntime(
  parsedDTOs: ParsedDTO,
  baseUrl: string
): Promise<RuntimeValidationReport> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  try {
    const spec = await loadOpenApiSpec(normalizedBaseUrl);
    if (!spec) {
      return emptyReport({
        error: OPENAPI_NOT_FOUND_MESSAGE,
      });
    }

    const schemas = extractApiResponseSchemas(spec.document, spec.source);
    return buildRuntimeReport(parsedDTOs, schemas, spec.source);
  } catch (error) {
    return emptyReport({
      error: toRuntimeErrorMessage(normalizedBaseUrl, error, DEFAULT_TIMEOUT_MS),
    });
  }
}

export async function validateEndpointResponses(
  parsedDTOs: ParsedDTO,
  baseUrl: string,
  options: RuntimeEndpointValidationOptions = {}
): Promise<RuntimeEndpointValidationSummary> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const timeoutMs = Math.max(1, Math.trunc((options.timeoutSeconds ?? 5) * 1000));
  const sampleSize = Math.max(1, Math.trunc(options.sampleSize ?? DEFAULT_RESPONSE_SAMPLE_SIZE));
  const includeAuth = options.includeAuth ?? false;
  const endpointFilter = new Set((options.endpoints ?? []).map(normalizeEndpointPath));

  try {
    const spec = await loadOpenApiSpec(normalizedBaseUrl);
    if (!spec) {
      return {
        endpoints: [],
        warnings: [],
        discovered: 0,
        checked: 0,
        skipped: 0,
        error: OPENAPI_NOT_FOUND_MESSAGE,
      };
    }

    const discoveredEndpoints = await discoverEndpoints(normalizedBaseUrl, spec.document, {
      includeActuatorFallback: true,
    });
    const selectedEndpoints = discoveredEndpoints.filter((entry) => {
      if (endpointFilter.size === 0) {
        return true;
      }

      return endpointFilter.has(normalizeEndpointPath(entry.endpoint));
    });

    const dtoMap = new Map(parsedDTOs.classes.map((dto) => [dto.className, dto]));
    const reports: RuntimeEndpointValidationReport[] = [];
    const warnings: string[] = [];
    let skipped = 0;

    for (const endpoint of selectedEndpoints) {
      const callResult = await callEndpoint(endpoint.url, {
        timeoutSeconds: options.timeoutSeconds ?? 5,
        includeAuth,
      });

      if (!callResult.ok) {
        skipped += 1;
        const report: RuntimeEndpointValidationReport = {
          endpoint: endpoint.endpoint,
          method: endpoint.method,
          dtoClass: endpoint.dtoClass,
          responseType: endpoint.responseType,
          sampleSize: 0,
          fields: {
            matching: [],
            extra: [],
            missing: [],
            typeMismatches: [],
          },
          openApiMatch: false,
          status: callResult.status,
          skipped: callResult.skipped,
          error: callResult.error,
        };
        reports.push(report);

        if (callResult.skipped !== 'auth_required' || includeAuth) {
          warnings.push(
            `Skipped GET ${endpoint.endpoint}: ${callResult.error ?? callResult.skipped ?? 'request failed'}`
          );
        }
        continue;
      }

      const dto = endpoint.dtoClass ? dtoMap.get(endpoint.dtoClass) : undefined;
      const dtoComparison = compareResponseToDTO(callResult.body, dto, sampleSize);
      const openApiComparison = compareResponseToSchema(callResult.body, endpoint.schema, spec.document, sampleSize);

      reports.push({
        endpoint: endpoint.endpoint,
        method: endpoint.method,
        dtoClass: endpoint.dtoClass,
        responseType: dtoComparison.responseType,
        sampleSize: dtoComparison.sampleSize,
        fields: dtoComparison.fields,
        openApiMatch: openApiComparison.matches,
        status: callResult.status,
      });

      if (!endpoint.dtoClass) {
        warnings.push(`GET ${endpoint.endpoint} has no DTO mapping in OpenAPI`);
      }

      if (!openApiComparison.matches) {
        warnings.push(`GET ${endpoint.endpoint} response does not match the OpenAPI schema`);
      }
    }

    return {
      endpoints: reports,
      warnings,
      source: spec.source,
      discovered: selectedEndpoints.length,
      checked: reports.length - skipped,
      skipped,
    };
  } catch (error) {
    return {
      endpoints: [],
      warnings: [],
      discovered: 0,
      checked: 0,
      skipped: 0,
      error: toRuntimeErrorMessage(normalizedBaseUrl, error, timeoutMs),
    };
  }
}

export async function discoverEndpoints(
  baseUrl: string,
  openApiDocument?: JsonSchema,
  options: { includeActuatorFallback?: boolean } = {}
): Promise<DiscoveredEndpoint[]> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const endpoints = new Map<string, DiscoveredEndpoint>();
  const spec = openApiDocument ?? (await loadOpenApiSpec(normalizedBaseUrl))?.document;

  if (spec) {
    const components = (spec.components?.schemas ?? {}) as Record<string, JsonSchema>;
    for (const [pathName, pathItem] of Object.entries(spec.paths ?? {})) {
      if (!pathItem || typeof pathItem !== 'object') {
        continue;
      }

      const operation = (pathItem as Record<string, JsonSchema>).get;
      if (!operation || typeof operation !== 'object') {
        continue;
      }

      const response = getPreferredJsonResponse(operation.responses as Record<string, JsonSchema> | undefined);
      if (!response) {
        continue;
      }

      const key = `GET ${pathName}`;
      endpoints.set(key, {
        endpoint: normalizeEndpointPath(pathName),
        method: 'GET',
        url: toAbsoluteUrl(normalizedBaseUrl, pathName),
        dtoClass: resolveDtoClassFromSchema(response.schema, components, new Set()),
        responseType: describeResponseSchemaType(response.schema, components, new Set()),
        source: 'openapi',
        schema: response.schema,
      });
    }
  }

  if (options.includeActuatorFallback) {
    const actuatorEndpoints = await discoverEndpointsFromActuator(normalizedBaseUrl);
    for (const endpoint of actuatorEndpoints) {
      const key = `GET ${endpoint.endpoint}`;
      if (!endpoints.has(key)) {
        endpoints.set(key, endpoint);
      }
    }
  }

  return Array.from(endpoints.values()).sort((left, right) => left.endpoint.localeCompare(right.endpoint));
}

export async function callEndpoint(
  url: string,
  options: { timeoutSeconds?: number; includeAuth?: boolean } = {}
): Promise<EndpointCallResult> {
  const timeoutMs = Math.max(1, Math.trunc((options.timeoutSeconds ?? 5) * 1000));
  const result = await fetchResource(url, { expectJson: true, timeoutMs });

  if (!result.ok) {
    if ((result.status === 401 || result.status === 403) && !options.includeAuth) {
      return {
        ok: false,
        status: result.status,
        skipped: 'auth_required',
        error: `HTTP ${result.status}`,
      };
    }

    if (result.status !== undefined) {
      return {
        ok: false,
        status: result.status,
        skipped: 'http_error',
        error: `HTTP ${result.status}`,
      };
    }

    if (isTimeoutError(result.error)) {
      return {
        ok: false,
        status: 0,
        skipped: 'timeout',
        error: `Request timed out after ${Math.trunc(timeoutMs / 1000)}s`,
      };
    }

    return {
      ok: false,
      status: 0,
      skipped: 'network_error',
      error: errorToString(result.error),
    };
  }

  if (typeof result.body === 'string') {
    return {
      ok: false,
      status: 200,
      skipped: 'non_json',
      error: 'Non-JSON response',
    };
  }

  if (typeof result.body === 'undefined') {
    return {
      ok: false,
      status: 200,
      skipped: 'empty',
      error: 'Empty response',
    };
  }

  return {
    ok: true,
    status: 200,
    responseType: inferType(result.body),
    body: result.body as JsonValue,
  };
}

export function inferType(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  switch (typeof value) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'object':
      return 'object';
    default:
      return 'unknown';
  }
}

export function compareResponseToDTO(
  response: unknown,
  dtoClass?: DTOClass,
  sampleSize: number = DEFAULT_RESPONSE_SAMPLE_SIZE
): { responseType: string; sampleSize: number; fields: RuntimeEndpointFieldsReport } {
  const summary = summarizeResponseShape(response, sampleSize);
  if (!dtoClass) {
    return {
      responseType: summary.responseType,
      sampleSize: summary.sampleSize,
      fields: {
        matching: [],
        extra: Array.from(summary.fields.keys()).sort(),
        missing: [],
        typeMismatches: [],
      },
    };
  }

  const dtoFields = collectDtoFields(dtoClass);
  const matching: string[] = [];
  const extra: string[] = [];
  const missing: string[] = [];
  const typeMismatches: RuntimeEndpointTypeMismatch[] = [];

  for (const [fieldName, observed] of summary.fields.entries()) {
    const dtoField = dtoFields.get(fieldName);
    if (!dtoField) {
      extra.push(fieldName);
      continue;
    }

    matching.push(fieldName);
    const dtoType = normalizeTypeName(dtoField.isEnum && dtoField.enumName ? dtoField.enumName : dtoField.tsType);
    const responseType = normalizeObservedTypes(observed.observed);
    if (!typesCompatible(dtoType, observed.observed)) {
      typeMismatches.push({
        field: fieldName,
        dtoType,
        responseType,
      });
    }
  }

  for (const fieldName of dtoFields.keys()) {
    if (!summary.fields.has(fieldName)) {
      missing.push(fieldName);
    }
  }

  return {
    responseType: summary.responseType,
    sampleSize: summary.sampleSize,
    fields: {
      matching: matching.sort(),
      extra: extra.sort(),
      missing: missing.sort(),
      typeMismatches: typeMismatches.sort((left, right) => left.field.localeCompare(right.field)),
    },
  };
}

async function loadOpenApiSpec(baseUrl: string): Promise<OpenApiSpecLoadResult | null> {
  const apiDocsUrl = `${baseUrl}/v3/api-docs`;
  const apiDocs = await fetchResource(apiDocsUrl, { expectJson: true, timeoutMs: DEFAULT_TIMEOUT_MS });
  if (apiDocs.ok && isOpenApiDocument(apiDocs.body)) {
    return { document: apiDocs.body, source: apiDocsUrl };
  }
  if (!apiDocs.ok) {
    throwIfTransportError(apiDocs);
  }

  const swaggerHtmlUrl = `${baseUrl}/swagger-ui.html`;
  const swaggerHtml = await fetchResource(swaggerHtmlUrl, { expectJson: false, timeoutMs: DEFAULT_TIMEOUT_MS });
  if (!swaggerHtml.ok) {
    throwIfTransportError(swaggerHtml);
    return null;
  }

  if (typeof swaggerHtml.body !== 'string') {
    return null;
  }

  const candidateUrls = extractOpenApiCandidatesFromSwaggerHtml(baseUrl, swaggerHtml.body);
  for (const candidateUrl of candidateUrls) {
    const candidate = await fetchResource(candidateUrl, { expectJson: true, timeoutMs: DEFAULT_TIMEOUT_MS });
    if (candidate.ok && isOpenApiDocument(candidate.body)) {
      return { document: candidate.body, source: candidateUrl };
    }
    if (!candidate.ok) {
      throwIfTransportError(candidate);
      continue;
    }

    if (candidate.ok && isSwaggerConfig(candidate.body)) {
      const nestedUrls = extractOpenApiCandidatesFromSwaggerConfig(baseUrl, candidate.body);
      for (const nestedUrl of nestedUrls) {
        const nested = await fetchResource(nestedUrl, { expectJson: true, timeoutMs: DEFAULT_TIMEOUT_MS });
        if (nested.ok && isOpenApiDocument(nested.body)) {
          return { document: nested.body, source: nestedUrl };
        }
        if (!nested.ok) {
          throwIfTransportError(nested);
        }
      }
    }
  }

  return null;
}

async function discoverEndpointsFromActuator(baseUrl: string): Promise<DiscoveredEndpoint[]> {
  const result = await fetchResource(`${baseUrl}/actuator/mappings`, {
    expectJson: true,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });

  if (!result.ok || !result.body || typeof result.body !== 'object') {
    return [];
  }

  const endpoints = new Set<string>();
  collectActuatorGetEndpoints(result.body as JsonSchema, endpoints);

  return Array.from(endpoints)
    .sort()
    .map((endpoint) => ({
      endpoint,
      method: 'GET' as const,
      url: toAbsoluteUrl(baseUrl, endpoint),
      responseType: 'unknown',
      source: 'actuator',
    }));
}

function collectActuatorGetEndpoints(node: unknown, endpoints: Set<string>): void {
  if (!node) {
    return;
  }

  if (Array.isArray(node)) {
    for (const entry of node) {
      collectActuatorGetEndpoints(entry, endpoints);
    }
    return;
  }

  if (typeof node !== 'object') {
    return;
  }

  const candidate = node as Record<string, unknown>;
  const methods = candidate.methods;
  const directPredicate = candidate.predicate;
  const details = candidate.details;
  const requestMappingConditions = typeof details === 'object' && details
    ? (details as Record<string, unknown>).requestMappingConditions
    : undefined;

  const patterns = extractActuatorPatterns(requestMappingConditions ?? directPredicate);
  const methodList = extractActuatorMethods(methods ?? requestMappingConditions);
  if (patterns.length > 0 && methodList.includes('GET')) {
    for (const pattern of patterns) {
      endpoints.add(normalizeEndpointPath(pattern));
    }
  }

  for (const value of Object.values(candidate)) {
    collectActuatorGetEndpoints(value, endpoints);
  }
}

function extractActuatorPatterns(node: unknown): string[] {
  if (!node) {
    return [];
  }

  if (typeof node === 'string') {
    return Array.from(node.matchAll(/['"]?(\/[^'",}\s]+)['"]?/g)).map((match) => normalizeEndpointPath(match[1]));
  }

  if (Array.isArray(node)) {
    return node.flatMap((entry) => extractActuatorPatterns(entry));
  }

  if (typeof node !== 'object') {
    return [];
  }

  const candidate = node as Record<string, unknown>;
  const values = ['patternValues', 'patterns', 'pathPatterns', 'predicate'].flatMap((key) =>
    key in candidate ? extractActuatorPatterns(candidate[key]) : []
  );
  return Array.from(new Set(values));
}

function extractActuatorMethods(node: unknown): string[] {
  if (!node) {
    return [];
  }

  if (Array.isArray(node)) {
    return node.flatMap((entry) => extractActuatorMethods(entry));
  }

  if (typeof node === 'string') {
    return node.toUpperCase().includes('GET') ? ['GET'] : [];
  }

  if (typeof node !== 'object') {
    return [];
  }

  const candidate = node as Record<string, unknown>;
  return ['methods', 'method'].flatMap((key) => (key in candidate ? extractActuatorMethods(candidate[key]) : []));
}

async function fetchResource(
  url: string,
  options: FetchOptions
): Promise<{ ok: true; body: unknown } | { ok: false; error: unknown; status?: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('timeout'), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: options.expectJson === false ? { Accept: 'text/html,application/json' } : { Accept: 'application/json' },
    });

    if (!response.ok) {
      return { ok: false, error: new Error(`HTTP ${response.status}`), status: response.status };
    }

    if (options.expectJson === false) {
      return { ok: true, body: await response.text() };
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('json')) {
      return { ok: true, body: await response.text() };
    }

    const text = await response.text();
    if (!text.trim()) {
      return { ok: true, body: undefined };
    }

    return { ok: true, body: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error };
  } finally {
    clearTimeout(timeout);
  }
}

function throwIfTransportError(result: { ok: false; error: unknown; status?: number }): void {
  if (result.status !== undefined) {
    return;
  }

  throw result.error;
}

function buildRuntimeReport(
  parsedDTOs: ParsedDTO,
  schemas: ApiResponseSchema[],
  source: string
): RuntimeValidationReport {
  const schemaMap = new Map(schemas.map((schema) => [schema.name, schema]));
  const matched: string[] = [];
  const missing: string[] = [];
  const extraFields: RuntimeExtraField[] = [];
  const typeMismatches: RuntimeTypeMismatch[] = [];
  const missingFields: RuntimeMissingField[] = [];
  const requiredMismatches: RuntimeRequiredMismatch[] = [];
  const warnings: string[] = [];

  for (const dto of parsedDTOs.classes) {
    const schema = schemaMap.get(dto.className);
    if (!schema) {
      missing.push(dto.className);
      continue;
    }

    matched.push(dto.className);
    const dtoFields = collectDtoFields(dto);
    const apiFields = new Map(schema.fields.map((field) => [field.name, field]));

    for (const apiField of schema.fields) {
      const dtoField = dtoFields.get(apiField.name);
      if (!dtoField) {
        extraFields.push({ dto: dto.className, apiField: apiField.name });
        warnings.push(`API field '${apiField.name}' exists in ${dto.className} but no matching DTO field was found`);
        continue;
      }

      const dtoType = normalizeTypeName(dtoField.isEnum && dtoField.enumName ? dtoField.enumName : dtoField.tsType);
      const apiType = normalizeTypeName(apiField.type);
      if (apiType !== 'unknown' && dtoType !== apiType) {
        typeMismatches.push({
          dto: dto.className,
          field: apiField.name,
          dtoType,
          apiType,
        });
      }

      const dtoRequired = !dtoField.nullable;
      if (dtoRequired !== apiField.required) {
        requiredMismatches.push({
          dto: dto.className,
          field: apiField.name,
          dtoRequired,
          apiRequired: apiField.required,
        });

        if (apiField.required) {
          warnings.push(`API field '${apiField.name}' is required but DTO says optional`);
        } else {
          warnings.push(`DTO field '${apiField.name}' is required but API says optional`);
        }
      }
    }

    for (const [dtoFieldName] of dtoFields.entries()) {
      if (!apiFields.has(dtoFieldName)) {
        missingFields.push({ dto: dto.className, field: dtoFieldName });
        warnings.push(`DTO field '${dtoFieldName}' is not present in API schema '${dto.className}'`);
      }
    }
  }

  matched.sort();
  missing.sort();

  return {
    matched,
    missing,
    extraFields,
    typeMismatches,
    missingFields,
    requiredMismatches,
    warnings,
    source,
    schemas,
  };
}

function emptyReport(overrides?: Partial<RuntimeValidationReport>): RuntimeValidationReport {
  return {
    matched: [],
    missing: [],
    extraFields: [],
    typeMismatches: [],
    missingFields: [],
    requiredMismatches: [],
    warnings: [],
    schemas: [],
    ...overrides,
  };
}

function toRuntimeErrorMessage(baseUrl: string, error: unknown, timeoutMs: number): string {
  if (isTimeoutError(error)) {
    return `API request timed out after ${Math.trunc(timeoutMs / 1000)}s`;
  }

  const message = error instanceof Error ? error.message : String(error);
  if (/ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|fetch failed|network|Failed to fetch/i.test(message)) {
    return `Backend not accessible at ${baseUrl}`;
  }

  return `Backend not accessible at ${baseUrl}`;
}

function isTimeoutError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  if (typeof error === 'string') {
    return error === 'timeout';
  }

  if (error instanceof Error) {
    return error.name === 'AbortError' || /timed out|timeout/i.test(error.message);
  }

  return false;
}

function extractOpenApiCandidatesFromSwaggerHtml(baseUrl: string, html: string): string[] {
  const candidates = new Set<string>();
  const patterns = [
    /["'](?:url|configUrl)["']\s*:\s*["']([^"']+)["']/g,
    /\b(?:url|configUrl)\s*:\s*["']([^"']+)["']/g,
    /["'](\/[^"']*(?:api-docs|swagger-config)[^"']*)["']/g,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      if (match[1]) {
        candidates.add(toAbsoluteUrl(baseUrl, match[1]));
      }
    }
  }

  candidates.add(`${baseUrl}/v3/api-docs/swagger-config`);
  candidates.add(`${baseUrl}/swagger-config`);
  candidates.add(`${baseUrl}/v3/api-docs`);

  return Array.from(candidates);
}

function extractOpenApiCandidatesFromSwaggerConfig(baseUrl: string, config: JsonSchema): string[] {
  const candidates = new Set<string>();

  if (typeof config.url === 'string') {
    candidates.add(toAbsoluteUrl(baseUrl, config.url));
  }

  if (Array.isArray(config.urls)) {
    for (const entry of config.urls) {
      if (entry && typeof entry.url === 'string') {
        candidates.add(toAbsoluteUrl(baseUrl, entry.url));
      }
    }
  }

  return Array.from(candidates);
}

function isSwaggerConfig(payload: unknown): payload is JsonSchema {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as JsonSchema;
  return typeof candidate.url === 'string' || Array.isArray(candidate.urls);
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function normalizeEndpointPath(pathName: string): string {
  const trimmed = pathName.trim();
  if (!trimmed.startsWith('/')) {
    return `/${trimmed}`.replace(/\/+/g, '/');
  }

  return trimmed.replace(/\/+/g, '/');
}

function toAbsoluteUrl(baseUrl: string, endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) {
    return endpoint;
  }

  if (endpoint.startsWith('/')) {
    return `${baseUrl}${endpoint}`;
  }

  return `${baseUrl}/${endpoint}`;
}

function isOpenApiDocument(document: unknown): document is JsonSchema {
  if (!document || typeof document !== 'object') {
    return false;
  }

  const candidate = document as JsonSchema;
  return typeof candidate.openapi === 'string' || typeof candidate.swagger === 'string';
}

export function extractApiResponseSchemas(document: JsonSchema, source: string): ApiResponseSchema[] {
  const components = (document.components?.schemas ?? {}) as Record<string, JsonSchema>;
  const schemas = new Map<string, ApiResponseSchema>();

  for (const [pathName, pathItem] of Object.entries(document.paths ?? {})) {
    if (!pathItem || typeof pathItem !== 'object') {
      continue;
    }

    for (const [method, operation] of Object.entries(pathItem as Record<string, JsonSchema>)) {
      if (!isHttpMethod(method) || !operation || typeof operation !== 'object') {
        continue;
      }

      const responses = (operation.responses ?? {}) as Record<string, JsonSchema>;
      for (const [statusCode, response] of Object.entries(responses)) {
        const content = response?.content;
        if (!content || typeof content !== 'object') {
          continue;
        }

        for (const [mediaTypeName, mediaType] of Object.entries(content as Record<string, JsonSchema>)) {
          if (!isJsonMediaType(mediaTypeName) || !mediaType?.schema) {
            continue;
          }

          for (const schema of collectResponseSchemas(mediaType.schema, components, new Set())) {
            const existing = schemas.get(schema.name);
            if (!existing || existing.fields.length < schema.fields.length) {
              schemas.set(schema.name, {
                ...schema,
                source: `${source} ${method.toUpperCase()} ${pathName} ${statusCode}`,
              });
            }
          }
        }
      }
    }
  }

  return Array.from(schemas.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function isHttpMethod(method: string): boolean {
  return ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'].includes(method);
}

function isJsonMediaType(mediaType: string): boolean {
  return /json/i.test(mediaType);
}

function getPreferredJsonResponse(
  responses: Record<string, JsonSchema> | undefined
): { statusCode: string; schema: JsonSchema } | null {
  if (!responses) {
    return null;
  }

  const responseEntries = Object.entries(responses)
    .filter(([statusCode]) => /^2\d\d$/.test(statusCode) || statusCode === 'default')
    .sort(([left], [right]) => left.localeCompare(right));

  for (const [statusCode, response] of responseEntries) {
    const content = response?.content;
    if (!content || typeof content !== 'object') {
      continue;
    }

    for (const [mediaType, mediaSchema] of Object.entries(content as Record<string, JsonSchema>)) {
      if (isJsonMediaType(mediaType) && mediaSchema?.schema) {
        return {
          statusCode,
          schema: mediaSchema.schema,
        };
      }
    }
  }

  return null;
}

function collectResponseSchemas(
  schema: JsonSchema,
  components: Record<string, JsonSchema>,
  seenRefs: Set<string>
): ApiResponseSchema[] {
  const resolvedSchema = resolveSchema(schema, components, seenRefs);
  if (!resolvedSchema) {
    return [];
  }

  if (resolvedSchema.type === 'array' && resolvedSchema.items) {
    return collectResponseSchemas(resolvedSchema.items, components, seenRefs);
  }

  if (Array.isArray(resolvedSchema.oneOf) || Array.isArray(resolvedSchema.anyOf)) {
    const variants = [...(resolvedSchema.oneOf ?? []), ...(resolvedSchema.anyOf ?? [])];
    return variants.flatMap((variant) => collectResponseSchemas(variant, components, new Set(seenRefs)));
  }

  const allOf = Array.isArray(resolvedSchema.allOf) ? resolvedSchema.allOf : [];
  if (allOf.length > 0) {
    const merged = mergeObjectSchema(allOf, components, seenRefs);
    return merged ? [merged] : [];
  }

  const pageContentItem = getPaginatedContentItemSchema(resolvedSchema, components, seenRefs);
  if (pageContentItem) {
    return collectResponseSchemas(pageContentItem, components, new Set(seenRefs));
  }

  const schemaName = resolveSchemaName(resolvedSchema);
  if (!schemaName) {
    return [];
  }

  const properties = (resolvedSchema.properties ?? {}) as Record<string, JsonSchema>;
  const required = new Set<string>(Array.isArray(resolvedSchema.required) ? resolvedSchema.required : []);
  const fields = Object.entries(properties).map(([name, propertySchema]) => ({
    name,
    required: required.has(name),
    type: describeSchemaType(propertySchema, components, new Set(seenRefs)),
  }));

  return [{ name: schemaName, fields, source: '' }];
}

function mergeObjectSchema(
  allOf: JsonSchema[],
  components: Record<string, JsonSchema>,
  seenRefs: Set<string>
): ApiResponseSchema | null {
  let schemaName: string | undefined;
  const required = new Set<string>();
  const fields = new Map<string, ApiSchemaField>();

  for (const part of allOf) {
    const resolvedPart = resolveSchema(part, components, new Set(seenRefs));
    if (!resolvedPart) {
      continue;
    }

    schemaName ??= resolveSchemaName(resolvedPart);

    const partRequired = new Set<string>(Array.isArray(resolvedPart.required) ? resolvedPart.required : []);
    for (const field of Object.keys(resolvedPart.properties ?? {})) {
      if (partRequired.has(field)) {
        required.add(field);
      }
    }

    for (const [fieldName, propertySchema] of Object.entries((resolvedPart.properties ?? {}) as Record<string, JsonSchema>)) {
      fields.set(fieldName, {
        name: fieldName,
        required: false,
        type: describeSchemaType(propertySchema, components, new Set(seenRefs)),
      });
    }
  }

  if (!schemaName) {
    return null;
  }

  return {
    name: schemaName,
    source: '',
    fields: Array.from(fields.values()).map((field) => ({
      ...field,
      required: required.has(field.name),
    })),
  };
}

function resolveSchema(
  schema: JsonSchema,
  components: Record<string, JsonSchema>,
  seenRefs: Set<string>
): JsonSchema | null {
  if (!schema || typeof schema !== 'object') {
    return null;
  }

  if (!schema.$ref) {
    return schema;
  }

  const refName = getRefName(schema.$ref);
  if (!refName || seenRefs.has(refName)) {
    return null;
  }

  const target = components[refName];
  if (!target) {
    return null;
  }

  seenRefs.add(refName);
  return {
    ...target,
    title: target.title ?? refName,
  };
}

function resolveSchemaName(schema: JsonSchema): string | undefined {
  if (typeof schema.title === 'string' && schema.title.trim().length > 0) {
    return schema.title.trim();
  }

  return schema.$ref ? getRefName(schema.$ref) : undefined;
}

function getRefName(ref: string): string | undefined {
  const match = ref.match(/\/([^/]+)$/);
  return match?.[1];
}

function describeSchemaType(
  schema: JsonSchema,
  components: Record<string, JsonSchema>,
  seenRefs: Set<string>
): string {
  if (!schema || typeof schema !== 'object') {
    return 'unknown';
  }

  if (schema.$ref) {
    return getRefName(schema.$ref) ?? 'unknown';
  }

  const resolved = resolveSchema(schema, components, seenRefs);
  if (!resolved) {
    return 'unknown';
  }

  if (Array.isArray(resolved.enum)) {
    return 'enum';
  }

  if (resolved.type === 'array') {
    return `${describeSchemaType(resolved.items ?? {}, components, seenRefs)}[]`;
  }

  if (resolved.type === 'object') {
    const pageContentItem = getPaginatedContentItemSchema(resolved, components, seenRefs);
    if (pageContentItem) {
      return `page<${describeSchemaType(pageContentItem, components, new Set(seenRefs))}>`;
    }

    if (resolved.additionalProperties) {
      return `Record<string, ${describeSchemaType(resolved.additionalProperties, components, seenRefs)}>`;
    }

    return resolveSchemaName(resolved) ?? 'object';
  }

  if (resolved.format === 'date-time' || resolved.format === 'date') {
    return 'string';
  }

  return String(resolved.type ?? 'unknown');
}

function describeResponseSchemaType(
  schema: JsonSchema,
  components: Record<string, JsonSchema>,
  seenRefs: Set<string>
): string {
  const resolved = resolveSchema(schema, components, seenRefs);
  if (!resolved) {
    return 'unknown';
  }

  if (resolved.type === 'array') {
    return 'array';
  }

  if (getPaginatedContentItemSchema(resolved, components, seenRefs)) {
    return 'page';
  }

  return inferTypeFromSchema(resolved);
}

function inferTypeFromSchema(schema: JsonSchema): string {
  if (schema.type === 'array') {
    return 'array';
  }

  if (schema.type === 'object' || schema.properties) {
    return 'object';
  }

  return normalizeTypeName(String(schema.type ?? 'unknown'));
}

function resolveDtoClassFromSchema(
  schema: JsonSchema,
  components: Record<string, JsonSchema>,
  seenRefs: Set<string>
): string | undefined {
  if (!schema || typeof schema !== 'object') {
    return undefined;
  }

  const resolved = resolveSchema(schema, components, seenRefs);
  if (!resolved) {
    return undefined;
  }

  if (resolved.type === 'array' && resolved.items) {
    return resolveDtoClassFromSchema(resolved.items, components, new Set(seenRefs));
  }

  if (Array.isArray(resolved.allOf)) {
    for (const part of resolved.allOf) {
      const dtoClass = resolveDtoClassFromSchema(part, components, new Set(seenRefs));
      if (dtoClass) {
        return dtoClass;
      }
    }
  }

  const pageContentItem = getPaginatedContentItemSchema(resolved, components, seenRefs);
  if (pageContentItem) {
    return resolveDtoClassFromSchema(pageContentItem, components, new Set(seenRefs));
  }

  if (Array.isArray(resolved.oneOf) || Array.isArray(resolved.anyOf)) {
    for (const part of [...(resolved.oneOf ?? []), ...(resolved.anyOf ?? [])]) {
      const dtoClass = resolveDtoClassFromSchema(part, components, new Set(seenRefs));
      if (dtoClass) {
        return dtoClass;
      }
    }
  }

  const schemaName = resolveSchemaName(resolved);
  if (schemaName && schemaName !== 'Page' && schemaName !== 'ResponseEntity') {
    return schemaName;
  }

  if (schema.$ref) {
    return getRefName(schema.$ref);
  }

  return undefined;
}

function getPaginatedContentItemSchema(
  schema: JsonSchema,
  components: Record<string, JsonSchema>,
  seenRefs: Set<string>
): JsonSchema | null {
  const resolved = resolveSchema(schema, components, seenRefs);
  if (!resolved || typeof resolved !== 'object') {
    return null;
  }

  for (const key of PAGE_COLLECTION_KEYS) {
    const content = resolved.properties?.[key];
    if (content && typeof content === 'object') {
      const resolvedContent = resolveSchema(content as JsonSchema, components, new Set(seenRefs));
      if (resolvedContent?.type === 'array' && resolvedContent.items) {
        return resolvedContent.items;
      }
    }
  }

  return null;
}

function summarizeResponseShape(response: unknown, sampleSize: number): ShapeSummary {
  if (Array.isArray(response)) {
    if (response.length === 0) {
      return {
        responseType: 'array',
        sampleSize: 0,
        fields: new Map(),
      };
    }

    const fieldMap = new Map<string, FieldTypeMapEntry>();
    const effectiveSample = Math.min(sampleSize, response.length);
    const items = response.slice(0, effectiveSample);
    for (const item of items) {
      mergeObjectFields(fieldMap, item, '', 0);
    }

    return {
      responseType: 'array',
      sampleSize: effectiveSample,
      fields: fieldMap,
    };
  }

  if (isPaginatedResponse(response)) {
    const content = getPaginatedResponseItems(response);
    if (content.length === 0) {
      return {
        responseType: 'page',
        sampleSize: 0,
        fields: new Map(),
      };
    }

    const fieldMap = new Map<string, FieldTypeMapEntry>();
    const effectiveSample = Math.min(sampleSize, content.length);
    for (const item of content.slice(0, effectiveSample)) {
      mergeObjectFields(fieldMap, item, '', 0);
    }

    return {
      responseType: 'page',
      sampleSize: effectiveSample,
      fields: fieldMap,
    };
  }

  if (response && typeof response === 'object') {
    const fieldMap = new Map<string, FieldTypeMapEntry>();
    mergeObjectFields(fieldMap, response, '', 0);
    return {
      responseType: 'object',
      sampleSize: 1,
      fields: fieldMap,
    };
  }

  return {
    responseType: inferType(response),
    sampleSize: response === undefined ? 0 : 1,
    fields: new Map(),
  };
}

function mergeObjectFields(
  fieldMap: Map<string, FieldTypeMapEntry>,
  value: unknown,
  prefix: string,
  depth: number
): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return;
  }

  for (const [fieldName, fieldValue] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${fieldName}` : fieldName;
    const entry = fieldMap.get(path) ?? { observed: new Set<string>(), count: 0 };
    entry.observed.add(inferObservedFieldType(fieldValue));
    entry.count += 1;
    fieldMap.set(path, entry);

    if (depth >= MAX_NESTED_DEPTH) {
      continue;
    }

    if (fieldValue && typeof fieldValue === 'object') {
      if (Array.isArray(fieldValue)) {
        const nestedItems = fieldValue.filter((item) => item && typeof item === 'object').slice(0, DEFAULT_RESPONSE_SAMPLE_SIZE);
        for (const nestedItem of nestedItems) {
          mergeObjectFields(fieldMap, nestedItem, path, depth + 1);
        }
        continue;
      }

      mergeObjectFields(fieldMap, fieldValue, path, depth + 1);
    }
  }
}

function inferObservedFieldType(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return 'array';
    }

    const itemTypes = new Set(value.slice(0, 3).map((item) => inferObservedFieldType(item)));
    return `${normalizeObservedTypes(itemTypes)}[]`;
  }

  const type = inferType(value);
  if (type === 'object') {
    return 'object';
  }

  return type;
}

function compareResponseToSchema(
  response: unknown,
  schema: JsonSchema | undefined,
  document: JsonSchema,
  sampleSize: number
): { matches: boolean } {
  if (!schema) {
    return { matches: false };
  }

  const components = (document.components?.schemas ?? {}) as Record<string, JsonSchema>;
  const expectedSchema = unwrapSchemaForComparison(schema, components, new Set());
  const summary = summarizeResponseShape(response, sampleSize);
  const expectedFields = collectSchemaFields(expectedSchema, components, new Set());

  for (const [fieldName, observed] of summary.fields.entries()) {
    const expected = expectedFields.get(fieldName);
    if (!expected) {
      return { matches: false };
    }

    if (!typesCompatible(normalizeTypeName(expected.type), observed.observed)) {
      return { matches: false };
    }
  }

  for (const [fieldName, fieldSchema] of expectedFields.entries()) {
    if (fieldSchema.required && !summary.fields.has(fieldName)) {
      return { matches: false };
    }
  }

  return { matches: true };
}

function unwrapSchemaForComparison(
  schema: JsonSchema,
  components: Record<string, JsonSchema>,
  seenRefs: Set<string>
): JsonSchema {
  const resolved = resolveSchema(schema, components, seenRefs) ?? schema;
  if (resolved.type === 'array' && resolved.items) {
    return unwrapSchemaForComparison(resolved.items, components, new Set(seenRefs));
  }

  const pageContentItem = getPaginatedContentItemSchema(resolved, components, seenRefs);
  if (pageContentItem) {
    return unwrapSchemaForComparison(pageContentItem, components, new Set(seenRefs));
  }

  if (Array.isArray(resolved.allOf)) {
    const merged = mergeObjectSchema(resolved.allOf, components, seenRefs);
    if (merged) {
      return {
        type: 'object',
        title: merged.name,
        required: merged.fields.filter((field) => field.required).map((field) => field.name),
        properties: Object.fromEntries(
          merged.fields.map((field) => [
            field.name,
            {
              type: denormalizeSchemaType(field.type),
            },
          ])
        ),
      };
    }
  }

  return resolved;
}

function collectSchemaFields(
  schema: JsonSchema,
  components: Record<string, JsonSchema>,
  seenRefs: Set<string>
): Map<string, ApiSchemaField> {
  const resolved = unwrapSchemaForComparison(schema, components, seenRefs);
  const fields = new Map<string, ApiSchemaField>();
  collectSchemaFieldsRecursive(fields, resolved, components, new Set(seenRefs), '', 0, false);

  return fields;
}

function collectSchemaFieldsRecursive(
  fields: Map<string, ApiSchemaField>,
  schema: JsonSchema,
  components: Record<string, JsonSchema>,
  seenRefs: Set<string>,
  prefix: string,
  depth: number,
  requiredByParent: boolean
): void {
  const resolved = unwrapSchemaForComparison(schema, components, seenRefs);
  const required = new Set<string>(Array.isArray(resolved.required) ? resolved.required : []);

  for (const [fieldName, fieldSchema] of Object.entries((resolved.properties ?? {}) as Record<string, JsonSchema>)) {
    const path = prefix ? `${prefix}.${fieldName}` : fieldName;
    const fieldRequired = requiredByParent || required.has(fieldName);
    fields.set(path, {
      name: path,
      required: fieldRequired,
      type: describeSchemaType(fieldSchema, components, new Set(seenRefs)),
    });

    if (depth >= MAX_NESTED_DEPTH) {
      continue;
    }

    const resolvedField = resolveSchema(fieldSchema, components, new Set(seenRefs)) ?? fieldSchema;
    if (!resolvedField || typeof resolvedField !== 'object') {
      continue;
    }

    if (resolvedField.type === 'object' || resolvedField.properties) {
      collectSchemaFieldsRecursive(fields, resolvedField, components, new Set(seenRefs), path, depth + 1, fieldRequired);
      continue;
    }

    if (resolvedField.type === 'array' && resolvedField.items) {
      const itemSchema = resolveSchema(resolvedField.items, components, new Set(seenRefs)) ?? resolvedField.items;
      if (itemSchema && typeof itemSchema === 'object' && (itemSchema.type === 'object' || itemSchema.properties)) {
        collectSchemaFieldsRecursive(fields, itemSchema, components, new Set(seenRefs), path, depth + 1, fieldRequired);
      }
    }
  }
}

function denormalizeSchemaType(type: string): string {
  if (type.endsWith('[]')) {
    return 'array';
  }

  switch (type) {
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'string':
      return 'string';
    default:
      return 'object';
  }
}

function isPaginatedResponse(value: unknown): boolean {
  return getPaginatedResponseItems(value).length >= 0 && !!(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    PAGE_COLLECTION_KEYS.some((key) => Array.isArray((value as Record<string, unknown>)[key]))
  );
}

function getPaginatedResponseItems(value: unknown): unknown[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  const candidate = value as Record<string, unknown>;
  for (const key of PAGE_COLLECTION_KEYS) {
    if (Array.isArray(candidate[key])) {
      return candidate[key] as unknown[];
    }
  }

  return [];
}

function collectDtoFields(dto: DTOClass): Map<string, DTOField> {
  const fields = new Map<string, DTOField>();

  for (const field of [...(dto.parentFields ?? []), ...dto.fields]) {
    if (field.jsonIgnore) {
      continue;
    }

    const fieldName = field.jsonName || field.name;
    if (!fields.has(fieldName)) {
      fields.set(fieldName, field);
    }

    collectNestedDtoFields(fields, field, fieldName, 0);
  }

  return fields;
}

function collectNestedDtoFields(
  fields: Map<string, DTOField>,
  field: DTOField,
  prefix: string,
  depth: number
): void {
  if (depth >= MAX_NESTED_DEPTH) {
    return;
  }

  const nestedFields = extractNestedFieldDefinitions(field.tsType, field.nullable);
  for (const nested of nestedFields) {
    const nestedPath = `${prefix}.${nested.name}`;
    if (!fields.has(nestedPath)) {
      fields.set(nestedPath, nested);
    }

    collectNestedDtoFields(fields, nested, nestedPath, depth + 1);
  }
}

function extractNestedFieldDefinitions(typeName: string, nullable: boolean): DTOField[] {
  const normalized = typeName.trim();
  const objectLiteralMatch = normalized.match(/^\{(.+)\}$/s);
  if (!objectLiteralMatch) {
    return [];
  }

  const nestedFields: DTOField[] = [];
  for (const segment of splitTopLevelSegments(objectLiteralMatch[1], ';').map((entry) => entry.trim()).filter(Boolean)) {
    const match = segment.match(/^([A-Za-z_$][\w$]*)\??\s*:\s*(.+)$/s);
    if (!match) {
      continue;
    }

    const optional = /\?\s*:/.test(segment);
    nestedFields.push({
      name: match[1],
      javaType: 'Object',
      tsType: match[2].trim(),
      nullable: nullable || optional,
      isEnum: false,
      annotations: [],
    });
  }

  return nestedFields;
}

function splitTopLevelSegments(value: string, delimiter: string): string[] {
  const segments: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of value) {
    if (char === '{' || char === '<' || char === '[' || char === '(') {
      depth += 1;
    } else if (char === '}' || char === '>' || char === ']' || char === ')') {
      depth = Math.max(0, depth - 1);
    }

    if (char === delimiter && depth === 0) {
      segments.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    segments.push(current);
  }

  return segments;
}

function normalizeTypeName(typeName: string): string {
  const trimmed = typeName.trim();
  if (!trimmed) {
    return 'unknown';
  }

  if (trimmed === 'integer') {
    return 'number';
  }

  if (trimmed.endsWith(' | null') || trimmed.endsWith('| null')) {
    return normalizeTypeName(trimmed.replace(/\s*\|\s*null$/, ''));
  }

  if (/^Record<\s*string,\s*(.+)>$/.test(trimmed)) {
    return 'record';
  }

  if (/^page<(.+)>$/i.test(trimmed)) {
    return 'page';
  }

  if (trimmed.endsWith('[]')) {
    return `${normalizeTypeName(trimmed.slice(0, -2))}[]`;
  }

  return trimmed;
}

function normalizeObservedTypes(types: Set<string>): string {
  return Array.from(types)
    .map((type) => normalizeTypeName(type))
    .sort()
    .join(' | ');
}

function typesCompatible(expectedType: string, observedTypes: Set<string>): boolean {
  const normalizedExpected = normalizeTypeName(expectedType);
  const normalizedObserved = new Set(Array.from(observedTypes).map((type) => normalizeTypeName(type)));

  if (normalizedObserved.size === 0) {
    return true;
  }

  if (normalizedExpected === 'unknown' || normalizedExpected === 'object' || normalizedExpected === 'record') {
    return true;
  }

  if (normalizedExpected === 'enum') {
    return normalizedObserved.has('string') || normalizedObserved.has('number');
  }

  if (normalizedExpected === 'page') {
    return normalizedObserved.has('page') || normalizedObserved.has('object');
  }

  if (normalizedExpected.startsWith('{') && normalizedExpected.endsWith('}')) {
    return normalizedObserved.has('object');
  }

  if (normalizedExpected.endsWith('[]')) {
    if (normalizedObserved.has(normalizedExpected)) {
      return true;
    }

    if (normalizedObserved.has('array')) {
      return true;
    }

    return false;
  }

  if (normalizedExpected !== 'string' && /^[A-Z]/.test(normalizedExpected)) {
    return normalizedObserved.has('object');
  }

  return normalizedObserved.has(normalizedExpected);
}

function errorToString(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
