// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';

const ALWAYS_REMOVE = [
  'password',
  'password_hash',
  'passwordhash',
  'secret',
  'privatekey',
  'private_key',
  'token',
  'refreshtoken',
  'refresh_token',
  'salt',
  'verification_token',
  'verificationtoken'
];

const MASKABLE_FIELDS = ['email', 'phone', 'address', 'ipaddress', 'ip_address', 'useragent', 'user_agent'];

const ROLE_RESTRICTIONS: Record<string, string[]> = {
  admin: [],
  manager: ['password_hash', 'token', 'secret', 'privateKey'],
  support: ['password_hash', 'token', 'secret', 'privateKey', 'ssn', 'creditCard'],
  customer: ['password_hash', 'token', 'secret', 'privateKey', 'ssn', 'creditCard', 'internalId', 'systemId']
};

function maskEmail(value: string): string {
  const [local, domain] = value.split('@');
  if (!domain) return '***@***';
  if (local.length <= 2) return `${local[0] ?? '*'}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length >= 4) {
    return `***-***-${digits.slice(-4)}`;
  }
  return '***-***-****';
}

function maskAddress(value: string): string {
  const parts = value.split(' ');
  if (parts.length <= 2) {
    return '*** ***';
  }
  return `${parts[0]} *** ${parts[parts.length - 1]}`;
}

function maskIp(value: string): string {
  const parts = value.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.***`;
  }
  return '***.***.***.***';
}

function maskDefault(value: string): string {
  if (value.length <= 4) return '***';
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function maskValue(fieldName: string, raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  const lower = fieldName.toLowerCase();
  if (lower.includes('email')) return maskEmail(raw);
  if (lower.includes('phone')) return maskPhone(raw);
  if (lower.includes('address')) return maskAddress(raw);
  if (lower.includes('ip')) return maskIp(raw);
  return maskDefault(raw);
}

export class PIISanitizer {
  constructor(private userRole: string = 'customer', private userType: 'customer' | 'staff' | 'admin' = 'customer', private requestingUserId?: string) {}

  sanitizeData<T>(data: T, targetUserId?: string): T {
    if (data === null || data === undefined) return data;

    const isOwnData = targetUserId && this.requestingUserId && this.requestingUserId === targetUserId;

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item, targetUserId)) as unknown as T;
    }

    if (typeof data === 'object') {
      return this.sanitizeObject(data as Record<string, unknown>, isOwnData) as unknown as T;
    }

    return data;
  }

  private sanitizeObject(obj: Record<string, unknown>, isOwnData: boolean): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    const restricted = ROLE_RESTRICTIONS[this.userRole] ?? ROLE_RESTRICTIONS.customer;

    for (const [key, value] of Object.entries(obj)) {
      const lower = key.toLowerCase();

      if (ALWAYS_REMOVE.some((field) => lower.includes(field))) {
        continue;
      }

      if (!isOwnData && restricted.some((field) => lower.includes(field.toLowerCase()))) {
        continue;
      }

      if (MASKABLE_FIELDS.some((field) => lower.includes(field))) {
        sanitized[key] = maskValue(key, value);
        continue;
      }

      if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeData(value, isOwnData ? this.requestingUserId : undefined);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

export function sanitizePII(
  data: unknown,
  userRole: string = 'customer',
  userType: 'customer' | 'staff' | 'admin' = 'customer',
  requestingUserId?: string,
  targetUserId?: string
): unknown {
  const sanitizer = new PIISanitizer(userRole, userType, requestingUserId);
  return sanitizer.sanitizeData(data, targetUserId);
}

export function withPIISanitization(options: {
  userRole?: string;
  userType?: 'customer' | 'staff' | 'admin';
  requestingUserId?: string;
  targetUserId?: string;
  logSanitization?: boolean;
} = {}) {
  const { userRole = 'customer', userType = 'customer', requestingUserId, targetUserId, logSanitization = false } = options;

  return function middleware(
    handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void
  ) {
    return async function wrapped(req: NextApiRequest, res: NextApiResponse) {
      const originalJson = res.json.bind(res);

      res.json = (payload: unknown) => {
        try {
          const sanitizer = new PIISanitizer(userRole, userType, requestingUserId);
          const sanitized = sanitizer.sanitizeData(payload, targetUserId);

          if (logSanitization && sanitized && typeof sanitized === 'object') {
            console.log('[pii] response sanitized', {
              endpoint: req.url,
              role: userRole,
              userType,
              requestingUserId,
              targetUserId
            });
          }

          return originalJson(sanitized);
        } catch (error) {
          console.error('[pii] sanitization failed', error);
          return originalJson(payload);
        }
      };

      return handler(req, res);
    };
  };
}
