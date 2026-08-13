# Skill Registry Documentation

## Overview

This document explains how skills are registered, resolved, executed, and validated within the Forensic Document Examination Advisor system.

## Skill Registration

### Registration Schema

```typescript
interface SkillRegistration {
  name: string;
  version: string;
  description: string;
  category: SkillCategory;
  capabilities: SkillCapability[];
  dependencies: SkillDependency[];
  inputSchema: z.ZodSchema;
  outputSchema: z.ZodSchema;
  metadata: SkillMetadata;
}
```

### Registration Process

1. **Skill Definition**: Skills are defined in `SKILL.md` files with frontmatter metadata
2. **Schema Validation**: Input/output schemas are validated using Zod
3. **Capability Registration**: Skill capabilities are registered for resolution
4. **Dependency Resolution**: Required dependencies are resolved and validated
5. **Registry Storage**: Registration is stored in the central skill registry

### Skill Categories

```typescript
enum SkillCategory {
  METHODOLOGY = 'methodology',
  ANALYSIS = 'analysis',
  VALIDATION = 'validation',
  OUTPUT = 'output',
  SYSTEM = 'system'
}
```

## Skill Resolution

### Resolution Algorithm

```typescript
async function resolveSkill(
  userInput: string,
  context: ExecutionContext
): Promise<SkillResolution> {
  // 1. Analyze user input for skill triggers
  const triggers = analyzeInput(userInput);

  // 2. Match triggers to skill descriptions
  const candidates = matchSkills(triggers);

  // 3. Filter by capability and compatibility
  const compatible = filterCompatible(candidates, context);

  // 4. Rank by relevance and specificity
  const ranked = rankByRelevance(compatible, userInput);

  // 5. Select best match
  return ranked[0] || null;
}
```

### Resolution Criteria

1. **Description Matching**: Keyword and semantic matching to skill descriptions
2. **Capability Matching**: Required capabilities must be available
3. **Compatibility Check**: Dependencies must be satisfied
4. **Context Relevance**: Current execution context considered
5. **Priority Ranking**: More specific skills prioritized over general ones

## Skill Execution

### Execution Framework

```typescript
interface SkillExecution {
  skill: SkillRegistration;
  input: ValidatedInput;
  context: ExecutionContext;
  hooks: HookManager;
  tools: ToolManager;
}

async function executeSkill(execution: SkillExecution): Promise<ExecutionResult> {
  // 1. Pre-execution hooks
  await execution.hooks.executeHooks('beforeExecution', execution.context);

  // 2. Input validation
  const validatedInput = execution.skill.inputSchema.parse(execution.input);

  // 3. Skill execution
  const result = await executeSkillLogic(execution.skill, validatedInput, execution.context);

  // 4. Output validation
  const validatedOutput = execution.skill.outputSchema.parse(result);

  // 5. Post-execution hooks
  execution.context.metadata = { outputGenerated: true, outputContent: validatedOutput };
  await execution.hooks.executeHooks('afterExecution', execution.context);

  // 6. Return validated result
  return validatedOutput;
}
```

### Execution Phases

1. **Pre-Execution Validation**
   - Input schema validation
   - Scope compliance checking
   - Context initialization
   - Permission verification

2. **Skill Logic Execution**
   - Methodology application
   - Reference resolution
   - Analysis execution
   - Result generation

3. **Post-Execution Validation**
   - Output schema validation
   - Disclaimer enforcement
   - Format verification
   - Quality assurance checks

## Skill Validation

### Validation Framework

```typescript
interface SkillValidation {
  inputValidation: ValidationRule[];
  outputValidation: ValidationRule[];
  executionValidation: ValidationRule[];
  scopeValidation: ValidationRule[];
  qualityValidation: ValidationRule[];
}
```

### Validation Rules

1. **Input Validation**
   - Schema compliance (Zod)
   - Type checking
   - Range validation
   - Format verification

2. **Output Validation**
   - Schema compliance
   - Disclaimer presence
   - Scope compliance
   - Format correctness

3. **Execution Validation**
   - Hook execution success
   - Tool execution success
   - Error handling
   - Resource cleanup

4. **Scope Validation**
   - Verdict refusal enforcement
   - Professional referral requirements
   - Limitation acknowledgment
   - Guardrail compliance

