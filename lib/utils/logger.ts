/**
 * Logging utility for the application
 * Provides consistent logging across the codebase with environment-aware behavior.
 * In production, errors and warnings are forwarded to Sentry.
 */

import * as Sentry from '@sentry/nextjs';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  /**
   * Log debug information (only in development)
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.debug(`[DEBUG] ${message}`, context || '');
    }
  }

  /**
   * Log informational messages (only in development)
   */
  info(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.log(`[INFO] ${message}`, context || '');
    }
  }

  /**
   * Log warnings (always logged, sent to Sentry in production)
   */
  warn(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.warn(`[WARN] ${message}`, context || '');
    } else {
      this.sendToMonitoring('warn', message, context);
    }
  }

  /**
   * Log errors (always logged, sent to Sentry in production)
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorInfo = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : { error };

    if (this.isDevelopment) {
      console.error(`[ERROR] ${message}`, { ...errorInfo, ...context });
    } else {
      this.sendToMonitoring('error', message, { ...errorInfo, ...context });
    }
  }

  /**
   * Send logs to Sentry in production
   */
  private sendToMonitoring(level: 'warn' | 'error', message: string, context?: LogContext): void {
    if (level === 'error') {
      const errorObj = context?.error instanceof Error
        ? context.error
        : new Error(message);

      Sentry.captureException(errorObj, {
        extra: context,
        tags: { logLevel: level },
      });
    } else {
      Sentry.captureMessage(message, {
        level: 'warning',
        extra: context,
      });
    }

    // Also log to console for server log aggregation
    console[level](`[${level.toUpperCase()}] ${message}`, context || '');
  }

  /**
   * Log data loading operations
   */
  data(operation: string, details?: LogContext): void {
    this.debug(`Data: ${operation}`, details);
  }

  /**
   * Log API calls
   */
  api(method: string, url: string, status?: number, duration?: number): void {
    const message = `API ${method} ${url}`;
    const context = { status, duration };

    if (status && status >= 400) {
      this.error(message, undefined, context);
    } else {
      this.debug(message, context);
    }
  }

  /**
   * Log performance metrics
   */
  perf(operation: string, duration: number, context?: LogContext): void {
    this.debug(`Performance: ${operation} took ${duration}ms`, context);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export default for convenience
export default logger;
