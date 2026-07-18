/**
 * Slack bot helpers for the /lolevbeer slash command.
 *
 * Pure functions only (signature verification, Block Kit builders, modal
 * state parsing) so they can be unit-tested without booting Payload. All
 * Slack HTTP handling lives in src/app/api/slack/route.ts.
 */

import crypto from 'crypto'
import type { Menu, Beer, Product } from '@/src/payload-types'

export type MenuItem = Menu['items'][number]

/** Slack Block Kit option object */
export interface SlackOption {
  text: { type: 'plain_text'; text: string }
  value: string
}

/** One element's submitted state inside view_submission's view.state.values */
export interface SlackStateValue {
  selected_option?: SlackOption | null
  selected_options?: SlackOption[] | null
}

export type SlackStateValues = Record<string, Record<string, SlackStateValue>>

const SIGNATURE_VERSION = 'v0'
const MAX_TIMESTAMP_SKEW_SECONDS = 60 * 5

/**
 * Verify Slack's request signature (HMAC-SHA256 over `v0:<ts>:<rawBody>`).
 * Rejects requests older than 5 minutes to prevent replay.
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackSignature(args: {
  signingSecret: string
  timestamp: string | null
  signature: string | null
  rawBody: string
  now?: number
}): boolean {
  const { signingSecret, timestamp, signature, rawBody } = args
  if (!timestamp || !signature) return false

  const ts = Number(timestamp)
  const now = args.now ?? Math.floor(Date.now() / 1000)
  if (!Number.isFinite(ts) || Math.abs(now - ts) > MAX_TIMESTAMP_SKEW_SECONDS) return false

  const expected = `${SIGNATURE_VERSION}=${crypto
    .createHmac('sha256', signingSecret)
    .update(`${SIGNATURE_VERSION}:${timestamp}:${rawBody}`)
    .digest('hex')}`

  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/** Slack limits: option text/value max 75 chars, modal title max 24. */
function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

/** Encode a menu item's polymorphic product relationship as an option value. */
export function encodeProductValue(relationTo: 'beers' | 'products', id: string): string {
  return `${relationTo}|${id}`
}

/** Decode an option value back into a Payload polymorphic relationship. */
export function parseProductValue(
  value: string | undefined | null,
): { relationTo: 'beers' | 'products'; value: string } | null {
  if (!value) return null
  const [relationTo, id] = value.split('|')
  if ((relationTo !== 'beers' && relationTo !== 'products') || !id) return null
  return { relationTo, value: id }
}

/** Absolute site origin for links posted into Slack. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lolev.beer'

/**
 * The item's polymorphic product as a plain {relationTo, id} ref, whether the
 * relationship is populated (object) or bare (id string). Single source for
 * this unwrap — modal building, state rebuilding, and typeahead exclusion all
 * key on it.
 */
export function productRef(
  item: MenuItem,
): { relationTo: 'beers' | 'products'; id: string } | null {
  const product = item.product
  if (!product?.value) return null
  return {
    relationTo: product.relationTo,
    id: typeof product.value === 'object' ? String(product.value.id) : product.value,
  }
}

/** Display name for a menu item's product (falls back for unpopulated docs). */
export function productName(item: MenuItem): string {
  const doc = item.product?.value
  if (doc && typeof doc === 'object') return doc.name
  return 'Unknown item'
}

/** Human label for a menu: description when set, else the required name. */
export function menuLabel(menu: Menu): string {
  return menu.description || menu.name
}

