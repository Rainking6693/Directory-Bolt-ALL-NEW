import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateAdminRequest } from '../../../lib/auth/guards';
import fs from 'fs';
import path from 'path';

interface ConfigStatus {
  name: string;
  status: 'ok' | 'missing' | 'error';
  message: string;
}

function checkEnvironmentVariable(name: string): ConfigStatus {
  const value = process.env[name];
  if (!value) {
    return {
      name,
      status: 'missing',
      message: `Environment variable ${name} is not set`
    };
  }
  return {
    name,
    status: 'ok',
    message: `Environment variable ${name} is configured`
  };
}

function checkFileExists(filePath: string, description: string): ConfigStatus {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (fs.existsSync(fullPath)) {
      return {
        name: description,
        status: 'ok',
        message: `File exists: ${filePath}`
      };
    } else {
      return {
        name: description,
        status: 'missing',
        message: `File missing: ${filePath}`
      };
    }
  } catch (error) {
    return {
      name: description,
      status: 'error',
      message: `Error checking file: ${filePath}`
    };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ 
      ok: false, 
      code: 'METHOD_NOT_ALLOWED',
      message: 'Only GET requests are allowed'
    });
  }

  const auth = authenticateAdminRequest(req);

  if (!auth.ok) {
    const status = auth.reason === 'CONFIG' ? 500 : 401;
    return res.status(status).json({
      ok: false,
      code: auth.reason === 'CONFIG' ? 'CONFIG_ERROR' : 'UNAUTHORIZED',
      message: auth.message ?? 'Admin authentication required'
    });
  }

  try {
    const configChecks: ConfigStatus[] = [];

    // Check environment variables
    const envVars = [
      'GOOGLE_SHEET_ID',
      'STRIPE_SECRET_KEY',
      'OPENAI_API_KEY',
      'ADMIN_API_KEY',
      'STAFF_API_KEY',
      // Supabase (server + public)
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ];

    envVars.forEach(envVar => {
      configChecks.push(checkEnvironmentVariable(envVar));
    });

    // Check critical files
    configChecks.push(checkFileExists('config/directoryboltGoogleKey9.17.json', 'Google Service Account'));
    configChecks.push(checkFileExists('pages/api/extension/validate.ts', 'Extension Validation API'));
    configChecks.push(checkFileExists('pages/api/health/google-sheets.ts', 'Google Sheets Health Check'));

    // Calculate overall status
    const hasErrors = configChecks.some(check => check.status === 'error');
    const hasMissing = configChecks.some(check => check.status === 'missing');
    
    let overallStatus: 'healthy' | 'warning' | 'error';
    if (hasErrors) {
      overallStatus = 'error';
    } else if (hasMissing) {
      overallStatus = 'warning';
    } else {
      overallStatus = 'healthy';
    }

    return res.status(200).json({
      ok: true,
      overallStatus,
      timestamp: new Date().toISOString(),
      checks: configChecks,
      summary: {
        total: configChecks.length,
        ok: configChecks.filter(c => c.status === 'ok').length,
        missing: configChecks.filter(c => c.status === 'missing').length,
        error: configChecks.filter(c => c.status === 'error').length
      }
    });

  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    console.error('[admin.config-check] error', { name: err?.name, message: err?.message });
    
    return res.status(500).json({
      ok: false,
      code: 'SERVER_ERROR',
      message: 'Failed to check configuration'
    });
  }
}
