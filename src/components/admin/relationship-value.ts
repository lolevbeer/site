export type AdminRelationshipValue =
  | string
  | number
  | { id?: string | number; value?: string | number | { id?: string | number } }
  | null
  | undefined

export function getAdminRelationshipID(value: AdminRelationshipValue): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (!value || typeof value !== 'object') return null
  if (value.id !== undefined) return String(value.id)
  if (typeof value.value === 'string' || typeof value.value === 'number') return String(value.value)
  if (value.value && typeof value.value === 'object' && value.value.id !== undefined) {
    return String(value.value.id)
  }
  return null
}
