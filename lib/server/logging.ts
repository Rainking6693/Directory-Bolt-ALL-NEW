export type LogMetadata = Record<string, unknown> | undefined

function buildLogMessage(functionName: string, message: string): string {
  return `[${new Date().toISOString()}] [${functionName}] ${message}`
}

function logWithLevel(
  level: 'log' | 'warn' | 'error',
  functionName: string,
  message: string,
  meta?: LogMetadata
): void {
  const formatted = buildLogMessage(functionName, message)
  if (meta && Object.keys(meta).length > 0) {
    console[level](formatted, meta)
  } else {
    console[level](formatted)
  }
}

export function logInfo(functionName: string, message: string, meta?: LogMetadata): void {
  logWithLevel('log', functionName, message, meta)
}

export function logWarn(functionName: string, message: string, meta?: LogMetadata): void {
  logWithLevel('warn', functionName, message, meta)
}

export function logError(functionName: string, message: string, meta?: LogMetadata): void {
  logWithLevel('error', functionName, message, meta)
}

export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  }
  if (typeof error === 'object' && error) {
    return { ...error }
  }
  return { value: error }
}
