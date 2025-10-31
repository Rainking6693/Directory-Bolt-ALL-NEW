// Lightweight server utilities for runtime environments (Netlify / Next.js)
import { IncomingMessage } from 'http'

// Read raw body into Buffer (works in Next.js API routes)
export async function buffer(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    req.on('data', (chunk: Uint8Array) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', (err) => reject(err))
  })
}

// Mask sensitive values for debug endpoints
export function maskValue(val: string | undefined): string | undefined {
  if (!val) return undefined
  if (val.length <= 6) return '****'
  return `${val.slice(0, 3)}***${val.slice(-3)}`
}

// Backwards-compatible alias used across the codebase
export const getRawBody = buffer

const serverUtils = {
  buffer,
  maskValue
}

export default serverUtils
