/**
 * Parse command service - Parses DTOs and outputs JSON (debugging)
 */

import { BaseService, ServiceResult } from './base-service';
import { loadPaths } from '../cli/options';
import { sync } from '../cli/commands';

export interface ParseOptions {
  backend?: string;
}

export class ParseService extends BaseService {
  constructor() {
    super('Parse');
  }

  async execute(options: ParseOptions): Promise<ServiceResult> {
    try {
      const paths = loadPaths(options.backend);
      
      await sync({ 
        backend: paths.backend.path, 
        frontend: undefined, 
        check: false 
      });

      return {
        success: true,
        message: 'Parse completed'
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
}