5. **Quality Validation**
   - Methodology application correctness
   - Reference citation accuracy
   - Logical consistency
   - Professional standards compliance

## Input/Output JSON Schemas

### Methodology Execution Schema

```json
{
  "input": {
    "type": "object",
    "properties": {
      "methodology": {
        "type": "string",
        "enum": [
          "astmStandards",
          "swgdocStandards",
          "classVsIndividualCharacteristics",
          "naturalVariationAnalysis",
          "nas2009Critique",
          "esdaMethodology",
          "chainOfCustody"
        ]
      },
      "parameters": {
        "type": "object",
        "additionalProperties": true
      },
      "options": {
        "type": "object",
        "properties": {
          "includeReferences": {
            "type": "boolean",
            "default": false
          },
          "detailLevel": {
            "type": "string",
            "enum": ["basic", "standard", "comprehensive"],
            "default": "standard"
          },
          "includeExamples": {
            "type": "boolean",
            "default": false
          }
        }
      }
    },
    "required": ["methodology"]
  },
  "output": {
    "type": "object",
    "properties": {
      "methodology": {
        "type": "string"
      },
      "executedAt": {
        "type": "string",
        "format": "date-time"
      },
      "results": {
        "type": "object",
        "properties": {
          "description": {
            "type": "string"
          },
          "steps": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "stepNumber": {
                  "type": "integer"
                },
                "description": {
                  "type": "string"
                },
                "guidance": {
                  "type": "string"
                },
                "considerations": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                }
              },
              "required": ["stepNumber", "description", "guidance"]
            }
          },
          "keyPrinciples": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "references": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "examples": {
            "type": "array",
            "items": {
              "type": "object"
            }
          }
        },
        "required": ["description", "steps", "keyPrinciples"]
      },
      "metadata": {
        "type": "object",
        "properties": {
          "version": {
            "type": "string"
          },
          "lastUpdated": {
            "type": "string",
            "format": "date"
          },
          "sourceStandards": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": ["version", "lastUpdated", "sourceStandards"]
      }
    },
    "required": ["methodology", "executedAt", "results", "metadata"]
  }
}
```

### Reference Resolution Schema

```json
{
  "input": {
    "type": "object",
    "properties": {
      "referenceType": {
        "type": "string",
        "enum": ["paper", "standard", "methodology", "caseStudy", "bestPractice"]
      },
      "query": {
        "type": "string",
        "maxLength": 500
      },
      "filters": {
        "type": "object",
        "properties": {
          "yearRange": {
            "type": "array",
            "items": {
              "type": "integer"
            },
            "minItems": 2,
            "maxItems": 2
          },
          "authors": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "standards": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        }
      }
    },
    "required": ["referenceType", "query"]
  },
  "output": {
    "type": "object",
    "properties": {
      "references": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "type": {
              "type": "string"
            },
            "title": {
              "type": "string"
            },
            "authors": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "year": {
              "type": "integer"
            },
            "source": {
              "type": "string"
            },
            "doi": {
              "type": "string"
            },
            "url": {
              "type": "string",
              "format": "uri"
            },
            "abstract": {
              "type": "string"
            },
            "keyPrinciples": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "relevanceScore": {
              "type": "number",
              "minimum": 0,
              "maximum": 1
            }
          },
          "required": ["id", "type", "title", "authors", "year", "source", "relevanceScore"]
        }
      },
      "totalFound": {
        "type": "integer"
      },
      "queryExecuted": {
        "type": "string"
      }
    },
    "required": ["references", "totalFound", "queryExecuted"]
  }
}
```

### Output Formatting Schema

