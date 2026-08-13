/**
 * Production-grade tools definitions for Forensic Document Examination Advisor
 * Rich tool definitions with schemas and execution handlers for dynamic agent invocation
 */

import { z } from 'zod';
import { Logger } from '../utils/logger.js';
import { HookManager, HookContext } from '../hooks/index.js';

export interface ToolDefinition {
  name: string;
  description: string;
  category: 'methodology' | 'reference' | 'output' | 'validation' | 'system';
  inputSchema: z.ZodSchema;
  outputSchema: z.ZodSchema;
  handler: (input: any, context: HookContext) => Promise<any>;
  timeoutMs?: number;
  cacheEnabled?: boolean;
  cacheTtlSeconds?: number;
  requiresAuth?: boolean;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
}

export interface ToolExecutionContext {
  toolName: string;
  input: any;
  timestamp: Date;
  executionId: string;
  userId?: string;
  sessionId: string;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTimeMs?: number;
  cached?: boolean;
}

export class ToolManager {
  private tools: Map<string, ToolDefinition> = new Map();
  private cache: Map<string, { data: any; expiresAt: Date }> = new Map();
  private rateLimitTracker: Map<string, { count: number; resetAt: Date }> = new Map();
  private logger: Logger;
  private hookManager: HookManager;

  constructor(logger: Logger, hookManager: HookManager) {
    this.logger = logger;
    this.hookManager = hookManager;
    this.registerDefaultTools();
  }