/** Ephemeral message listing all menus with an Edit button each. */
export function buildMenuListMessage(menus: Menu[]): Record<string, unknown> {
  if (menus.length === 0) {
    return { response_type: 'ephemeral', text: 'No menus found.' }
  }
  return {
    response_type: 'ephemeral',
    blocks: menus.map((menu) => ({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${menuLabel(menu)}*  ·  ${menu.items?.length ?? 0} items  ·  <${SITE_URL}/m/${menu.url}|view>`,
      },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: 'Edit' },
        action_id: 'edit_menu',
        value: String(menu.id),
      },
    })),
  }
}

/**
 * Stable key for a menu item row. Payload array rows carry a generated `id`;
 * blocks and remove-options are keyed on it (not the array index) so a stale
 * modal — resubmitted after a timeout, or open across a concurrent edit or
 * sheet sync — can never remove/swap the wrong row: unmatched keys are no-ops.
 */
export function itemKey(item: MenuItem, index: number): string {
  return item.id ?? `i${index}`
}

/**
 * Edit modal: one external_select per existing item (swap in place), one
 * multi_external_select to append beers, one multi_static_select to remove.
 * Static once opened — no views.update juggling. Submitting publishes.
 */
export function buildEditModalView(menu: Menu): Record<string, unknown> {
  // ponytail: Slack caps modals at 100 blocks / 100 options; tap lists are ~20.
  const items = (menu.items ?? []).slice(0, 90)

  const blocks: Record<string, unknown>[] = items.map((item, i) => {
    const ref = productRef(item)
    return {
      type: 'input',
      block_id: `item_${itemKey(item, i)}`,
      optional: true,
      label: { type: 'plain_text', text: `Item ${i + 1}` },
      element: {
        type: 'external_select',
        action_id: 'product',
        min_query_length: 2,
        placeholder: { type: 'plain_text', text: 'Search beers…' },
        ...(ref
          ? {
              initial_option: {
                text: { type: 'plain_text', text: truncate(productName(item), 75) },
                value: encodeProductValue(ref.relationTo, ref.id),
              },
            }
          : {}),
      },
    }
  })

  blocks.push({
    type: 'input',
    block_id: 'add',
    optional: true,
    label: { type: 'plain_text', text: 'Add beers' },
    element: {
      type: 'multi_external_select',
      action_id: 'add_products',
      min_query_length: 2,
      placeholder: { type: 'plain_text', text: 'Search beers to append…' },
    },
  })

  if (items.length > 0) {
    blocks.push({
      type: 'input',
      block_id: 'remove',
      optional: true,
      label: { type: 'plain_text', text: 'Remove items' },
      element: {
        type: 'multi_static_select',
        action_id: 'remove_items',
        placeholder: { type: 'plain_text', text: 'Pick items to remove…' },
        options: items.map((item, i) => ({
          text: { type: 'plain_text', text: truncate(`${i + 1}. ${productName(item)}`, 75) },
          value: itemKey(item, i),
        })),
      },
    })
  }

  return {
    type: 'modal',
    callback_id: 'menu_edit',
    private_metadata: String(menu.id),
    title: { type: 'plain_text', text: truncate(menuLabel(menu), 24) },
    submit: { type: 'plain_text', text: 'Publish' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks,
  }
}

/**
 * Rebuild a menu's items array from the submitted modal state.
 * - `item_<rowId>` selects swap products in place (price override is kept only
 *   when the product is unchanged — a sale price for beer A is wrong for B).
 * - `remove` drops items by row id.
 * - `add` appends new items at the end.
 * State entries whose row id no longer exists in `original` are ignored, so
 * stale submissions degrade to no-ops instead of touching the wrong row.
 */
export function rebuildMenuItems(original: MenuItem[], state: SlackStateValues): MenuItem[] {
  const removed = new Set((state.remove?.remove_items?.selected_options ?? []).map((o) => o.value))

  const next: MenuItem[] = []
  original.forEach((item, i) => {
    const key = itemKey(item, i)
    if (removed.has(key)) return
    const raw = state[`item_${key}`]?.product?.selected_option?.value
    const selected = parseProductValue(raw)
    if (!selected) {
      next.push(item)
      return
    }
    const ref = productRef(item)
    const unchanged = ref !== null && encodeProductValue(ref.relationTo, ref.id) === raw
    next.push(unchanged ? item : { product: selected })
  })

  for (const option of state.add?.add_products?.selected_options ?? []) {
    const parsed = parseProductValue(option.value)
    if (parsed) next.push({ product: parsed })
  }

  return next
}

/** Confirmation view swapped into the modal after a successful publish. */
export function buildPublishedView(menu: Menu, itemCount: number): Record<string, unknown> {
  return {
    type: 'modal',
    title: { type: 'plain_text', text: 'Published ✓' },
    close: { type: 'plain_text', text: 'Done' },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${menuLabel(menu)}* is live with ${itemCount} items. Displays refresh on their next poll — <${SITE_URL}/m/${menu.url}|view menu>.`,
        },
      },
    ],
  }
}

/** Typeahead option groups for beers and products matching a query. */
export function buildProductOptionGroups(
  beers: Pick<Beer, 'id' | 'name'>[],
  products: Pick<Product, 'id' | 'name'>[],
): Record<string, unknown> {
  const toOption = (relationTo: 'beers' | 'products', doc: { id: string; name: string }) => ({
    text: { type: 'plain_text', text: truncate(doc.name, 75) },
    value: encodeProductValue(relationTo, String(doc.id)),
  })
  const groups = []
  if (beers.length > 0) {
    groups.push({
      label: { type: 'plain_text', text: 'Beers' },
      options: beers.map((b) => toOption('beers', b)),
    })
  }
  if (products.length > 0) {
    groups.push({
      label: { type: 'plain_text', text: 'Products' },
      options: products.map((p) => toOption('products', p)),
    })
  }
  return { option_groups: groups }
}
