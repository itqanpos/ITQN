type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  userId?: string;
  companyId?: string;
  requestId?: string;
}

class Logger {
  private static instance: Logger;
  private isDevelopment: boolean;

  private constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatLog(entry: LogEntry): string {
    const base = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    const context = entry.userId ? ` [User: ${entry.userId}]` : '';
    const company = entry.companyId ? ` [Company: ${entry.companyId}]` : '';
    return `${base}${context}${company} ${entry.message}`;
  }

  private log(level: LogLevel, message: string, data?: any, context?: { userId?: string; companyId?: string; requestId?: string }) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      ...context
    };

    const formattedMessage = this.formatLog(entry);

    switch (level) {
      case 'debug':
        if (this.isDevelopment) {
          console.debug(formattedMessage, data || '');
        }
        break;
      case 'info':
        console.info(formattedMessage, data || '');
        break;
      case 'warn':
        console.warn(formattedMessage, data || '');
        break;
      case 'error':
        console.error(formattedMessage, data || '');
        break;
    }

    // In production, you might want to send logs to a service like Cloud Logging
    if (!this.isDevelopment) {
      // TODO: Send to Cloud Logging or other log aggregation service
    }
  }

  debug(message: string, data?: any, context?: { userId?: string; companyId?: string; requestId?: string }) {
    this.log('debug', message, data, context);
  }

  info(message: string, data?: any, context?: { userId?: string; companyId?: string; requestId?: string }) {
    this.log('info', message, data, context);
  }

  warn(message: string, data?: any, context?: { userId?: string; companyId?: string; requestId?: string }) {
    this.log('warn', message, data, context);
  }

  error(message: string, data?: any, context?: { userId?: string; companyId?: string; requestId?: string }) {
    this.log('error', message, data, context);
  }

  // Request logging
  logRequest(req: any, context?: { userId?: string; companyId?: string }) {
    this.info(`${req.method} ${req.path}`, {
      query: req.query,
      params: req.params,
      body: this.sanitizeBody(req.body)
    }, context);
  }

  // Response logging
  logResponse(req: any, res: any, duration: number, context?: { userId?: string; companyId?: string }) {
    this.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`, {
      statusCode: res.statusCode
    }, context);
  }

  // Error logging
  logError(error: Error, req?: any, context?: { userId?: string; companyId?: string }) {
    this.error(error.message, {
      stack: error.stack,
      path: req?.path,
      method: req?.method
    }, context);
  }

  // Sanitize sensitive data from body
  private sanitizeBody(body: any): any {
    if (!body) return body;
    
    const sensitiveFields = ['password', 'token', 'creditCard', 'cvv', 'pin'];
    const sanitized = { ...body };

    sensitiveFields.forEach(field => {
      if (field in sanitized) {
        sanitized[field] = '***';
      }
    });

    return sanitized;
  }
}

export const logger = Logger.getInstance();