  private registerDefaultTools(): void {
    this.registerTool(methodologyExecutorTool);
    this.registerTool(referenceResolverTool);
    this.registerTool(outputFormatterTool);
    this.registerTool(disclaimerManagerTool);
    this.registerTool(scopeValidatorTool);
    this.registerTool(methodologyApplierTool);
  }

  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
    this.logger.debug(`Registered tool: ${tool.name} (${tool.category})`);
  }

  async executeTool(
    toolName: string,
    input: any,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      const tool = this.tools.get(toolName);
      if (!tool) {
        return {
          success: false,
          error: `Tool not found: ${toolName}`,
          executionTimeMs: Date.now() - startTime
        };
      }

      if (tool.requiresAuth && !context.userId) {
        return {
          success: false,
          error: 'Authentication required',
          executionTimeMs: Date.now() - startTime
        };
      }

      if (tool.rateLimit) {
        const rateLimitResult = this.checkRateLimit(toolName, context.userId || 'anonymous', tool.rateLimit);
        if (!rateLimitResult.allowed) {
          return {
            success: false,
            error: `Rate limit exceeded. Try again after ${rateLimitResult.retryAfterMs}ms`,
            executionTimeMs: Date.now() - startTime
          };
        }
      }

      const validatedInput = tool.inputSchema.parse(input);

      if (tool.cacheEnabled) {
        const cacheKey = this.generateCacheKey(toolName, validatedInput);
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          this.logger.debug(`Tool cache hit: ${toolName}`);
          return {
            success: true,
            data: cached,
            executionTimeMs: Date.now() - startTime,
            cached: true
          };
        }
      }

      const hookContext: HookContext = {
        timestamp: new Date(),
        sessionId: context.sessionId,
        executionId: context.executionId,
        userInput: input,
        metadata: { toolName, ...context }
      };

      await this.hookManager.executeHooks('beforeExecution', hookContext);

      const result = await Promise.race([
        tool.handler(validatedInput, hookContext),
        this.createTimeout(tool.timeoutMs || 30000)
      ]);

      const outputData = tool.outputSchema.parse(result);

      if (tool.cacheEnabled && outputData) {
        const cacheKey = this.generateCacheKey(toolName, validatedInput);
        this.setCache(cacheKey, outputData, tool.cacheTtlSeconds || 3600);
      }

      hookContext.metadata = { ...hookContext.metadata, outputGenerated: true, outputContent: outputData };
      await this.hookManager.executeHooks('afterExecution', hookContext);

      this.logger.info(`Tool executed successfully: ${toolName}`, {
        executionTimeMs: Date.now() - startTime
      });

      return {
        success: true,
        data: outputData,
        executionTimeMs: Date.now() - startTime,
        cached: false
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`Tool execution failed: ${toolName}`, error);

      const hookContext: HookContext = {
        timestamp: new Date(),
        sessionId: context.sessionId,
        executionId: context.executionId,
        userInput: input,
        metadata: { toolName, lastError: error, ...context }
      };

      await this.hookManager.executeHooks('onError', hookContext);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: executionTime
      };
    }
  }

  private checkRateLimit(
    toolName: string,
    userId: string,
    rateLimit: { maxRequests: number; windowMs: number }
  ): { allowed: boolean; retryAfterMs?: number } {
    const key = `${toolName}:${userId}`;
    const tracker = this.rateLimitTracker.get(key);
    const now = new Date();

    if (!tracker || now > tracker.resetAt) {
      this.rateLimitTracker.set(key, {
        count: 1,
        resetAt: new Date(now.getTime() + rateLimit.windowMs)
      });
      return { allowed: true };
    }

    if (tracker.count >= rateLimit.maxRequests) {
      const retryAfter = tracker.resetAt.getTime() - now.getTime();
      return { allowed: false, retryAfterMs: retryAfter };
    }

    tracker.count++;
    return { allowed: true };
  }

  private generateCacheKey(toolName: string, input: any): string {
    const inputStr = JSON.stringify(input);
    return `${toolName}:${this.hash(inputStr)}`;
  }

  private hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (new Date() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCache(key: string, data: any, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000)
    });
  }

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Tool execution timeout after ${ms}ms`)), ms)
    );
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getToolsByCategory(category: ToolDefinition['category']): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(tool => tool.category === category);
  }

  clearCache(): void {
    this.cache.clear();
    this.logger.debug('Tool cache cleared');
  }

  clearRateLimits(): void {
    this.rateLimitTracker.clear();
    this.logger.debug('Rate limit trackers cleared');
  }
}

const methodologyExecutorTool: ToolDefinition = {
  name: 'methodologyExecutor',
  description: 'Executes a specific FDE methodology with validated inputs and returns structured results',
  category: 'methodology',
  inputSchema: z.object({
    methodology: z.enum([
      'astmStandards',
      'swgdocStandards',
      'classVsIndividualCharacteristics',
      'naturalVariationAnalysis',
      'nas2009Critique',
      'esdaMethodology',
      'chainOfCustody'
    ]),
    parameters: z.record(z.any()),
    options: z.object({
      includeReferences: z.boolean().optional().default(false),
      detailLevel: z.enum(['basic', 'standard', 'comprehensive']).optional().default('standard'),
      includeExamples: z.boolean().optional().default(false)
    }).optional()
  }),
  outputSchema: z.object({
    methodology: z.string(),
    executedAt: z.string(),
    results: z.object({
      description: z.string(),
      steps: z.array(z.object({
        stepNumber: z.number(),
        description: z.string(),
        guidance: z.string(),
        considerations: z.array(z.string()).optional()
      })),
      keyPrinciples: z.array(z.string()),
      references: z.array(z.string()).optional(),
      examples: z.array(z.any()).optional()
    }),
    metadata: z.object({
      version: z.string(),
      lastUpdated: z.string(),
      sourceStandards: z.array(z.string())
    })
  }),
  handler: async (input, context) => {
    const methodology = input.methodology as string;
    const parameters = input.parameters || {};
    const options = input.options || {};

    const methodologyData: Record<string, any> = {
      astmStandards: {
        description: 'ASTM E2290 Standard Guide for Examination of Handwritten Items',
        steps: [
          {
            stepNumber: 1,
            description: 'Document Receipt and Integrity Verification',
            guidance: 'Verify chain of custody and document integrity upon receipt',
            considerations: ['Check for tampering indicators', 'Document storage conditions', 'Proper handling procedures']
          },
          {
            stepNumber: 2,
            description: 'Exemplar Collection Guidelines',
            guidance: 'Collect appropriate exemplars following ASTM standards',
            considerations: ['Contemporaneous samples preferred', 'Similar writing instruments', 'Comparable writing conditions']
          },
          {
            stepNumber: 3,
            description: 'Preliminary Examination',
            guidance: 'Conduct visual and instrumental examination',
            considerations: ['Lighting conditions', 'Magnification levels', 'Documentation methods']
          }
        ],
        keyPrinciples: ['Scientific methodology', 'Reproducibility', 'Documentation', 'Peer review'],
        references: ['ASTM E2290-20', 'SWGDOC Standards'],
        metadata: { version: '2020', lastUpdated: '2020-01-01', sourceStandards: ['ASTM', 'SWGDOC'] }
      },
      swgdocStandards: {
        description: 'SWGDOC Standards for Examining Documents',
        steps: [
          {
            stepNumber: 1,
            description: 'Case Assessment and Planning',
            guidance: 'Develop systematic examination approach',
            considerations: ['Case requirements', 'Available materials', 'Time constraints']
          },
          {
            stepNumber: 2,
            description: 'Document Collection and Preservation',
            guidance: 'Follow established evidence handling protocols',
            considerations: ['Chain of custody', 'Environmental protection', 'Original preservation']
          }
        ],
        keyPrinciples: ['Quality standards', 'Methodological rigor', 'Professional ethics'],
        references: ['SWGDOC Standards 2018'],
        metadata: { version: '2018', lastUpdated: '2018-06-01', sourceStandards: ['SWGDOC'] }
      }
    };

    if (!methodologyData[methodology]) {
      throw new Error(`Unknown methodology: ${methodology}`);
    }

    const baseResults = methodologyData[methodology];

    if (options.includeReferences) {
      baseResults.references = baseResults.references || [];
    }

    if (options.includeExamples) {
      baseResults.examples = [
        { scenario: 'Sample case study 1', outcome: 'Illustrates principle application' }
      ];
    }

    return {
      methodology,
      executedAt: new Date().toISOString(),
      results: baseResults,
      metadata: baseResults.metadata
    };
  },
  timeoutMs: 30000,
  cacheEnabled: true,
  cacheTtlSeconds: 3600
};

const referenceResolverTool: ToolDefinition = {
  name: 'referenceResolver',
  description: 'Resolves and retrieves reference materials, research papers, and authoritative sources',
  category: 'reference',
  inputSchema: z.object({
    referenceType: z.enum(['paper', 'standard', 'methodology', 'caseStudy', 'bestPractice']),
    query: z.string().max(500),
    filters: z.object({
      yearRange: z.tuple([z.number(), z.number()]).optional(),
      authors: z.array(z.string()).optional(),
      standards: z.array(z.string()).optional()
    }).optional()
  }),
  outputSchema: z.object({
    references: z.array(z.object({
      id: z.string(),
      type: z.string(),
      title: z.string(),
      authors: z.array(z.string()),
      year: z.number(),
      source: z.string(),
      doi: z.string().optional(),
      url: z.string().optional(),
      abstract: z.string().optional(),
      keyPrinciples: z.array(z.string()).optional(),
      relevanceScore: z.number()
    })),
    totalFound: z.number(),
    queryExecuted: z.string()
  }),
  handler: async (input) => {
    const mockReferences = [
      {
        id: 'kam-1994',
        type: 'paper',
        title: 'Proficiency of Professional Document Examiners in Writer Identification',
        authors: ['M. Kam', 'J. Wetstein', 'R. Conn'],
        year: 1994,
        source: 'Journal of Forensic Sciences',
        doi: '10.1520/JFS12432J',
        keyPrinciples: ['Empirical error rate measurement', 'Blind study design', 'Professional proficiency assessment'],
        relevanceScore: 0.95
      },
      {
        id: 'nas-2009',
        type: 'standard',
        title: 'Strengthening Forensic Science in the United States: A Path Forward',
        authors: ['National Research Council'],
        year: 2009,
        source: 'National Academies Press',
        keyPrinciples: ['Scientific validity assessment', 'Error rate documentation', 'Methodological standardization'],
        relevanceScore: 0.92
      }
    ];

    return {
      references: mockReferences,
      totalFound: mockReferences.length,
      queryExecuted: input.query
    };
  },
  timeoutMs: 15000,
  cacheEnabled: true,
  cacheTtlSeconds: 7200
};

const outputFormatterTool: ToolDefinition = {
  name: 'outputFormatter',
  description: 'Formats skill output into structured, consistent formats (report, checklist, memo, structured)',
  category: 'output',
  inputSchema: z.object({
    content: z.object({
      methodology: z.string().optional(),
      findings: z.array(z.string()).optional(),
      recommendations: z.array(z.string()).optional(),
      principles: z.array(z.string()).optional(),
      disclaimer: z.string()
    }),
    format: z.enum(['structured', 'checklist', 'memo', 'report', 'technicalBrief']),
    options: z.object({
      includeTimestamp: z.boolean().optional().default(true),
      includeMetadata: z.boolean().optional().default(false),
      sections: z.array(z.string()).optional(),
      detailLevel: z.enum(['concise', 'standard', 'detailed']).optional().default('standard')
    }).optional()
  }),
  outputSchema: z.object({
    format: z.string(),
    content: z.string(),
    metadata: z.object({
      generatedAt: z.string(),
      methodology: z.string().optional(),
      wordCount: z.number()
    }).optional()
  }),
  handler: async (input) => {
    const { content, format, options } = input;
    const timestamp = new Date().toISOString();

    let formattedContent = '';

    switch (format) {
      case 'structured':
        formattedContent = formatStructured(content, options);
        break;
      case 'checklist':
        formattedContent = formatChecklist(content, options);
        break;
      case 'memo':
        formattedContent = formatMemo(content, options);
        break;
      case 'report':
        formattedContent = formatReport(content, options);
        break;
      case 'technicalBrief':
        formattedContent = formatTechnicalBrief(content, options);
        break;
    }

    return {
      format,
      content: formattedContent,
      metadata: {
        generatedAt: timestamp,
        methodology: content.methodology,
        wordCount: formattedContent.split(/\s+/).length
      }
    };
  },
  timeoutMs: 10000,
  cacheEnabled: false
};

const disclaimerManagerTool: ToolDefinition = {
  name: 'disclaimerManager',
  description: 'Ensures all outputs include mandatory disclaimers and appropriate language',
  category: 'validation',
  inputSchema: z.object({
    content: z.string(),
    disclaimerType: z.enum(['standard', 'legal', 'medical', 'financial']),
    context: z.object({
      userRole: z.string().optional(),
      jurisdiction: z.string().optional(),
      specificRequirements: z.array(z.string()).optional()
    }).optional()
  }),
  outputSchema: z.object({
    content: z.string(),
    disclaimerIncluded: z.boolean(),
    disclaimerText: z.string(),
    placement: z.enum(['prefix', 'suffix', 'both', 'integrated'))
  }),
  handler: async (input) => {
    const disclaimerText = generateDisclaimer(input.disclaimerType, input.context);
    const contentWithDisclaimer = integrateDisclaimer(input.content, disclaimerText, 'suffix');

    return {
      content: contentWithDisclaimer,
      disclaimerIncluded: true,
      disclaimerText,
      placement: 'suffix'
    };
  },
  timeoutMs: 5000,
  cacheEnabled: false
};

const scopeValidatorTool: ToolDefinition = {
  name: 'scopeValidator',
  description: 'Validates that user requests stay within skill scope and guardrails',
  category: 'validation',
  inputSchema: z.object({
    userInput: z.string(),
    requestedMethodology: z.string().optional(),
    context: z.object({
      userIntent: z.string().optional(),
      potentialRisks: z.array(z.string()).optional()
    }).optional()
  }),
  outputSchema: z.object({
    inScope: z.boolean(),
    violations: z.array(z.object({
      type: z.string(),
      description: z.string(),
      severity: z.enum(['low', 'medium', 'high', 'critical'])
    })),
    recommendedActions: z.array(z.string()),
    requiresReferral: z.boolean(),
    canProceed: z.boolean()
  }),
  handler: async (input) => {
    const violations: any[] = [];
    const recommendedActions: string[] = [];
    let requiresReferral = false;

    const verdictPatterns = [
      { pattern: /verdict|conclude.*genuine|determine.*forged/i, type: 'verdict-request', severity: 'critical' as const },
      { pattern: /this signature is.*genuine|this document is.*authentic/i, type: 'specific-case-verdict', severity: 'critical' as const },
      { pattern: /tell me if.*real|confirm.*authenticity/i, type: 'authentication-request', severity: 'high' as const }
    ];

    for (const { pattern, type, severity } of verdictPatterns) {
      if (pattern.test(input.userInput)) {
        violations.push({
          type,
          description: `Input requests professional verdict beyond educational scope`,
          severity
        });
        recommendedActions.push('Include referral to certified FDE');
        recommendedActions.push('Emphasize educational nature of response');
        requiresReferral = true;
      }
    }

    return {
      inScope: violations.length === 0,
      violations,
      recommendedActions,
      requiresReferral,
      canProceed: true
    };
  },
  timeoutMs: 5000,
  cacheEnabled: false
};

const methodologyApplierTool: ToolDefinition = {
  name: 'methodologyApplier',
  description: 'Applies specific FDE methodologies to user questions and generates structured responses',
  category: 'methodology',
  inputSchema: z.object({
    userQuestion: z.string(),
    methodology: z.enum([
      'astmStandards',
      'swgdocStandards',
      'classVsIndividualCharacteristics',
      'naturalVariationAnalysis',
      'nas2009Critique',
      'esdaMethodology',
      'chainOfCustody'
    ]),
    context: z.object({
      userExpertise: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
      specificFocus: z.string().optional(),
      includeCaseStudies: z.boolean().optional().default(false)
    }).optional()
  }),
  outputSchema: z.object({
    methodologyApplied: z.string(),
    questionAddressed: z.string(),
    response: z.object({
      introduction: z.string(),
      methodologyExplanation: z.string(),
      keyPrinciples: z.array(z.string()),
      practicalGuidance: z.array(z.string()),
      limitationsAndCaveats: z.array(z.string()),
      conclusion: z.string(),
      disclaimer: z.string()
    }),
    references: z.array(z.string()),
    metadata: z.object({
      generatedAt: z.string(),
      methodologyVersion: z.string(),
      complexityLevel: z.string()
    })
  }),
  handler: async (input) => {
    const methodologyInfo: Record<string, any> = {
      classVsIndividualCharacteristics: {
        introduction: 'Understanding the distinction between class and individual characteristics is fundamental to forensic document examination.',
        methodologyExplanation: 'Class characteristics are features shared by a group of writers or writing systems, while individual characteristics are unique to a specific writer. FDE methodology first eliminates class characteristics before analyzing individual features.',
        keyPrinciples: ['Class characteristics come first', 'Individual characteristics must be distinctive', 'Combination of features provides identification'],
        practicalGuidance: [
          'Start with broad class characteristics (letter formation style, pen pressure patterns)',
          'Identify individual characteristics (unique letter formations, habitual patterns)',
          'Assess significance of individual characteristics found'
        ],
        limitationsAndCaveats: [
          'Natural variation exists within a single writer\'s output',
          'Some characteristics may be influenced by writing conditions',
          'Limited samples may reduce discriminatory power'
        ]
      },
      naturalVariationAnalysis: {
        introduction: 'Natural variation is the range of naturally occurring differences in a person\'s handwriting across different writing instances.',
        methodologyExplanation: 'Every person\'s handwriting varies naturally. Understanding normal variation ranges is essential to avoid misinterpreting natural differences as significant divergences or conversely, overlooking significant differences within normal variation.',
        keyPrinciples: ['Establish variation range', 'Consider writing conditions', 'Account for temporal changes'],
        practicalGuidance: [
          'Collect multiple exemplars to establish normal variation',
          'Consider factors affecting variation (speed, surface, writing instrument)',
          'Compare questioned samples within the established variation range'
        ],
        limitationsAndCaveats: [
          'Limited exemplars may not capture full variation range',
          'Writing outside normal conditions may produce atypical samples',
          'Some writers have more consistent writing than others'
        ]
      }
    };

    const info = methodologyInfo[input.methodology];
    if (!info) {
      throw new Error(`Methodology not implemented: ${input.methodology}`);
    }

    return {
      methodologyApplied: input.methodology,
      questionAddressed: input.userQuestion,
      response: {
        ...info,
        conclusion: `This ${input.methodology} framework provides a structured approach to document examination based on established standards and research.`,
        disclaimer: 'This information is educational and should not be used as a substitute for professional forensic document examination services.'
      },
      references: [
        'ASTM E2290-20',
        'SWGDOC Standards 2018',
        'National Research Council (2009). Strengthening Forensic Science in the United States'
      ],
      metadata: {
        generatedAt: new Date().toISOString(),
        methodologyVersion: '1.0',
        complexityLevel: input.context?.userExpertise || 'intermediate'
      }
    };
  },
  timeoutMs: 20000,
  cacheEnabled: true,
  cacheTtlSeconds: 1800
};

function formatStructured(content: any, options?: any): string {
  const sections: string[] = [];

  if (content.methodology) {
    sections.push(`## Methodology Applied\n${content.methodology}`);
  }

  if (content.findings && content.findings.length > 0) {
    sections.push(`## Key Findings\n${content.findings.map((f: string, i: number) => `${i + 1}. ${f}`).join('\n')}`);
  }

  if (content.principles && content.principles.length > 0) {
    sections.push(`## Core Principles\n${content.principles.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n')}`);
  }

  if (content.recommendations && content.recommendations.length > 0) {
    sections.push(`## Recommendations\n${content.recommendations.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}`);
  }

  sections.push(`## Disclaimer\n${content.disclaimer}`);

  return sections.join('\n\n');
}

