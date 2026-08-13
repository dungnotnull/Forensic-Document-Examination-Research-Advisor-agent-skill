/**
 * Type-safe configuration schema for Forensic Document Examination Advisor
 * This file defines the TypeScript types and validation schema for all configuration values
 */

export interface SkillConfig {
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  keywords?: string[];
}

export interface LLMConfig {
  provider: 'anthropic' | 'openai' | 'custom';
  model: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  apiKey?: string;
  endpoint?: string;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  format: 'structured' | 'text' | 'json';
  outputs: Array<'console' | 'file' | 'remote'>;
  directory?: string;
  maxFiles?: number;
  maxSize?: string;
  remoteEndpoint?: string;
  apiKey?: string;
}

export interface FeatureFlags {
  enableTelemetry: boolean;
  enableAnalytics: boolean;
  enableAuditLog: boolean;
  enableGracefulFallbacks: boolean;
  enableMethodologyValidation: boolean;
  enableDisclaimerEnforcement: boolean;
}

export interface MethodologyConfig {
  enabled: boolean;
  reference: string;
  version?: string;
  lastUpdated?: string;
}

export interface MethodologiesConfig {
  astmStandards: MethodologyConfig;
  swgdocStandards: MethodologyConfig;
  classVsIndividualCharacteristics: MethodologyConfig;
  naturalVariationAnalysis: MethodologyConfig;
  nas2009Critique: MethodologyConfig;
  esdaMethodology: MethodologyConfig;
  chainOfCustody: MethodologyConfig;
}

export interface HookConfig {
  enabled: boolean;
  handlers: string[];
  timeoutMs?: number;
  retryOnFailure?: boolean;
}

export interface HooksConfig {
  beforeExecution: HookConfig;
  afterExecution: HookConfig;
  onError: HookConfig;
}

export interface ToolConfig {
  enabled: boolean;
  timeoutMs?: number;
  cacheEnabled?: boolean;
  cacheTtlSeconds?: number;
  [key: string]: any;
}

export interface ToolsConfig {
  methodologyExecutor: ToolConfig;
  referenceResolver: ToolConfig;
  outputFormatter: ToolConfig;
  disclaimerManager: ToolConfig;
}

export interface ValidationConfig {
  inputValidation: {
    enabled: boolean;
    strictMode: boolean;
    allowedInputTypes?: string[];
    maxInputLength?: number;
  };
  outputValidation: {
    enabled: boolean;
    checkMethodologyApplication: boolean;
    checkDisclaimerPresence: boolean;
    checkScopeCompliance: boolean;
    minLength?: number;
    maxLength?: number;
  };
}

export interface TestingConfig {
  evalDirectory: string;
  coverageThreshold: number;
  performanceThresholdMs: number;
  enableAutomatedTesting: boolean;
  parallelTestExecution: boolean;
}

export interface EnvironmentConfig {
  version: string;
  environment: 'development' | 'staging' | 'production';
  skill: SkillConfig;
  llm: LLMConfig;
  logging: LoggingConfig;
  features: FeatureFlags;
  methodologies: MethodologiesConfig;
  hooks: HooksConfig;
  tools: ToolsConfig;
  validation: ValidationConfig;
  testing: TestingConfig;
}

export interface ConfigManager {
  load(env?: string): Promise<EnvironmentConfig>;
  validate(config: any): boolean;
  get(path: string): any;
  set(path: string, value: any): void;
  reload(): Promise<void>;
}

export const DEFAULT_CONFIG: Partial<EnvironmentConfig> = {
  environment: 'development',
  llm: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    maxTokens: 8192,
    temperature: 0.3,
    timeoutMs: 120000,
    retryAttempts: 3,
    retryDelayMs: 1000
  },
  logging: {
    level: 'info',
    format: 'structured',
    outputs: ['console', 'file']
  },
  features: {
    enableTelemetry: false,
    enableAnalytics: false,
    enableAuditLog: true,
    enableGracefulFallbacks: true,
    enableMethodologyValidation: true,
    enableDisclaimerEnforcement: true
  }
};

export const CONFIG_SCHEMA_VALIDATION = {
  required: ['version', 'environment', 'skill', 'llm'],
  properties: {
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
    environment: { enum: ['development', 'staging', 'production'] },
    skill: {
      type: 'object',
      required: ['name', 'version', 'description'],
      properties: {
        name: { type: 'string', minLength: 1 },
        version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
        description: { type: 'string', minLength: 10 }
      }
    },
    llm: {
      type: 'object',
      required: ['provider', 'model', 'maxTokens'],
      properties: {
        provider: { enum: ['anthropic', 'openai', 'custom'] },
        model: { type: 'string', minLength: 1 },
        maxTokens: { type: 'number', minimum: 1, maximum: 200000 },
        temperature: { type: 'number', minimum: 0, maximum: 1 }
      }
    }
  }
};
