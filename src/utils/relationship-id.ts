/**
 * Extract the ID from a Payload relationship value, which may be either a
 * populated document or a bare ID string depending on query depth.
 * Single home for the `typeof x === 'object' ? x.id : x` idiom.
 */
export function relationshipId(value: { id: string } | string): string {
  return typeof value === 'object' ? value.id : value
}

/**
 * Normalize a `hasMany` relationship value to a list of id strings.
 *
 * Returns `null` for a value that is neither absent nor an array. Payload's
 * relationship validator accepts a bare scalar (`Array.isArray(value) ? value
 * : [value]`) and the Mongo adapter casts it onto the array path, so
 * `locations: '<id>'` reaches the database as `['<id>']`. Callers that scope
 * access by these ids must reject that shape rather than read it as "nothing
 * set", which would skip the check entirely.
 */
export function relationshipIds(value: unknown): string[] | null {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) return null
  return value
    .map((entry) =>
      typeof entry === 'object' && entry !== null
        ? String((entry as { id?: string | number }).id ?? '')
        : String(entry ?? ''),
    )
    .filter(Boolean)
}
