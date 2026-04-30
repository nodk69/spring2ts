/**
 * Base service class for all command services
 */

import { logger } from '../utils/logger';
import { EXIT_CODES } from '../constants/exit-codes';
import chalk from 'chalk';

export interface ServiceResult {
  success: boolean;
  exitCode?: number;
  message?: string;
  data?: any;
}

export abstract class BaseService {
  protected serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  /**
   * Execute the service
   */
  abstract execute(options: any): Promise<ServiceResult>;

  /**
   * Handle errors consistently
   */
  protected handleError(error: unknown, context?: string): ServiceResult {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const contextPrefix = context ? `[${context}] ` : '';
    
    logger.error(`${this.serviceName} failed: ${contextPrefix}${errorMessage}`);
    
    return {
      success: false,
      exitCode: EXIT_CODES.UNKNOWN_ERROR,
      message: errorMessage
    };
  }

  /**
   * Log service start
   */
  protected logStart(message?: string): void {
    logger.title(`Spring2TS v0.3.0 - ${this.serviceName}`);
    if (message) {
      logger.info(message);
    }
  }

  /**
   * Log service success
   */
  protected logSuccess(message: string, data?: any): void {
    logger.success(message);
    if (data) {
      logger.debug(JSON.stringify(data, null, 2));
    }
  }

  /**
   * Log warning
   */
  protected logWarning(message: string): void {
    logger.warn(message);
  }

  /**
   * Display mode flags
   */
  protected displayModes(modes: Record<string, boolean>): void {
    const modeEntries = Object.entries(modes).filter(([, enabled]) => enabled);
    
    if (modeEntries.length > 0) {
      modeEntries.forEach(([name]) => {
        let color = chalk.yellow;
        if (name === 'sync') color = chalk.cyan;
        
        const displayName = name.charAt(0).toUpperCase() + name.slice(1);
        logger.kv('Mode', color(`${displayName} mode`));
      });
      logger.blank();
    }
  }
}