```json
{
  "input": {
    "type": "object",
    "properties": {
      "content": {
        "type": "object",
        "properties": {
          "methodology": {
            "type": "string"
          },
          "findings": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "recommendations": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "principles": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "disclaimer": {
            "type": "string"
          }
        },
        "required": ["disclaimer"]
      },
      "format": {
        "type": "string",
        "enum": ["structured", "checklist", "memo", "report", "technicalBrief"]
      },
      "options": {
        "type": "object",
        "properties": {
          "includeTimestamp": {
            "type": "boolean",
            "default": true
          },
          "includeMetadata": {
            "type": "boolean",
            "default": false
          },
          "sections": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "detailLevel": {
            "type": "string",
            "enum": ["concise", "standard", "detailed"],
            "default": "standard"
          }
        }
      }
    },
    "required": ["content", "format"]
  },
  "output": {
    "type": "object",
    "properties": {
      "format": {
        "type": "string"
      },
      "content": {
        "type": "string"
      },
      "metadata": {
        "type": "object",
        "properties": {
          "generatedAt": {
            "type": "string",
            "format": "date-time"
          },
          "methodology": {
            "type": "string"
          },
          "wordCount": {
            "type": "integer"
          }
        },
        "required": ["generatedAt", "wordCount"]
      }
    },
    "required": ["format", "content"]
  }
}
```

## Error Handling and Recovery

### Error Categories

```typescript
enum ErrorCategory {
  VALIDATION_ERROR = 'validation_error',
  EXECUTION_ERROR = 'execution_error',
  SCOPE_ERROR = 'scope_error',
  RESOURCE_ERROR = 'resource_error',
  TIMEOUT_ERROR = 'timeout_error',
  SYSTEM_ERROR = 'system_error'
}
```

### Error Response Schema

```json
{
  "type": "object",
  "properties": {
    "success": {
      "type": "boolean"
    },
    "error": {
      "type": "object",
      "properties": {
        "category": {
          "type": "string",
          "enum": ["validation_error", "execution_error", "scope_error", "resource_error", "timeout_error", "system_error"]
        },
        "message": {
          "type": "string"
        },
        "code": {
          "type": "string"
        },
        "details": {
          "type": "object",
          "additionalProperties": true
        },
        "retryable": {
          "type": "boolean"
        },
        "fallbackAvailable": {
          "type": "boolean"
        }
      },
      "required": ["category", "message"]
    },
    "fallback": {
      "type": "object",
      "properties": {
        "message": {
          "type": "string"
        },
        "requiresReferral": {
          "type": "boolean"
        }
      }
    }
  }
}
```

## Performance Metrics

### Execution Metrics

```typescript
interface ExecutionMetrics {
  executionId: string;
  skillName: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  success: boolean;
  inputSize: number;
  outputSize: number;
  cacheHit: boolean;
  hooksExecuted: string[];
  toolsInvoked: string[];
  errors: ErrorInfo[];
}
```

### Quality Metrics

```typescript
interface QualityMetrics {
  methodologyApplied: boolean;
  disclaimerIncluded: boolean;
  scopeCompliant: boolean;
  outputStructured: boolean;
  referencesCited: boolean;
  limitationsAcknowledged: boolean;
  overallQuality: number;
}
```

## Registry Management

### Registry Operations

1. **Registration**: Add new skill to registry
2. **Update**: Modify existing skill registration
3. **Deactivation**: Temporarily disable skill
4. **Removal**: Permanently remove skill from registry
5. **Query**: Search and filter registered skills
6. **Validation**: Validate skill registration compliance

### Registry Persistence

```typescript
interface RegistryStorage {
  save(registration: SkillRegistration): Promise<void>;
  load(name: string): Promise<SkillRegistration>;
  list(filter?: RegistryFilter): Promise<SkillRegistration[]>;
  update(name: string, updates: Partial<SkillRegistration>): Promise<void>;
  remove(name: string): Promise<void>;
}
```

## Security and Access Control

### Permission Model

```typescript
interface SkillPermissions {
  execute: boolean;
  modify: boolean;
  share: boolean;
  audit: boolean;
}

interface AccessControl {
  checkPermission(skill: string, permission: keyof SkillPermissions): boolean;
  grantAccess(skill: string, permissions: SkillPermissions): void;
  revokeAccess(skill: string, permissions: SkillPermissions): void;
  auditLog(skill: string): AccessLog[];
}
```

### Security Considerations

1. **Input Sanitization**: All inputs validated and sanitized
2. **Output Filtering**: Sensitive information filtered from outputs
3. **Execution Isolation**: Skills executed in isolated contexts
4. **Resource Limits**: CPU, memory, and time limits enforced
5. **Audit Trail**: All skill executions logged for audit

---

**Version**: 1.0.0
**Last Updated**: 2025-01-10
**Maintainer**: Forensic Document Examination Advisor Development Team
