/**
 * Unit tests for the Slack bot helpers (src/utils/slack.ts): request-signature
 * verification, modal-state → menu-items rebuilding, private_metadata parsing,
 * and the Block Kit builders (edit modal, menu list, typeahead groups, the
 * publish/publishing/error views). All pure — no Payload boot.
 */

import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import {
  verifySlackSignature,
  rebuildMenuItems,
  parseProductValue,
  parseMenuMetadata,
  encodeMenuMetadata,
  buildEditModalView,
  buildMenuListMessage,
  buildProductOptionGroups,
  buildPublishedView,
  buildPublishingView,
  buildModalErrorView,
  SLACK_IDS,
  type MenuItem,
  type SlackStateValues,
} from '@/src/utils/slack'
import type { Menu } from '@/src/payload-types'

const SECRET = 'test-signing-secret'

function sign(timestamp: string, rawBody: string): string {
  return `v0=${crypto.createHmac('sha256', SECRET).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`
}

/** Minimal published Menu fixture; override only the fields a test asserts on. */
function makeMenu(overrides: Partial<Menu> = {}): Menu {
  return {
    id: 'menu1',
    name: 'Draft Menu',
    location: 'loc1',
    type: 'draft',
    url: 'lawrenceville-draft',
    items: [],
    updatedAt: '2026-07-18T00:00:00.000Z',
    createdAt: '2026-07-18T00:00:00.000Z',
    _status: 'published',
    ...overrides,
  }
}

/** Builders return Record<string, unknown>; loosen it for nested assertions. */
const loose = (v: Record<string, unknown>) => v as Record<string, any>

/** True if `s` contains a lone (unpaired) UTF-16 surrogate — an ill-formed string. */
const hasLoneSurrogate = (s: string) =>
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s)

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
      item_row1: { product: { selected_option: opt('beers|beer-a') } },
      item_row2: { product: { selected_option: opt('beers|beer-b') } },
    }
    expect(rebuildMenuItems(items, state)).toEqual(items)
  })

  it('swaps a product in place and drops its stale price override', () => {
    const state: SlackStateValues = {
      item_row1: { product: { selected_option: opt('beers|beer-c') } },
    }
    const result = rebuildMenuItems(items, state)
    expect(result[0]).toEqual({ product: { relationTo: 'beers', value: 'beer-c' } })
    expect(result[1]).toEqual(items[1])
  })

  it('removes items by row id and appends additions', () => {
    const state: SlackStateValues = {
      remove: { remove_items: { selected_options: [opt('row1')] } },
      add: {
        add_products: {
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
      remove: { remove_items: { selected_options: [opt('row0')] } },
      item_row0: { product: { selected_option: opt('beers|beer-x') } },
      item_row1: { product: { selected_option: opt('beers|beer-a') } },
      item_row2: { product: { selected_option: opt('beers|beer-b') } },
    }
    expect(rebuildMenuItems(items, state)).toEqual(items)
  })

  it('falls back to an index key for rows without an id', () => {
    const noIds = [{ product: { relationTo: 'beers', value: 'beer-a' } }] as MenuItem[]
    const state: SlackStateValues = {
      item_i0: { product: { selected_option: opt('beers|beer-c') } },
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
      item_row9: { product: { selected_option: opt('beers|beer-a') } },
    }
    expect(rebuildMenuItems(populated, state)).toEqual(populated)
  })

  it('dedupes a re-added product (first wins) while preserving empty-tap rows', () => {
    // A row already carrying beer-a, an empty tap (no product ref), then an add
    // that re-selects beer-a. The duplicate add collapses onto the existing row;
    // the empty tap has no ref so it survives untouched.
    const original: MenuItem[] = [
      { product: { relationTo: 'beers', value: 'beer-a' }, id: 'row1' },
      { id: 'empty1' } as MenuItem,
    ]
    const state: SlackStateValues = {
      add: { add_products: { selected_options: [opt('beers|beer-a')] } },
    }
    expect(rebuildMenuItems(original, state)).toEqual([
      { product: { relationTo: 'beers', value: 'beer-a' }, id: 'row1' },
      { id: 'empty1' },
    ])
  })
})

describe('parseMenuMetadata / encodeMenuMetadata', () => {
  it('round-trips <id>|<updatedAt>', () => {
    const menu = makeMenu({ id: 'menu42', updatedAt: '2026-07-18T12:00:00.000Z' })
    expect(parseMenuMetadata(encodeMenuMetadata(menu))).toEqual({
      menuId: 'menu42',
      updatedAt: '2026-07-18T12:00:00.000Z',
    })
  })

  it('tolerates a bare id from an older modal (updatedAt: null)', () => {
    expect(parseMenuMetadata('bare-id-only')).toEqual({ menuId: 'bare-id-only', updatedAt: null })
  })
})

