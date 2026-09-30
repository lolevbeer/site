/**
 * Detect saves that only wrote a draft version.
 *
 * Save Draft and autosave send `?draft=true` and leave `_status` at 'draft', so
 * nothing public or kiosk-visible changed and cache invalidation can be skipped.
 * Publish (`_status: 'published'`) and Unpublish (`_status: 'draft'` without
 * `draft=true`) are real changes and must still run. A Local API `draft: true`
 * write leaves no trace on `req`, so it counts as a real change (the safe side).
 */

import type { PayloadRequest } from 'payload'

export function isDraftOnlySave(doc: { _status?: unknown }, req?: PayloadRequest): boolean {
  const draft = req?.query?.draft
  return doc._status === 'draft' && (draft === true || draft === 'true')
}
