/**
 * Extract the ID from a Payload relationship value, which may be either a
 * populated document or a bare ID string depending on query depth.
 * Single home for the `typeof x === 'object' ? x.id : x` idiom.
 */
export function relationshipId(value: { id: string } | string): string {
  return typeof value === 'object' ? value.id : value
}
