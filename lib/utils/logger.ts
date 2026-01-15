/**
 * Simple Logger Utility
 * 
 * Lightweight logger for server-side use
 */

export const logger = {
  info: (msg: string, meta?: any) => {
    if (meta) {
      console.log(`[INFO] ${msg}`, meta)
    } else {
      console.log(`[INFO] ${msg}`)
    }
  },
  
  error: (msg: string, meta?: any, error?: Error) => {
    if (error) {
      console.error(`[ERROR] ${msg}`, meta || '', error)
    } else if (meta) {
      console.error(`[ERROR] ${msg}`, meta)
    } else {
      console.error(`[ERROR] ${msg}`)
    }
  },
  
  warn: (msg: string, meta?: any) => {
    if (meta) {
      console.warn(`[WARN] ${msg}`, meta)
    } else {
      console.warn(`[WARN] ${msg}`)
    }
  },
  
  debug: (msg: string, meta?: any) => {
    if (process.env.NODE_ENV !== 'production') {
      if (meta) {
        console.debug(`[DEBUG] ${msg}`, meta)
      } else {
        console.debug(`[DEBUG] ${msg}`)
      }
    }
  }
}
