/** Test-only field lookup through Payload rows, groups, collapsibles and tabs. */
import type { Field } from 'payload'

export function findPayloadField(fields: Field[], name: string): Field | undefined {
  for (const field of fields) {
    if ('name' in field && field.name === name) return field
    const nested = 'fields' in field ? findPayloadField(field.fields, name) : undefined
    if (nested) return nested
    if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        const found = findPayloadField(tab.fields, name)
        if (found) return found
      }
    }
  }
}
