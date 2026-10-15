/**
 * Test-only field lookup. Payload's `flattenAllFields` drops layout containers
 * (rows, collapsibles, unnamed tabs); this then searches nested named groups and
 * tabs too, returning the first field with a matching name.
 */
import type { Field, FlattenedField } from 'payload'
// From payload/shared, not payload: several specs replace the whole 'payload' module with a mock.
import { flattenAllFields } from 'payload/shared'

function find(fields: FlattenedField[], name: string): FlattenedField | undefined {
  for (const field of fields) {
    if (field.name === name) return field
    const nested = 'flattenedFields' in field ? find(field.flattenedFields, name) : undefined
    if (nested) return nested
  }
}

export function findPayloadField(fields: Field[], name: string): Field | undefined {
  return find(flattenAllFields({ fields }), name) as Field | undefined
}