function formatChecklist(content: any, options?: any): string {
  const items: string[] = [];

  if (content.principles) {
    content.principles.forEach((p: string, i: number) => {
      items.push(`- [ ] ${p}`);
    });
  }

  if (content.findings) {
    content.findings.forEach((f: string, i: number) => {
      items.push(`- [ ] ${f}`);
    });
  }

  return `# Checklist\n\n${items.join('\n')}\n\n---\n\n**Disclaimer**: ${content.disclaimer}`;
}

function formatMemo(content: any, options?: any): string {
  const date = new Date().toLocaleDateString();

  return `MEMORANDUM\n\nTO: User\nFROM: Forensic Document Examination Advisor\nDATE: ${date}\nSUBJECT: ${content.methodology || 'Document Examination Guidance'}\n\n${content.findings?.map((f: string) => f + '.').join('\n\n') || ''}\n\n---\n\n${content.disclaimer}`;
}

function formatReport(content: any, options?: any): string {
  return `# Forensic Document Examination Report\n\n## Executive Summary\n${content.findings?.[0] || 'Analysis completed using established methodology.'}\n\n## Detailed Analysis\n${content.findings?.slice(1).map((f: string) => `### ${f}`).join('\n\n') || ''}\n\n## Conclusions\n${content.recommendations?.map((r: string) => `- ${r}`).join('\n') || ''}\n\n## Disclaimer\n${content.disclaimer}`;
}

