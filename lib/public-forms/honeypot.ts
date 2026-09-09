/**
 * Honeypot is filled when the value is a non-empty string, or any non-string
 * (arrays/objects from a crafted Server Action call).
 */
export function isHoneypotFilled(value: unknown): boolean {
  if (value == null || value === '') return false
  if (typeof value !== 'string') return true
  return value.trim().length > 0
}
