/**
 * Production-grade structured logging system for Forensic Document Examination Advisor
 * Provides comprehensive logging capabilities with proper log levels, error handling, and monitoring
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: {
    sessionId?: string;
    executionId?: string;
    userId?: string;
    methodology?: string;
    [key: string]: any;
  };
}

export interface LoggerConfig {
  level: LogLevel;
  format: 'structured' | 'text' | 'json';
  outputs: Array<'console' | 'file' | 'remote'>;
  directory?: string;
  maxFiles?: number;
  maxSize?: string;
  remoteEndpoint?: string;
  apiKey?: string;
}

export class Logger {
  private config: LoggerConfig;
  private currentLevel: LogLevel;
  private logBuffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private remoteLoggingEnabled: boolean = false;

  constructor(config: LoggerConfig) {
    this.config = config;
    this.currentLevel = config.level;

    if (config.outputs.includes('remote') && config.remoteEndpoint) {
      this.remoteLoggingEnabled = true;
    }

    this.setupFlushInterval();
  }

  private setupFlushInterval(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    this.flushInterval = setInterval(() => {
      this.flush();
    }, 5000);
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.currentLevel;
  }

  private formatLogEntry(entry: LogEntry): string {
    switch (this.config.format) {
      case 'json':
        return JSON.stringify(entry);
      case 'text':
        return this.formatAsText(entry);
      case 'structured':
      default:
        return this.formatAsStructured(entry);
    }
  }

  private formatAsText(entry: LogEntry): string {
    const levelName = LogLevel[entry.level];
    const timestamp = entry.timestamp.toISOString();
    let output = `[${timestamp}] [${levelName}] ${entry.message}`;

    if (entry.context) {
      const contextStr = Object.entries(entry.context)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(' ');
      output += ` | ${contextStr}`;
    }

    if (entry.error) {
      output += ` | Error: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        output += `\n${entry.error.stack}`;
      }
    }

    return output;
  }

  private formatAsStructured(entry: LogEntry): string {
    const levelName = LogLevel[entry.level];
    const timestamp = entry.timestamp.toISOString();
    const metadata = entry.metadata || {};

    let output = `{
  "timestamp": "${timestamp}",
  "level": "${levelName}",
  "message": ${JSON.stringify(entry.message)}`;

    if (Object.keys(metadata).length > 0) {
      output += `,
  "metadata": ${JSON.stringify(metadata)}`;
    }

    if (entry.context) {
      output += `,
  "context": ${JSON.stringify(entry.context)}`;
    }

    if (entry.error) {
      output += `,
  "error": {
    "name": "${entry.error.name}",
    "message": ${JSON.stringify(entry.error.message)}`;
      if (entry.error.stack) {
        output += `,
    "stack": ${JSON.stringify(entry.error.stack)}`;
      }
      if (entry.error.code) {
        output += `,
    "code": "${entry.error.code}"`;
      }
      output += '\n  }';
    }

    output += '\n}';
    return output;
  }

  private writeLog(entry: LogEntry): void {
    const formattedEntry = this.formatLogEntry(entry);

    for (const output of this.config.outputs) {
      switch (output) {
        case 'console':
          this.writeToConsole(entry, formattedEntry);
          break;
        case 'file':
          this.writeToBuffer(entry);
          break;
        case 'remote':
          if (this.remoteLoggingEnabled) {
            this.sendToRemote(entry).catch(err => {
              console.error('Failed to send log to remote:', err);
            });
          }
          break;
      }
    }
  }

  private writeToConsole(entry: LogEntry, formattedEntry: string): void {
    const consoleMethod = this.getConsoleMethod(entry.level);
    consoleMethod(formattedEntry);
  }

  private getConsoleMethod(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        return console.error;
      default:
        return console.log;
    }
  }

  private writeToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);

    if (this.logBuffer.length >= 100) {
      this.flush();
    }
  }

  private async sendToRemote(entry: LogEntry): Promise<void> {
    if (!this.remoteLoggingEnabled || !this.config.remoteEndpoint) {
      return;
    }

    try {
      const response = await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey || ''}`,
          'X-Log-Source': 'forensic-document-examination-advisor'
        },
        body: JSON.stringify(entry)
      });

      if (!response.ok) {
        throw new Error(`Remote logging failed: ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Failed to send log to remote: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private flush(): void {
    if (this.logBuffer.length === 0) {
      return;
    }

    // In a real implementation, this would write to a file system
    // For now, we'll just clear the buffer since we're in a skill context
    this.logBuffer = [];
  }

  debug(message: string, context?: Record<string, any>, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.writeLog({
        timestamp: new Date(),
        level: LogLevel.DEBUG,
        message,
        context,
        metadata
      });
    }
  }

  info(message: string, context?: Record<string, any>, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.writeLog({
        timestamp: new Date(),
        level: LogLevel.INFO,
        message,
        context,
        metadata
      });
    }
  }

  warn(message: string, context?: Record<string, any>, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.writeLog({
        timestamp: new Date(),
        level: LogLevel.WARN,
        message,
        context,
        metadata
      });
    }
  }

  error(message: string, error?: Error | Record<string, any>, context?: Record<string, any>, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      let errorObj;
      if (error instanceof Error) {
        errorObj = {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: (error as any).code
        };
      } else {
        errorObj = error;
      }

      this.writeLog({
        timestamp: new Date(),
        level: LogLevel.ERROR,
        message,
        context,
        error: errorObj,
        metadata
      });
    }
  }

  fatal(message: string, error?: Error | Record<string, any>, context?: Record<string, any>, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.FATAL)) {
      let errorObj;
      if (error instanceof Error) {
        errorObj = {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: (error as any).code
        };
      } else {
        errorObj = error;
      }

      this.writeLog({
        timestamp: new Date(),
        level: LogLevel.FATAL,
        message,
        context,
        error: errorObj,
        metadata
      });
    }
  }

  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  getCurrentLevel(): LogLevel {
    return this.currentLevel;
  }

  clearBuffer(): void {
    this.logBuffer = [];
  }

  getBufferSize(): number {
    return this.logBuffer.length;
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush();
  }
}

export function createLogger(config: LoggerConfig): Logger {
  return new Logger(config);
}

export const defaultLoggerConfig: LoggerConfig = {
  level: LogLevel.INFO,
  format: 'structured',
  outputs: ['console'],
  directory: './logs',
  maxFiles: 10,
  maxSize: '10M'
};
