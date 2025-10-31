// Ambient overrides for logger to accept flexible metadata shapes used across the codebase.
declare interface LogMetadata {
  [key: string]: any
}

declare interface LoggerLike {
  info(message: string, data?: any): void
  warn(message: string, data?: any): void
  error(message: string, data?: any): void
  debug?(message: string, data?: any): void
}

declare const logger: LoggerLike
export { logger }

declare const log: LoggerLike
export { log }

export default logger