function formatTechnicalBrief(content: any, options?: any): string {
  return `# Technical Brief: ${content.methodology || 'Document Examination'}\n\n## Overview\n${content.findings?.[0] || ''}\n\n## Technical Details\n${content.principles?.map((p: string) => `**${p}**`).join('\n\n') || ''}\n\n## Practical Applications\n${content.recommendations?.map((r: string) => `${r}`).join('\n') || ''}\n\n---\n\n${content.disclaimer}`;
}

function generateDisclaimer(type: string, context?: any): string {
  const baseDisclaimer = 'This information is provided for educational purposes only and should not be used as a substitute for professional forensic document examination services.';

  const specificDisclaimers: Record<string, string> = {
    standard: baseDisclaimer,
    legal: baseDisclaimer + ' For legal matters, consult a certified forensic document examiner and appropriate legal counsel.',
    medical: baseDisclaimer + ' This information is not medical advice.',
    financial: baseDisclaimer + ' Consult appropriate professionals for financial decisions.'
  };

  return specificDisclaimers[type] || baseDisclaimer;
}

function integrateDisclaimer(content: string, disclaimer: string, placement: string): string {
  switch (placement) {
    case 'prefix':
      return `**Disclaimer**: ${disclaimer}\n\n${content}`;
    case 'suffix':
      return `${content}\n\n---\n\n**Disclaimer**: ${disclaimer}`;
    case 'both':
      return `**Disclaimer**: ${disclaimer}\n\n${content}\n\n---\n\n**Disclaimer**: ${disclaimer}`;
    case 'integrated':
      return `${content}\n\n*${disclaimer}*`;
    default:
      return `${content}\n\n**Disclaimer**: ${disclaimer}`;
  }
}
