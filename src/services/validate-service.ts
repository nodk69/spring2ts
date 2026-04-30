/**
 * Validate command service - Validates generated TypeScript output
 */

import chalk from 'chalk';
import { BaseService, ServiceResult } from './base-service';
import { loadPaths } from '../cli/options';
import { parseDTOs } from '../core/parser';
import { validateGeneratedTypes } from '../core/validation/type-check';
import { validateAgainstRuntime, validateEndpointResponses } from '../core/validation/api-contract';
import { EXIT_CODES } from '../constants/exit-codes';
import { logger } from '../utils/logger';

export interface ValidateOptions {
  backend?: string;
  url?: string;
  validateResponses?: boolean;
  sampleSize?: number;
  timeout?: number;
  includeAuth?: boolean;
  endpoints?: string;
}

export class ValidateService extends BaseService {
  constructor() {
    super('Validate');
  }

  async execute(options: ValidateOptions): Promise<ServiceResult> {
    const paths = loadPaths(options.backend);
    const backendPath = paths.backend.path;

    console.log(chalk.cyan('Validating generated TypeScript...'));

    if (options.url) {
      console.log(chalk.gray(`   Target URL: ${options.url}`));
    }

    const parsed = await parseDTOs({
      inputPath: backendPath,
      excludePatterns: [],
      includeNested: true
    });
    const result = await validateGeneratedTypes(parsed);

    if (!result.success) {
      logger.error('Generated TypeScript has type errors.');
      for (const diagnostic of result.diagnostics) {
        const location =
          diagnostic.filePath && diagnostic.line && diagnostic.column
            ? `${diagnostic.filePath}:${diagnostic.line}:${diagnostic.column}`
            : 'generated types';
        console.error(chalk.red(`  - ${location} ${diagnostic.message}`));
      }

      return {
        success: false,
        exitCode: EXIT_CODES.TYPE_ERROR,
        message: 'Generated TypeScript failed validation'
      };
    }

    logger.success('Generated TypeScript validation passed.');

    if (options.url) {
      logger.info(`Fetching runtime API metadata from ${options.url}`);

      const runtimeReport = await validateAgainstRuntime(parsed, options.url);

      if (runtimeReport.error) {
        logger.warn(runtimeReport.error);

        return {
          success: false,
          exitCode: EXIT_CODES.API_UNREACHABLE,
          message: runtimeReport.error,
          data: runtimeReport,
        };
      }

      if (runtimeReport.source) {
        logger.info(`Compared ${runtimeReport.matched.length} DTO schema(s) using ${runtimeReport.source}`);
      }

      for (const warning of runtimeReport.warnings) {
          logger.warn(warning);
      }

      if (runtimeReport.typeMismatches.length > 0) {
        logger.error('Runtime API type mismatches found.');
        for (const mismatch of runtimeReport.typeMismatches) {
          console.error(chalk.red(`  - Field '${mismatch.field}' type differs: DTO uses '${mismatch.dtoType}' but API uses '${mismatch.apiType}'`));
        }

        return {
          success: false,
          exitCode: EXIT_CODES.API_MISMATCH,
          message: 'Java DTOs do not match runtime API schemas',
          data: runtimeReport,
        };
      }

      if (runtimeReport.extraFields.length > 0 || runtimeReport.missingFields.length > 0 || runtimeReport.requiredMismatches.length > 0) {
        logger.error('Runtime API contract warnings found.');
        for (const field of runtimeReport.extraFields) {
          console.error(chalk.yellow(`  - API field '${field.apiField}' exists in ${field.dto} but no matching DTO field was found`));
        }
        for (const field of runtimeReport.missingFields) {
          console.error(chalk.yellow(`  - DTO field '${field.field}' is not present in API schema '${field.dto}'`));
        }
        for (const mismatch of runtimeReport.requiredMismatches) {
          const message = mismatch.apiRequired
            ? `API field '${mismatch.field}' is required but DTO says optional`
            : `DTO field '${mismatch.field}' is required but API says optional`;
          console.error(chalk.yellow(`  - ${message}`));
        }

        return {
          success: false,
          exitCode: EXIT_CODES.API_MISMATCH,
          message: 'Java DTOs do not match runtime API schemas',
          data: runtimeReport,
        };
      }

      logger.success('Runtime API schemas match parsed DTOs.');

      if (options.validateResponses) {
        logger.info(`Calling live GET endpoints from ${options.url}`);

        const responseReport = await validateEndpointResponses(parsed, options.url, {
          sampleSize: options.sampleSize,
          timeoutSeconds: options.timeout,
          includeAuth: options.includeAuth,
          endpoints: options.endpoints
            ? options.endpoints
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean)
            : undefined,
        });

        if (responseReport.error) {
          logger.warn(responseReport.error);

          return {
            success: false,
            exitCode: EXIT_CODES.API_UNREACHABLE,
            message: responseReport.error,
            data: responseReport,
          };
        }

        if (responseReport.source) {
          logger.info(
            `Validated ${responseReport.checked} endpoint response(s), skipped ${responseReport.skipped}, discovered ${responseReport.discovered}`
          );
        }

        for (const warning of responseReport.warnings) {
          logger.warn(warning);
        }

        const mismatchedEndpoints = responseReport.endpoints.filter(
          (entry) =>
            !entry.skipped &&
            (!entry.openApiMatch ||
              entry.fields.extra.length > 0 ||
              entry.fields.missing.length > 0 ||
              entry.fields.typeMismatches.length > 0)
        );

        if (mismatchedEndpoints.length > 0) {
          logger.error('Live API response mismatches found.');
          for (const endpoint of mismatchedEndpoints) {
            const prefix = `${endpoint.method} ${endpoint.endpoint}`;
            for (const field of endpoint.fields.extra) {
              console.error(chalk.yellow(`  - ${prefix}: API returns extra field '${field}'`));
            }
            for (const field of endpoint.fields.missing) {
              console.error(chalk.yellow(`  - ${prefix}: API missing field '${field}'`));
            }
            for (const mismatch of endpoint.fields.typeMismatches) {
              console.error(
                chalk.red(
                  `  - ${prefix}: field '${mismatch.field}' type differs: DTO uses '${mismatch.dtoType}' but response uses '${mismatch.responseType}'`
                )
              );
            }
            if (!endpoint.openApiMatch) {
              console.error(chalk.red(`  - ${prefix}: response does not match OpenAPI documentation`));
            }
          }

          return {
            success: false,
            exitCode: EXIT_CODES.API_MISMATCH,
            message: 'Live API responses do not match DTOs',
            data: responseReport,
          };
        }

        logger.success('Live API responses match parsed DTOs and OpenAPI schemas.');
      }
    }

    return {
      success: true,
      message: 'Generated TypeScript is type-safe'
    };
  }
}
