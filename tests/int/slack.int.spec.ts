/**
 * Unit tests for the Slack bot helpers (src/utils/slack.ts):
 * request-signature verification and modal-state → menu-items rebuilding.
 */

import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import {
  verifySlackSignature,
  rebuildMenuItems,
  parseProductValue,
  type MenuItem,
  type SlackStateValues,
} from '@/src/utils/slack'

const SECRET = 'test-signing-secret'

function sign(timestamp: string, rawBody: string): string {
  return `v0=${crypto.createHmac('sha256', SECRET).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`
}

describe('verifySlackSignature', () => {
  const now = 1_700_000_000
  const ts = String(now)
  const body = 'command=%2Flolevbeer&text=menu'

  it('accepts a valid signature', () => {
    expect(
      verifySlackSignature({
        signingSecret: SECRET,
        timestamp: ts,
        signature: sign(ts, body),
        rawBody: body,
        now,
      }),
    ).toBe(true)
  })

  it('rejects a tampered body', () => {
    expect(
      verifySlackSignature({
        signingSecret: SECRET,
        timestamp: ts,
        signature: sign(ts, body),
        rawBody: body + '&evil=1',
        now,
      }),
    ).toBe(false)
  })

  it('rejects a stale timestamp (replay)', () => {
    const staleTs = String(now - 600)
    expect(
      verifySlackSignature({
        signingSecret: SECRET,
        timestamp: staleTs,
        signature: sign(staleTs, body),
        rawBody: body,
        now,
      }),
    ).toBe(false)
  })

  it('rejects missing headers', () => {
    expect(
      verifySlackSignature({
        signingSecret: SECRET,
        timestamp: null,
        signature: null,
        rawBody: body,
        now,
      }),
    ).toBe(false)
  })
})

describe('parseProductValue', () => {
  it('round-trips beers and products values', () => {
    expect(parseProductValue('beers|abc123')).toEqual({ relationTo: 'beers', value: 'abc123' })
    expect(parseProductValue('products|xyz')).toEqual({ relationTo: 'products', value: 'xyz' })
  })

  it('rejects malformed values', () => {
    expect(parseProductValue('users|abc')).toBeNull()
    expect(parseProductValue('beers|')).toBeNull()
    expect(parseProductValue(undefined)).toBeNull()
  })
})

describe('rebuildMenuItems', () => {
  const items: MenuItem[] = [
    { product: { relationTo: 'beers', value: 'beer-a' }, price: '5', id: 'row1' },
    { product: { relationTo: 'beers', value: 'beer-b' }, id: 'row2' },
  ]

  const opt = (value: string) => ({ text: { type: 'plain_text' as const, text: 'x' }, value })

  it('keeps items untouched when nothing changed (initial options resubmitted)', () => {
    const state: SlackStateValues = {
      item_row1: { product: { type: 'external_select', selected_option: opt('beers|beer-a') } },
      item_row2: { product: { type: 'external_select', selected_option: opt('beers|beer-b') } },
    }
    expect(rebuildMenuItems(items, state)).toEqual(items)
  })

  it('swaps a product in place and drops its stale price override', () => {
    const state: SlackStateValues = {
      item_row1: { product: { type: 'external_select', selected_option: opt('beers|beer-c') } },
    }
    const result = rebuildMenuItems(items, state)
    expect(result[0]).toEqual({ product: { relationTo: 'beers', value: 'beer-c' } })
    expect(result[1]).toEqual(items[1])
  })

  it('removes items by row id and appends additions', () => {
    const state: SlackStateValues = {
      remove: { remove_items: { type: 'multi_static_select', selected_options: [opt('row1')] } },
      add: {
        add_products: {
          type: 'multi_external_select',
          selected_options: [opt('products|prod-z')],
        },
      },
    }
    const result = rebuildMenuItems(items, state)
    expect(result).toEqual([items[1], { product: { relationTo: 'products', value: 'prod-z' } }])
  })

  it('ignores stale state whose row ids no longer exist (resubmit/concurrent edit)', () => {
    // Modal was built when row0 existed; the menu has since changed to `items`
    // (row0 already removed). Resubmitting the same state must be a no-op —
    // not remove whatever now sits at that position.
    const state: SlackStateValues = {
      remove: { remove_items: { type: 'multi_static_select', selected_options: [opt('row0')] } },
      item_row0: { product: { type: 'external_select', selected_option: opt('beers|beer-x') } },
      item_row1: { product: { type: 'external_select', selected_option: opt('beers|beer-a') } },
      item_row2: { product: { type: 'external_select', selected_option: opt('beers|beer-b') } },
    }
    expect(rebuildMenuItems(items, state)).toEqual(items)
  })

  it('falls back to an index key for rows without an id', () => {
    const noIds = [{ product: { relationTo: 'beers', value: 'beer-a' } }] as MenuItem[]
    const state: SlackStateValues = {
      item_i0: { product: { type: 'external_select', selected_option: opt('beers|beer-c') } },
    }
    expect(rebuildMenuItems(noIds, state)).toEqual([
      { product: { relationTo: 'beers', value: 'beer-c' } },
    ])
  })

  it('preserves items (and price) when a populated product doc is unchanged', () => {
    const populated = [
      {
        product: { relationTo: 'beers', value: { id: 'beer-a', name: 'Lupula' } },
        price: '6',
        id: 'row9',
      },
    ] as unknown as MenuItem[]
    const state: SlackStateValues = {
      item_row9: { product: { type: 'external_select', selected_option: opt('beers|beer-a') } },
    }
    expect(rebuildMenuItems(populated, state)).toEqual(populated)
  })
})
