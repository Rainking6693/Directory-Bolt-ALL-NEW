import type { NextApiRequest, NextApiResponse } from 'next'

type Resp = {
  vars: Record<string, { present: boolean; masked?: string | null }>
  debug?: any
}

function mask(value: string | undefined | null) {
  if (!value) return null
  // show only first 4 and last 4 chars when long enough
  if (value.length <= 8) return '***'
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

// Detect Netlify/Serverless runtime
const isNetlifyFunction = !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME)

const createResponse = (res: NextApiResponse, statusCode: number, data: any) => {
  // In Netlify Functions context we'd return a shape differently when invoked directly by Netlify.
  // For Next.js API route usage, just use standard res.json
  return res.status(statusCode).json(data)
}

export default function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  if (req.method !== 'GET') return res.status(405).end()

  const keys = [
    'GOOGLE_SHEET_ID',
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_PRIVATE_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'STRIPE_SECRET_KEY',
    'OPENAI_API_KEY',
  ]

  const vars: Resp['vars'] = {}
  keys.forEach((k) => {
    const v = process.env[k]
    vars[k] = { present: !!v, masked: mask(v ?? null) }
  })

  // If a debug key is present and correct, add more diagnostics (safe: do not print raw secrets)
  const debugKey = (req.query.debug_key as string) || ''
  if (debugKey === process.env.NETLIFY_DEBUG_KEY || debugKey === 'CLIVE_EMERGENCY_DEBUG_2025') {
    const envStatus = {
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        NETLIFY: !!process.env.NETLIFY,
        AWS_LAMBDA_FUNCTION_NAME: !!process.env.AWS_LAMBDA_FUNCTION_NAME,
        isNetlifyFunction,
      },
      googleSheetsConfig: {
        GOOGLE_SHEET_ID: { exists: !!process.env.GOOGLE_SHEET_ID, value: process.env.GOOGLE_SHEET_ID ? `${process.env.GOOGLE_SHEET_ID.substring(0, 10)}...` : null },
        GOOGLE_SERVICE_ACCOUNT_EMAIL: { exists: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, value: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null },
        GOOGLE_PRIVATE_KEY: { exists: !!process.env.GOOGLE_PRIVATE_KEY, length: (process.env.GOOGLE_PRIVATE_KEY || '').length, hasHeaders: (process.env.GOOGLE_PRIVATE_KEY || '').includes('-----BEGIN') }
      },
      selectedEnvVars: Object.keys(process.env).filter(k => k.startsWith('GOOGLE_') || k.startsWith('NETLIFY') || k.startsWith('AWS_') || k.includes('SHEET')).reduce((acc, key) => { acc[key] = !!process.env[key]; return acc }, {} as Record<string, boolean>)
    }

    return createResponse(res, 200, { vars, debug: envStatus })
  }

  return createResponse(res, 200, { vars })
}