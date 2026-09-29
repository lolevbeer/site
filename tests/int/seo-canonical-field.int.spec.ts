/** The canonical override must be a clean same-site path: it feeds alternates.canonical and the sitemap filter. */
import { describe, expect, it } from 'vitest'
import type { GroupField, TextField } from 'payload'
import { documentSeoField } from '@/src/fields/seo'

const canonical = (documentSeoField as GroupField).fields.find(
  (field) => 'name' in field && field.name === 'canonicalPath',
) as TextField
const validate = canonical.validate as (value: string | null | undefined) => true | string

describe('canonicalPath validation', () => {
  it.each(['', null, undefined, '  ', '/', '/beer', '/beer/lupula'])('accepts %j', (value) => {
    expect(validate(value)).toBe(true)
  })

  it.each([
    'beer/lupula',
    'https://lolev.beer/beer',
    '//evil.example',
    '/beer/',
    '/a b',
    '/beer?x=1',
    '/beer#top',
  ])('rejects %j', (value) => {
    expect(validate(value)).toEqual(expect.any(String))
  })
})
