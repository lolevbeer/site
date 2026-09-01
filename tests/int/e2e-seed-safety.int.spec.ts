/** Verifies that release-smoke seeding cannot target a non-disposable database. */
import { describe, expect, it } from 'vitest'
import { isDisposableDatabase } from '@/scripts/e2e-database-guard'

describe('isDisposableDatabase', () => {
  it('permits only local databases or explicitly marked remote e2e databases', () => {
    expect(isDisposableDatabase('mongodb://127.0.0.1:27017/test', undefined)).toBe(true)
    expect(isDisposableDatabase('mongodb://localhost:27017/test', undefined)).toBe(true)
    expect(isDisposableDatabase('mongodb+srv://cluster.example/release-ci', '1')).toBe(true)
    expect(isDisposableDatabase('mongodb+srv://cluster.example/test', '1')).toBe(false)
    expect(isDisposableDatabase('mongodb+srv://cluster.example/release-ci', undefined)).toBe(false)
    expect(isDisposableDatabase('not-a-url', '1')).toBe(false)
  })
})
