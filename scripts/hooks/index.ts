/**
 * Production-grade hooks system for Forensic Document Examination Advisor
 * Provides lifecycle management, state synchronization, and event emission capabilities
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/logger.js';

export interface HookContext {
  timestamp: Date;
  sessionId: string;
  executionId: string;
  userInput?: any;
  methodology?: string;
  metadata?: Record<string, any>;
}

export interface HookResult {
  success: boolean;
  data?: any;
  error?: Error;
  modifiedContext?: boolean;
  shouldAbort?: boolean;
}

export type HookHandler = (context: HookContext) => Promise<HookResult>;

export interface HookDefinition {
  name: string;
  handler: HookHandler;
  timeoutMs?: number;
  retryOnFailure?: boolean;
  priority?: number;
}

export class HookManager extends EventEmitter {
  private hooks: Map<string, HookDefinition[]> = new Map();
  private logger: Logger;
  private executionStats: Map<string, { count: number; failures: number; avgDuration: number }> = new Map();

  constructor(logger: Logger) {
    super();
    this.logger = logger;
    this.setupDefaultHooks();
  }

  private setupDefaultHooks(): void {
    this.registerHook('beforeExecution', {
      name: 'validateInput',
      handler: this.validateInputHandler.bind(this),
      priority: 100
    });

    this.registerHook('beforeExecution', {
      name: 'enforceScope',
      handler: this.enforceScopeHandler.bind(this),
      priority: 90
    });

    this.registerHook('beforeExecution', {
      name: 'initializeContext',
      handler: this.initializeContextHandler.bind(this),
      priority: 80
    });

    this.registerHook('afterExecution', {
      name: 'validateOutput',
      handler: this.validateOutputHandler.bind(this),
      priority: 100
    });

    this.registerHook('afterExecution', {
      name: 'enforceDisclaimer',
      handler: this.enforceDisclaimerHandler.bind(this),
      priority: 90
    });

    this.registerHook('afterExecution', {
      name: 'logMetrics',
      handler: this.logMetricsHandler.bind(this),
      priority: 80
    });

    this.registerHook('onError', {
      name: 'logError',
      handler: this.logErrorHandler.bind(this),
      priority: 100
    });

    this.registerHook('onError', {
      name: 'gracefulFallback',
      handler: this.gracefulFallbackHandler.bind(this),
      priority: 90
    });

    this.registerHook('onError', {
      name: 'notifyMonitoring',
      handler: this.notifyMonitoringHandler.bind(this),
      priority: 80
    });
  }

  registerHook(hookType: string, definition: HookDefinition): void {
    if (!this.hooks.has(hookType)) {
      this.hooks.set(hookType, []);
    }

    const hooks = this.hooks.get(hookType)!;
    hooks.push(definition);
    hooks.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    this.logger.debug(`Registered hook: ${hookType}.${definition.name}`);
  }

  async executeHooks(hookType: string, context: HookContext): Promise<HookResult> {
    const hooks = this.hooks.get(hookType);
    if (!hooks || hooks.length === 0) {
      return { success: true };
    }

    this.logger.debug(`Executing ${hooks.length} ${hookType} hooks`);

    for (const hook of hooks) {
      const startTime = Date.now();
      let result: HookResult;

      try {
        const timeout = hook.timeoutMs || 30000;
        result = await this.executeWithTimeout(hook.handler, context, timeout);

        const duration = Date.now() - startTime;
        this.updateStats(hookType, hook.name, duration, true);

        if (result.shouldAbort) {
          this.logger.warn(`Hook ${hookType}.${hook.name} requested abort`);
          return result;
        }

        if (result.modifiedContext && result.data) {
          Object.assign(context, result.data);
        }

      } catch (error) {
        const duration = Date.now() - startTime;
        this.updateStats(hookType, hook.name, duration, false);

        this.logger.error(`Hook ${hookType}.${hook.name} failed`, error);

        if (hook.retryOnFailure) {
          this.logger.info(`Retrying hook ${hookType}.${hook.name}`);
          try {
            result = await this.executeWithTimeout(hook.handler, context, hook.timeoutMs || 30000);
          } catch (retryError) {
            this.logger.error(`Hook ${hookType}.${hook.name} retry failed`, retryError);
            return { success: false, error: retryError as Error };
          }
        } else {
          return { success: false, error: error as Error };
        }
      }
    }

    return { success: true };
  }

  private async executeWithTimeout(
    handler: HookHandler,
    context: HookContext,
    timeoutMs: number
  ): Promise<HookResult> {
    return Promise.race([
      handler(context),
      new Promise<HookResult>((_, reject) =>
        setTimeout(() => reject(new Error(`Hook timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  private updateStats(hookType: string, hookName: string, duration: number, success: boolean): void {
    const key = `${hookType}.${hookName}`;
    const stats = this.executionStats.get(key) || { count: 0, failures: 0, avgDuration: 0 };

    stats.count++;
    if (!success) stats.failures++;
    stats.avgDuration = (stats.avgDuration * (stats.count - 1) + duration) / stats.count;

    this.executionStats.set(key, stats);
  }

  getStats(hookType?: string): Record<string, any> {
    if (hookType) {
      const hookStats: Record<string, any> = {};
      for (const [key, stats] of this.executionStats) {
        if (key.startsWith(hookType)) {
          hookStats[key] = stats;
        }
      }
      return hookStats;
    }
    return Object.fromEntries(this.executionStats);
  }

  private async validateInputHandler(context: HookContext): Promise<HookResult> {
    this.logger.debug('Validating input', { context });

    if (!context.userInput) {
      return {
        success: false,
        error: new Error('No user input provided'),
        shouldAbort: true
      };
    }

    if (typeof context.userInput === 'string' && context.userInput.length > 10000) {
      return {
        success: false,
        error: new Error('Input exceeds maximum length'),
        shouldAbort: true
      };
    }

    return { success: true, data: { inputValidated: true } };
  }

  private async enforceScopeHandler(context: HookContext): Promise<HookResult> {
    this.logger.debug('Enforcing scope compliance', { context });

    const dangerousPatterns = [
      /verdict|genuine|forged|authentic|fake/i,
      /determine.*signature.*real/i,
      /conclude.*document.*authentic/i
    ];

    if (typeof context.userInput === 'string') {
      for (const pattern of dangerousPatterns) {
        if (pattern.test(context.userInput)) {
          this.logger.warn('Input contains scope-violating patterns');
          return {
            success: true,
            data: {
              scopeWarning: 'Input may trigger disclaimer requirements',
              requiresReferral: true
            },
            modifiedContext: true
          };
        }
      }
    }

    return { success: true };
  }

  private async initializeContextHandler(context: HookContext): Promise<HookResult> {
    this.logger.debug('Initializing execution context');

    if (!context.metadata) {
      context.metadata = {};
    }

    context.metadata.executionStartTime = Date.now();
    context.metadata.hooksExecuted = [];
    context.metadata.validationChecks = [];

    return {
      success: true,
      data: context,
      modifiedContext: true
    };
  }

  private async validateOutputHandler(context: HookContext): Promise<HookResult> {
    this.logger.debug('Validating output', { context });

    if (!context.metadata?.outputGenerated) {
      return {
        success: false,
        error: new Error('No output was generated'),
        shouldAbort: true
      };
    }

    return { success: true };
  }

  private async enforceDisclaimerHandler(context: HookContext): Promise<HookResult> {
    this.logger.debug('Enforcing disclaimer requirements');

    if (!context.metadata?.outputContent) {
      return { success: true };
    }

    const output = context.metadata.outputContent as string;
    const requiredTerms = ['educational', 'professional', 'certified', 'disclaimer'];
    const hasRequiredTerms = requiredTerms.some(term =>
      output.toLowerCase().includes(term)
    );

    if (!hasRequiredTerms) {
      this.logger.warn('Output missing required disclaimer terms');
      return {
        success: false,
        error: new Error('Output must include appropriate disclaimers'),
        shouldAbort: true
      };
    }

    return { success: true };
  }

  private async logMetricsHandler(context: HookContext): Promise<HookResult> {
    const duration = Date.now() - (context.metadata?.executionStartTime || Date.now());

    this.emit('metrics', {
      executionId: context.executionId,
      duration,
      methodology: context.methodology,
      success: context.metadata?.executionSuccess !== false
    });

    this.logger.info('Execution metrics logged', {
      executionId: context.executionId,
      duration,
      methodology: context.methodology
    });

    return { success: true };
  }

  private async logErrorHandler(context: HookContext): Promise<HookResult> {
    const error = context.metadata?.lastError;

    this.logger.error('Execution error occurred', {
      executionId: context.executionId,
      error: error?.message,
      stack: error?.stack
    });

    this.emit('error', {
      executionId: context.executionId,
      error: error?.message,
      context: context.userInput
    });

    return { success: true };
  }

  private async gracefulFallbackHandler(context: HookContext): Promise<HookResult> {
    this.logger.warn('Attempting graceful fallback');

    return {
      success: true,
      data: {
        fallbackMessage: 'An error occurred while processing your request. ' +
          'This is an educational tool - please consult a certified forensic ' +
          'document examiner for professional assistance.',
        requiresReferral: true
      }
    };
  }

  private async notifyMonitoringHandler(context: HookContext): Promise<HookResult> {
    this.emit('monitoring', {
      executionId: context.executionId,
      timestamp: new Date(),
      error: context.metadata?.lastError,
      userInput: context.userInput
    });

    return { success: true };
  }
}

export const hookTypes = {
  BEFORE_EXECUTION: 'beforeExecution',
  AFTER_EXECUTION: 'afterExecution',
  ON_ERROR: 'onError',
  BEFORE_VALIDATION: 'beforeValidation',
  AFTER_VALIDATION: 'afterValidation',
  ON_METHOD_APPLY: 'onMethodApply',
  ON_OUTPUT_FORMAT: 'onOutputFormat'
} as const;
