/**
 * isDraftOnlySave: Save Draft and autosave (`?draft=true`, status stays draft)
 * change nothing public or kiosk-visible. Publish and Unpublish must still count
 * as real changes, so the hooks keep firing for them.
 */
import { describe, expect, it } from 'vitest'
import type { PayloadRequest } from 'payload'

import { isDraftOnlySave } from '@/src/utils/draft-save'

const req = (query: Record<string, unknown>) => ({ query }) as unknown as PayloadRequest

describe('isDraftOnlySave', () => {
  it('is true for a draft-status save sent with draft=true (boolean or string)', () => {
    expect(isDraftOnlySave({ _status: 'draft' }, req({ draft: true }))).toBe(true)
    expect(isDraftOnlySave({ _status: 'draft' }, req({ draft: 'true' }))).toBe(true)
  })

  it('is false for a publish, even when draft=true is on the request', () => {
    expect(isDraftOnlySave({ _status: 'published' }, req({ draft: 'true' }))).toBe(false)
  })

  it('is false for an unpublish, which sends _status draft without draft=true', () => {
    expect(isDraftOnlySave({ _status: 'draft' }, req({}))).toBe(false)
  })

  it('is false for collections without drafts (no _status) and for a missing req', () => {
    expect(isDraftOnlySave({}, req({ draft: 'true' }))).toBe(false)
    expect(isDraftOnlySave({ _status: 'draft' }, undefined)).toBe(false)
  })
})
