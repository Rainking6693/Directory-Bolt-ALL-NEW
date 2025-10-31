import type { NextApiRequest, NextApiResponse } from 'next';

const GENERIC_MESSAGES = {
  authentication: 'Authentication failed. Please check your credentials.',
  authorization: 'Access denied. You do not have permission to perform this action.',
  validation: 'Invalid input data. Please review the request payload.',
  database: 'A database error occurred. Please try again later.',
  network: 'A network error occurred. Please retry in a moment.',
  server: 'An internal server error occurred. Please try again later.',
  notFound: 'The requested resource was not found.',
  rateLimit: 'Too many requests. Please wait before trying again.',
  payment: 'Payment processing error. Please try again or contact support.',
  default: 'An unexpected error occurred. Please try again later.'
} as const;

type ErrorCategory = keyof typeof GENERIC_MESSAGES;

type Severity = 'low' | 'medium' | 'high' | 'critical';

interface ClassifiedError {
  category: ErrorCategory;
  severity: Severity;
  statusCode: number;
  shouldLog: boolean;
  shouldAlert: boolean;
}

export class SecureErrorHandler {
  constructor(
    private readonly requestId: string,
    private readonly userId?: string,
    private readonly endpoint: string = 'unknown'
  ) {}

  handle(error: unknown): { statusCode: number; body: Record<string, unknown>; log: boolean; alert: boolean } {
    const classification = this.classify(error);
    const sanitizedMessage = this.sanitizeMessage(error);

    const body: Record<string, unknown> = {
      error: true,
      message: process.env.NODE_ENV !== 'production' ? sanitizedMessage : GENERIC_MESSAGES[classification.category],
      code: this.deriveErrorCode(error, classification),
      timestamp: new Date().toISOString(),
      requestId: this.requestId
    };

    if (process.env.NODE_ENV !== 'production') {
      body.debug = {
        originalMessage: (error as Error)?.message,
        stack: (error as Error)?.stack?.split('\n').slice(0, 5),
        category: classification.category,
        severity: classification.severity
      };
    }

    return {
      statusCode: classification.statusCode,
      body,
      log: classification.shouldLog,
      alert: classification.shouldAlert
    };
  }

  private classify(error: unknown): ClassifiedError {
    const err = (error ?? {}) as { message?: string; code?: string; name?: string };
    const message = (err.message || '').toLowerCase();
    const code = (err.code || '').toUpperCase();
    const name = (err.name || '').toLowerCase();

    if (message.includes('unauthorized') || message.includes('invalid token') || message.includes('authentication')) {
      return { category: 'authentication', severity: 'medium', statusCode: 401, shouldLog: true, shouldAlert: false };
    }

    if (message.includes('forbidden') || message.includes('access denied') || message.includes('permission')) {
      return { category: 'authorization', severity: 'medium', statusCode: 403, shouldLog: true, shouldAlert: false };
    }

    if (message.includes('validation') || message.includes('invalid') || name.includes('validation')) {
      return { category: 'validation', severity: 'low', statusCode: 400, shouldLog: false, shouldAlert: false };
    }

    if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ENOTFOUND') {
      return { category: 'network', severity: 'high', statusCode: 503, shouldLog: true, shouldAlert: code !== 'ETIMEDOUT' };
    }

    if (message.includes('rate limit') || message.includes('too many requests')) {
      return { category: 'rateLimit', severity: 'medium', statusCode: 429, shouldLog: false, shouldAlert: false };
    }

    if (message.includes('payment')) {
      return { category: 'payment', severity: 'medium', statusCode: 402, shouldLog: true, shouldAlert: false };
    }

    if (message.includes('not found') || code === 'ENOENT' || name === 'notfounderror') {
      return { category: 'notFound', severity: 'low', statusCode: 404, shouldLog: false, shouldAlert: false };
    }

    if (message.includes('database') || message.includes('sql') || code === '23505') {
      return { category: 'database', severity: 'high', statusCode: 500, shouldLog: true, shouldAlert: true };
    }

    return { category: 'server', severity: 'critical', statusCode: 500, shouldLog: true, shouldAlert: true };
  }

  private sanitizeMessage(error: unknown): string {
    const raw = (error as Error)?.message ?? 'Unknown error';
    const patterns: RegExp[] = [
      /sk_[a-z0-9_\-]+/gi,
      /pk_[a-z0-9_\-]+/gi,
      /Bearer\s+[A-Za-z0-9._\-]+/gi,
      /postgresql:\/\/[^\s]+/gi,
      /mysql:\/\/[^\s]+/gi,
      /mongodb:\/\/[^\s]+/gi,
      /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gi,
      /[A-Za-z]:\\\\[^\s]+/gi,
      /\/[A-Za-z0-9_\-]+\/[A-Za-z0-9_\-]+\/[A-Za-z0-9_\-\.]+/gi
    ];

    return patterns.reduce((msg, pattern) => msg.replace(pattern, '[redacted]'), raw);
  }

  private deriveErrorCode(error: unknown, classification: ClassifiedError): string {
    const base = classification.category.toUpperCase();
    const code = (error as { code?: string })?.code;
    return code ? `${base}_${code}` : `${base}_ERROR`;
  }
}

export function withSecureErrorHandling(handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void) {
  return async function wrapped(req: NextApiRequest, res: NextApiResponse) {
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    const userId = (req as { user?: { id?: string } }).user?.id;

    try {
      await handler(req, res);
    } catch (error) {
      const secureHandler = new SecureErrorHandler(requestId, userId, req.url || 'unknown');
      const { statusCode, body, log, alert } = secureHandler.handle(error);

      if (log) {
        console.error('[error] secure handler captured error', {
          requestId,
          endpoint: req.url,
          userId,
          error: body,
          original: (error as Error)?.message
        });
      }

      if (alert) {
        // Place hook to alerting system (PagerDuty, etc.)
        console.warn('[alert] critical error detected', { requestId, endpoint: req.url, userId });
      }

      res.status(statusCode).json(body);
    }
  };
}
