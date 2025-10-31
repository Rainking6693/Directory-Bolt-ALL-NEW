import type { NonEmptyString } from './enhanced-types'

export { NonEmptyString }

export function makeNonEmptyString(value: string): NonEmptyString {
  if (typeof value !== 'string') {
    throw new Error('Expected a string value')
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new Error('Expected non-empty string')
  }

  return trimmed as NonEmptyString
}
