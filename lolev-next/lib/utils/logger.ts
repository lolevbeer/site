/**
 * Logging utility for the application
 * Provides consistent logging across the codebase with environment-aware behavior
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isClient = typeof window !== 'undefined';

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
   * Log warnings (always logged, sent to monitoring in production)
   */
  warn(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.warn(`[WARN] ${message}`, context || '');
    } else {
      // In production, send to error monitoring service
      this.sendToMonitoring('warn', message, context);
    }
  }

  /**
   * Log errors (always logged, sent to monitoring in production)
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
      // In production, send to error monitoring service
      this.sendToMonitoring('error', message, { ...errorInfo, ...context });
    }
  }

  /**
   * Send logs to monitoring service in production
   */
  private sendToMonitoring(level: LogLevel, message: string, context?: LogContext): void {
    // TODO: Integrate with Sentry or other monitoring service
    // For now, only log errors to console in production (warnings and errors only)
    if (level === 'error' || level === 'warn') {
      console[level](`[${level.toUpperCase()}] ${message}`, context || '');
    }
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
