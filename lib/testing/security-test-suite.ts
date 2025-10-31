export interface SecurityTestResult {
  testName: string;
  endpoint: string;
  passed: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  details?: Record<string, unknown>;
  recommendation?: string;
}

export interface SecurityTestSuiteSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  results: SecurityTestResult[];
  summary: string;
}

export const SECURITY_TEST_CONFIG = {
  testEndpoints: [
    '/api/auth/login',
    '/api/auth/refresh-token',
    '/api/staff/login',
    '/api/payments/create-checkout',
    '/api/stripe/create-checkout-session',
    '/api/stripe/webhook',
    '/api/payments/webhook'
  ],
  attackPatterns: {
    sqlInjection: ["' OR '1'='1", "' UNION SELECT * FROM users --"],
    xss: ["<script>alert('XSS')</script>", "<img src=x onerror=alert('xss')>"],
    pathTraversal: ['../../../../etc/passwd', '..\\..\\..\\windows\\system32\\config\\sam'],
    commandInjection: ['; ls -la', '&& whoami']
  },
  corsTestOrigins: ['https://malicious-site.com', 'http://evil.example.com', 'null', '*'],
  rateLimitTests: {
    maxRequests: 150,
    timeWindow: 60000,
    endpoints: ['/api/auth/login', '/api/auth/refresh-token']
  }
} as const;

export class SecurityTester {
  constructor(private readonly baseUrl: string = 'http://localhost:3000') {}

  async runSecurityTests(): Promise<SecurityTestSuiteSummary> {
    // At the moment we only perform static analysis; dynamic tests can be added later.
    const results: SecurityTestResult[] = [];

    results.push({
      testName: 'Static configuration review',
      endpoint: 'N/A',
      passed: false,
      severity: 'high',
      description: 'Dynamic security tests not yet implemented. Implement active checks before relying on this suite.',
      recommendation: 'Implement HTTP client mocks and live checks for CORS, auth, and rate limiting.'
    });

    const criticalIssues = results.filter((r) => !r.passed && r.severity === 'critical').length;
    const highIssues = results.filter((r) => !r.passed && r.severity === 'high').length;
    const mediumIssues = results.filter((r) => !r.passed && r.severity === 'medium').length;
    const lowIssues = results.filter((r) => !r.passed && r.severity === 'low').length;

    return {
      totalTests: results.length,
      passedTests: results.filter((r) => r.passed).length,
      failedTests: results.filter((r) => !r.passed).length,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      results,
      summary: 'Security test harness initialised but dynamic checks are pending implementation.'
    };
  }
}