describe('buildEditModalView', () => {
  const menu = makeMenu({
    id: 'menu1',
    updatedAt: '2026-07-18T09:00:00.000Z',
    items: [
      { product: { relationTo: 'beers', value: 'beer-a' }, id: 'row1' },
      { product: { relationTo: 'products', value: 'prod-b' }, id: 'row2' },
    ],
  })

  it('keys item blocks on item_<rowId> and encodes initial_option as relationTo|id', () => {
    const view = loose(buildEditModalView(menu))
    expect(view.blocks[0].block_id).toBe('item_row1')
    expect(view.blocks[0].element.action_id).toBe(SLACK_IDS.actionProduct)
    expect(view.blocks[0].element.initial_option.value).toBe('beers|beer-a')
    expect(view.blocks[1].block_id).toBe('item_row2')
    expect(view.blocks[1].element.initial_option.value).toBe('products|prod-b')
  })

  it('encodes private_metadata as <id>|<updatedAt>', () => {
    const view = loose(buildEditModalView(menu))
    expect(view.private_metadata).toBe('menu1|2026-07-18T09:00:00.000Z')
    expect(view.callback_id).toBe(SLACK_IDS.callbackMenuEdit)
  })

  it('includes the remove select only when the menu has items', () => {
    const withItems = loose(buildEditModalView(menu))
    const removeBlock = (withItems.blocks as Record<string, any>[]).find(
      (b) => b.block_id === SLACK_IDS.blockRemove,
    )
    expect(removeBlock).toBeDefined()
    expect(removeBlock!.element.options).toHaveLength(2)

    const empty = loose(buildEditModalView(makeMenu({ items: [] })))
    expect(
      (empty.blocks as Record<string, any>[]).some((b) => b.block_id === SLACK_IDS.blockRemove),
    ).toBe(false)
    // The add select is always present.
    expect(
      (empty.blocks as Record<string, any>[]).some((b) => b.block_id === SLACK_IDS.blockAdd),
    ).toBe(true)
  })
})

describe('buildMenuListMessage', () => {
  it('gives each menu an Edit button carrying its id', () => {
    const message = loose(buildMenuListMessage([makeMenu({ id: 'm1', items: [{ id: 'x' }] })]))
    expect(message.blocks[0].accessory.action_id).toBe(SLACK_IDS.actionEditMenu)
    expect(message.blocks[0].accessory.value).toBe('m1')
  })

  it('escapes &, <, > in the menu label', () => {
    const message = loose(buildMenuListMessage([makeMenu({ description: 'Hops & <Malt>' })]))
    expect(message.blocks[0].text.text).toContain('*Hops &amp; &lt;Malt&gt;*')
  })

  it('returns the empty-list shape when there are no menus', () => {
    expect(buildMenuListMessage([])).toEqual({
      response_type: 'ephemeral',
      text: 'No menus found.',
    })
  })
})

describe('buildProductOptionGroups', () => {
  it('groups beers and products into option_groups', () => {
    const result = loose(
      buildProductOptionGroups([{ id: 'b1', name: 'Lupula' }], [{ id: 'p1', name: 'Merch' }]),
    )
    expect(result.option_groups).toHaveLength(2)
    expect(result.option_groups[0].options[0].value).toBe('beers|b1')
    expect(result.option_groups[1].options[0].value).toBe('products|p1')
  })

  it('returns { options: [] } (not option_groups) when both are empty', () => {
    const result = buildProductOptionGroups([], [])
    expect(result).toEqual({ options: [] })
    expect(result).not.toHaveProperty('option_groups')
  })

  it('never splits a surrogate pair at the truncation boundary', () => {
    // The emoji straddles UTF-16 index 74 (max-1 for the 75-char cap): a naive
    // code-unit slice would emit a lone high surrogate. Array.from keeps it whole.
    const name = 'a'.repeat(73) + '😀' + 'b'.repeat(30)
    const result = loose(buildProductOptionGroups([{ id: 'b1', name }], []))
    const text = result.option_groups[0].options[0].text.text as string
    expect(hasLoneSurrogate(text)).toBe(false)
    expect(text).toContain('😀')
    expect(text.endsWith('…')).toBe(true)
  })
})

describe('publish / publishing / error views', () => {
  it('buildPublishedView reports the menu label and item count', () => {
    const view = loose(buildPublishedView(makeMenu({ description: 'Tap List' }), 3))
    expect(view.type).toBe('modal')
    expect(view.title.text).toBe('Published ✓')
    expect(view.blocks[0].text.text).toContain('*Tap List*')
    expect(view.blocks[0].text.text).toContain('3 items')
  })

  it('buildPublishingView is a modal titled Publishing…', () => {
    const view = loose(buildPublishingView('the menu'))
    expect(view.type).toBe('modal')
    expect(view.title.text).toBe('Publishing…')
    expect(view.blocks[0].text.text).toContain('the menu')
  })

  it('buildModalErrorView is a modal that escapes the message', () => {
    const view = loose(buildModalErrorView('Failed & <broke>'))
    expect(view.type).toBe('modal')
    expect(view.title.text).toBe('Publish failed')
    expect(view.blocks[0].text.text).toBe('Failed &amp; &lt;broke&gt;')
  })
})
