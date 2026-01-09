/**
 * Error Handling Service
 * 
 * Centralized error handling and logging for the application.
 * Provides consistent error reporting, user-friendly messages, and structured logging.
 * 
 * USAGE:
 * - Use ErrorHandlingService.handle() in catch blocks
 * - Use ErrorHandlingService.log() for non-critical warnings
 * - Use ErrorHandlingService.toast() to show user-facing errors
 * 
 * REPLACES:
 * - Inconsistent console.error() calls
 * - Manual toast error handling
 * - Silent failures
 * 
 * @module ErrorHandlingService
 */

import { toast } from '@/hooks/ui/use-toast';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  /** Critical error requiring immediate attention */
  CRITICAL = 'critical',
  /** Error that prevents feature from working */
  ERROR = 'error',
  /** Warning that doesn't prevent functionality */
  WARNING = 'warning',
  /** Informational message for debugging */
  INFO = 'info'
}

/**
 * Error context for detailed logging
 */
export interface ErrorContext {
  /** Component or service where error occurred */
  source?: string;
  /** Action being performed when error occurred */
  action?: string;
  /** User ID (if authenticated) */
  userId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Structured error for logging
 */
export interface StructuredError {
  message: string;
  severity: ErrorSeverity;
  timestamp: Date;
  context?: ErrorContext;
  originalError?: Error;
  stack?: string;
}

/**
 * Error Handling Service
 * 
 * Centralized error handling with consistent logging and user notifications
 */
export class ErrorHandlingService {
  /**
   * Handle an error with structured logging and optional user notification
   * 
   * @param error - The error to handle (Error object or string)
   * @param context - Additional context about where/why error occurred
   * @param options - Handling options (showToast, severity)
   * 
   * @example
   * ```typescript
   * try {
   *   await saveProject(project);
   * } catch (error) {
   *   ErrorHandlingService.handle(error, {
   *     source: 'ProjectModal',
   *     action: 'saveProject',
   *     metadata: { projectId: project.id }
   *   }, {
   *     showToast: true,
   *     severity: ErrorSeverity.ERROR
   *   });
   * }
   * ```
   */
  static handle(
    error: Error | string,
    context?: ErrorContext,
    options: {
      showToast?: boolean;
      severity?: ErrorSeverity;
      userMessage?: string;
    } = {}
  ): StructuredError {
    const {
      showToast = false,
      severity = ErrorSeverity.ERROR,
      userMessage
    } = options;

    // Create structured error
    const structuredError: StructuredError = {
      message: typeof error === 'string' ? error : error.message,
      severity,
      timestamp: new Date(),
      context,
      originalError: error instanceof Error ? error : undefined,
      stack: error instanceof Error ? error.stack : undefined
    };

    // Log to console with context
    this.logToConsole(structuredError);

    // Show user-facing toast if requested
    if (showToast) {
      this.showToast(structuredError, userMessage);
    }

    // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
    // this.sendToErrorTracking(structuredError);

    return structuredError;
  }

  /**
   * Log a warning (non-critical error)
   * 
   * @param message - Warning message
   * @param context - Additional context
   * 
   * @example
   * ```typescript
   * ErrorHandlingService.warn(
   *   'Project has no milestones',
   *   { source: 'ProjectOrchestrator', metadata: { projectId } }
   * );
   * ```
   */
  static warn(message: string, context?: ErrorContext): void {
    this.handle(message, context, {
      severity: ErrorSeverity.WARNING,
      showToast: false
    });
  }

  /**
   * Log informational message
   * 
   * @param message - Info message
   * @param context - Additional context
   */
  static info(message: string, context?: ErrorContext): void {
    this.handle(message, context, {
      severity: ErrorSeverity.INFO,
      showToast: false
    });
  }

  /**
   * Show error toast to user
   * 
   * @param error - Structured error
   * @param customMessage - Optional custom user-facing message
   */
  private static showToast(error: StructuredError, customMessage?: string): void {
    const title = this.getSeverityTitle(error.severity);
    const description = customMessage || this.getUserFriendlyMessage(error);

    toast({
      title,
      description,
      variant: error.severity === ErrorSeverity.WARNING ? 'default' : 'destructive',
    });
  }

  /**
   * Log error to console with formatting
   * 
   * @param error - Structured error to log
   */
  private static logToConsole(error: StructuredError): void {
    const emoji = this.getSeverityEmoji(error.severity);
    const prefix = `${emoji} [${error.severity.toUpperCase()}]`;

    // Build log message
    const logParts = [
      prefix,
      error.context?.source ? `[${error.context.source}]` : '',
      error.context?.action ? `${error.context.action}:` : '',
      error.message
    ].filter(Boolean);

    // Log with appropriate console method
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.ERROR:
        console.error(...logParts);
        if (error.stack) {
          console.error('Stack trace:', error.stack);
        }
        if (error.context?.metadata) {
          console.error('Metadata:', error.context.metadata);
        }
        break;
      case ErrorSeverity.WARNING:
        console.warn(...logParts);
        if (error.context?.metadata) {
          console.warn('Metadata:', error.context.metadata);
        }
        break;
      case ErrorSeverity.INFO:
        // Info logs are only shown in development
        if (process.env.NODE_ENV === 'development') {
          console.info(...logParts);
        }
        break;
    }
  }

  /**
   * Get user-friendly error message
   * 
   * @param error - Structured error
   * @returns User-friendly message
   */
  private static getUserFriendlyMessage(error: StructuredError): string {
    // Map technical errors to user-friendly messages
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch')) {
      return 'Network error. Please check your connection and try again.';
    }

    if (message.includes('unauthorized') || message.includes('auth')) {
      return 'Authentication error. Please sign in again.';
    }

    if (message.includes('not found') || message.includes('404')) {
      return 'The requested resource was not found.';
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return error.message; // Validation errors are already user-friendly
    }

    // Default to original message
    return error.message;
  }

  /**
   * Get severity title for toast
   * 
   * @param severity - Error severity
   * @returns Toast title
   */
  private static getSeverityTitle(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'Critical Error';
      case ErrorSeverity.ERROR:
        return 'Error';
      case ErrorSeverity.WARNING:
        return 'Warning';
      case ErrorSeverity.INFO:
        return 'Information';
    }
  }

  /**
   * Get emoji for severity level
   * 
   * @param severity - Error severity
   * @returns Emoji string
   */
  private static getSeverityEmoji(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return '🚨';
      case ErrorSeverity.ERROR:
        return '❌';
      case ErrorSeverity.WARNING:
        return '⚠️';
      case ErrorSeverity.INFO:
        return 'ℹ️';
    }
  }

  /**
   * Create error from validation result
   * 
   * @param errors - Array of error messages
   * @param context - Error context
   * @returns Structured error
   */
  static fromValidation(errors: string[], context?: ErrorContext): StructuredError {
    const message = errors.join('; ');
    return this.handle(new Error(message), context, {
      severity: ErrorSeverity.ERROR,
      showToast: false
    });
  }
}

/**
 * Type guard to check if value is an Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Type guard to check if value is a StructuredError
 */
export function isStructuredError(value: unknown): value is StructuredError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    'severity' in value &&
    'timestamp' in value
  );
}
