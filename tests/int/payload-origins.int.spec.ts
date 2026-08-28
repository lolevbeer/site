import { describe, expect, it } from 'vitest'
import { getLocalDevOrigins } from '@/lib/config/payload-origins'

describe('getLocalDevOrigins', () => {
  it('trusts the port selected by the Next.js development server', () => {
    expect(getLocalDevOrigins('3010')).toEqual(
      expect.arrayContaining([
        'http://localhost:3010',
        'http://127.0.0.1:3010',
        'http://0.0.0.0:3010',
      ]),
    )
  })

  it('does not add malformed or out-of-range ports to the allowlist', () => {
    const defaultOrigins = getLocalDevOrigins(undefined)

    expect(getLocalDevOrigins('3010.example.com')).toEqual(defaultOrigins)
    expect(getLocalDevOrigins('65536')).toEqual(defaultOrigins)
  })
})
