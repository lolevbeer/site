/**
 * Slack bot helpers for the /lolevbeer slash command: signature verification,
 * Block Kit builders, and modal-state parsing, so they can be unit-tested
 * without booting Payload. The only module-load side effect is reading
 * SITE_URL from the environment; every exported function is otherwise pure.
 * All Slack HTTP handling lives in src/app/api/slack/route.ts.
 */

import crypto from 'crypto'
import type { Menu, Beer, Product } from '@/src/payload-types'
import {
  extractBeerFromMenuItem,
  extractProductFromMenuItem,
  extractProductRefFromMenuItem,
} from '@/lib/utils/menu-item-utils'

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
  /** users_select */
  selected_user?: string | null
  /** plain_text_input */
  value?: string | null
}

export type SlackStateValues = Record<string, Record<string, SlackStateValue>>

/**
 * Shared Block Kit identifiers (callback_id, action_ids, block_ids, and the
 * per-item block_id prefix). Both this module's builders and the route handler
 * key on the same strings, so they live in one place to stay in lockstep.
 */
export const SLACK_IDS = {
  callbackMenuEdit: 'menu_edit',
  actionEditMenu: 'edit_menu',
  actionProduct: 'product',
  actionAddProducts: 'add_products',
  actionRemoveItems: 'remove_items',
  blockAdd: 'add',
  blockRemove: 'remove',
  itemBlockPrefix: 'item_',
  // Invite modal (/lolevbeer invite)
  callbackInvite: 'user_invite',
  blockInviteUser: 'invite_user',
  actionInviteUser: 'invite_user_pick',
  blockInviteName: 'invite_name',
  actionInviteName: 'invite_name_input',
  blockInviteRoles: 'invite_roles',
  actionInviteRoles: 'invite_roles_pick',
  blockInviteLocations: 'invite_locations',
  actionInviteLocations: 'invite_locations_pick',
} as const

/**
 * Roles offered in the invite modal — mirrors the Users collection's `roles`
 * options. Every role is listed on purpose: the Users beforeChange hook is the
 * authority on who may grant what (lead bartenders are capped at 'bartender'),
 * and letting Payload reject the submit surfaces its real message instead of
 * duplicating the rule here, where it could drift.
 */
export const INVITE_ROLES = [
  { label: 'Admin', value: 'admin' },
  { label: 'Event Manager', value: 'event-manager' },
  { label: 'Beer Manager', value: 'beer-manager' },
  { label: 'Food Manager', value: 'food-manager' },
  { label: 'Lead Bartender', value: 'lead-bartender' },
  { label: 'Bartender', value: 'bartender' },
] as const

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
  // Count by code points (Array.from) so a surrogate pair — emoji, etc. — is
  // never split down the middle into an invalid string.
  const chars = Array.from(text)
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join('')}…`
}

/**
 * Escape user text interpolated into an mrkdwn field. Slack's mrkdwn treats
 * `&`, `<`, `>` as control characters (entities, link syntax), so names and
 * labels must be escaped; plain_text fields are literal and need no escaping.
 * https://api.slack.com/reference/surfaces/formatting#escaping
 */
export function escapeSlackText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Encode a menu item's polymorphic product relationship as an option value. */
export function encodeProductValue(relationTo: 'beers' | 'products', id: string): string {
  return `${relationTo}|${id}`
}

/** Shared label for a menu slot with no beer — keeps productName and the clear option in sync. */
const EMPTY_TAP_LABEL = 'Empty tap'

/**
 * Sentinel option value meaning "keep this slot on the menu but with no beer".
 * Carries no `|`, so it can never collide with an encodeProductValue result;
 * parseProductValue rejects it outright and rebuildMenuItems then takes its
 * existing "the user cleared this row" branch, writing the empty tap the Menus
 * schema already supports.
 *
 * It exists because there was otherwise no way to blank a slot from Slack short
 * of removing the row, so staff searched `"  "` instead — that matches nothing,
 * and Slack renders the resulting empty option list as "There was a problem
 * loading options", which reads as the integration being broken.
 */
export const EMPTY_TAP_VALUE = 'empty-tap'

/** The option that clears a row, and the initial_option an already-clear row shows. */
const EMPTY_TAP_OPTION: SlackOption = Object.freeze({
  text: Object.freeze({ type: 'plain_text' as const, text: `${EMPTY_TAP_LABEL} — no beer on this line` }),
  value: EMPTY_TAP_VALUE,
})

/** Decode an option value back into a Payload polymorphic relationship. */
export function parseProductValue(
  value: string | undefined | null,
): { relationTo: 'beers' | 'products'; value: string } | null {
  if (!value) return null
  // Rejected on purpose rather than as a side effect of the allowlist below:
  // this is the contract EMPTY_TAP_VALUE relies on, so it should survive that
  // allowlist ever growing a third collection.
  if (value === EMPTY_TAP_VALUE) return null
  const [relationTo, id] = value.split('|')
  if ((relationTo !== 'beers' && relationTo !== 'products') || !id) return null
  return { relationTo, value: id }
}

/**
 * Absolute site origin for links posted into Slack. Same priority the frontend
 * layout uses (getBaseUrl): explicit > production domain > per-deployment URL.
 *
 * VERCEL_PROJECT_PRODUCTION_URL must come before VERCEL_URL. VERCEL_URL is the
 * deployment-specific hostname, which sits behind Vercel deployment protection —
 * a password-reset link minted against it hands the recipient an auth wall and
 * burns the one-time token.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://lolev.beer')

/**
 * The item's polymorphic product as a plain {relationTo, id} ref — delegates
 * to the shared menu-item unwrap so legacy `beer`-field items and future
 * schema changes are handled in one place (lib/utils/menu-item-utils).
 */
export function productRef(
  item: MenuItem,
): { relationTo: 'beers' | 'products'; id: string } | null {
  return extractProductRefFromMenuItem(item)
}

/**
 * Display name for a menu item's product. A row with no product is a supported
 * empty tap (see the Menus beforeValidate hook) → 'Empty tap'; a non-null but
 * unpopulated relationship (a bare id we couldn't hydrate) → 'Unknown item'.
 */
function productName(item: MenuItem): string {
  const doc = extractBeerFromMenuItem(item) ?? extractProductFromMenuItem(item)
  if (doc) return doc.name
  return productRef(item) ? 'Unknown item' : EMPTY_TAP_LABEL
}

/** Human label for a menu: description when set, else the required name. */
function menuLabel(menu: Menu): string {
  return menu.description || menu.name
}

/**
 * Invite modal: pick a Slack member, name them, choose roles and (optionally)
 * locations. The invitee is a Slack user picker rather than a typed email on
 * purpose — it bounds who can be invited to the workspace, sources a verified
 * address instead of a self-asserted one, and pre-links the new account.
 *
 * Offered locations are pre-selected: empty `locations` on a bartender is no
 * menu access, not all-menu access.
 */
export function buildInviteModalView(
  locations: { id: string; name: string }[],
): Record<string, unknown> {
  const locationOptions: SlackOption[] = locations.map((location) => ({
    text: { type: 'plain_text', text: location.name },
    value: String(location.id),
  }))
  return {
    type: 'modal',
    callback_id: SLACK_IDS.callbackInvite,
    title: { type: 'plain_text', text: 'Invite to admin' },
    submit: { type: 'plain_text', text: 'Send invite' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'input',
        block_id: SLACK_IDS.blockInviteUser,
        label: { type: 'plain_text', text: 'Slack member' },
        element: {
          type: 'users_select',
          action_id: SLACK_IDS.actionInviteUser,
          placeholder: { type: 'plain_text', text: 'Who is this account for?' },
        },
      },
      {
        type: 'input',
        block_id: SLACK_IDS.blockInviteName,
        optional: true,
        label: { type: 'plain_text', text: 'Name' },
        element: {
          type: 'plain_text_input',
          action_id: SLACK_IDS.actionInviteName,
          placeholder: { type: 'plain_text', text: 'Defaults to their Slack name' },
        },
      },
      {
        type: 'input',
        block_id: SLACK_IDS.blockInviteRoles,
        label: { type: 'plain_text', text: 'Roles' },
        element: {
          type: 'multi_static_select',
          action_id: SLACK_IDS.actionInviteRoles,
          initial_options: [roleOption('bartender')],
          options: INVITE_ROLES.map((r) => roleOption(r.value)),
        },
      },
      // Only meaningful for (lead) bartenders, but Slack modals can't react to
      // a select without a round trip; Payload ignores it for other roles.
      ...(locations.length > 0
        ? [
            {
              type: 'input',
              block_id: SLACK_IDS.blockInviteLocations,
              optional: true,
              label: { type: 'plain_text', text: 'Locations' },
              hint: {
                type: 'plain_text',
                text: 'Required for menu access. Bartenders can only edit assigned locations; leave empty and they cannot edit any menu.',
              },
              element: {
                type: 'multi_static_select',
                action_id: SLACK_IDS.actionInviteLocations,
                options: locationOptions,
                initial_options: locationOptions,
              },
            },
          ]
        : []),
    ],
  }
}

/** Block Kit option for a role value, labelled from INVITE_ROLES. */
function roleOption(value: string): SlackOption {
  const role = INVITE_ROLES.find((r) => r.value === value)
  return {
    text: { type: 'plain_text', text: role?.label ?? value },
    value,
  }
}

/** The invite modal's submitted fields. `roles` is empty when none were picked. */
export interface InviteSubmission {
  slackUserId: string | null
  name: string | null
  roles: string[]
  locations: string[]
}

/** Read the invite modal's submitted state into plain values. */
export function parseInviteSubmission(state: SlackStateValues): InviteSubmission {
  const block = (blockId: string, actionId: string) => state[blockId]?.[actionId]
  const name = block(SLACK_IDS.blockInviteName, SLACK_IDS.actionInviteName)?.value?.trim()
  return {
    slackUserId:
      block(SLACK_IDS.blockInviteUser, SLACK_IDS.actionInviteUser)?.selected_user ?? null,
    name: name || null,
    roles: (
      block(SLACK_IDS.blockInviteRoles, SLACK_IDS.actionInviteRoles)?.selected_options ?? []
    ).map((o) => o.value),
    locations: (
      block(SLACK_IDS.blockInviteLocations, SLACK_IDS.actionInviteLocations)?.selected_options ?? []
    ).map((o) => o.value),
  }
}

/**
 * DM sent to a newly invited user: their one-time link to set a password.
 * Delivered by DM rather than in-channel so the token isn't posted anywhere
 * shared — see buildPasswordResetMessage for the same reasoning.
 */
export function buildInviteDm(token: string, inviterName: string): Record<string, unknown> {
  return {
    text:
      `${inviterName} created a Lolev admin account for you. ` +
      `Set your password: ${SITE_URL}/admin/reset/${token}\n` +
      'The link expires in 1 hour — run `/lolevbeer password` for a fresh one.',
  }
}

/**
 * Ephemeral message carrying a one-time admin password-reset link. Ephemeral
 * because the token is a bearer credential: only the requester sees it, and it
 * disappears from their client on reload. Payload's default token lifetime is
 * one hour (forgotPassword expiration), and issuing a new one invalidates the
 * previous link.
 */
export function buildPasswordResetMessage(token: string): Record<string, unknown> {
  return {
    response_type: 'ephemeral',
    text:
      `Set a new password: ${SITE_URL}/admin/reset/${token}\n` +
      'The link expires in 1 hour and works once. Only you can see this message.',
  }
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
        text: `*${escapeSlackText(menuLabel(menu))}*  ·  ${menu.items?.length ?? 0} items  ·  <${SITE_URL}/m/${menu.url}|view>`,
      },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: 'Edit' },
        action_id: SLACK_IDS.actionEditMenu,
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
 * That no-op guarantee holds only for id-bearing rows; a row with no `id` falls
 * back to a positional `i<index>` key, which a concurrent reorder can still
 * shift onto a different row.
 *
 * Exported so the route's typeahead can map a per-item block_id (`item_<key>`)
 * back to its row for revert support — the same single source of truth.
 */
export function itemKey(item: MenuItem, index: number): string {
  return item.id ?? `i${index}`
}

/**
 * Encode/parse the modal's private_metadata as an optimistic-lock token: the
 * menu id plus the updatedAt it was opened at, `<id>|<updatedAt>`, so a submit
 * can tell whether the menu changed underneath it. parseMenuMetadata tolerates
 * a bare id (no '|') from an older modal, returning updatedAt: null.
 */
export function encodeMenuMetadata(menu: Menu): string {
  return `${menu.id}|${menu.updatedAt}`
}

export function parseMenuMetadata(meta: string): { menuId: string; updatedAt: string | null } {
  const sep = meta.indexOf('|')
  if (sep === -1) return { menuId: meta, updatedAt: null }
  return { menuId: meta.slice(0, sep), updatedAt: meta.slice(sep + 1) }
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
      block_id: `${SLACK_IDS.itemBlockPrefix}${itemKey(item, i)}`,
      optional: true,
      label: { type: 'plain_text', text: `Item ${i + 1}` },
      element: {
        type: 'external_select',
        action_id: SLACK_IDS.actionProduct,
        min_query_length: 2,
        placeholder: { type: 'plain_text', text: 'Search beers…' },
        // An already-blank row shows the same "Empty tap" option a user would
        // pick to blank it, so the state you can select is the state you see
        // back — otherwise a deliberately cleared tap is indistinguishable from
        // one nobody has filled in yet. Left untouched it resubmits
        // EMPTY_TAP_VALUE, which rebuildMenuItems maps to the `product: null`
        // the row already had.
        initial_option: ref
          ? {
              text: { type: 'plain_text', text: truncate(productName(item), 75) },
              value: encodeProductValue(ref.relationTo, ref.id),
            }
          : EMPTY_TAP_OPTION,
      },
    }
  })

  blocks.push({
    type: 'input',
    block_id: SLACK_IDS.blockAdd,
    optional: true,
    label: { type: 'plain_text', text: 'Add beers' },
    element: {
      type: 'multi_external_select',
      action_id: SLACK_IDS.actionAddProducts,
      min_query_length: 2,
      placeholder: { type: 'plain_text', text: 'Search beers to append…' },
    },
  })

  if (items.length > 0) {
    blocks.push({
      type: 'input',
      block_id: SLACK_IDS.blockRemove,
      optional: true,
      label: { type: 'plain_text', text: 'Remove items' },
      element: {
        type: 'multi_static_select',
        action_id: SLACK_IDS.actionRemoveItems,
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
    callback_id: SLACK_IDS.callbackMenuEdit,
    private_metadata: encodeMenuMetadata(menu),
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
 *   Clearing one turns that row into an empty tap.
 * - `remove` drops items by row id.
 * - `add` appends new items at the end.
 * State entries whose row id no longer exists in `original` are ignored, so
 * stale submissions degrade to no-ops instead of touching the wrong row.
 * Appended products already on the menu are skipped so an add-resubmit is
 * idempotent; duplicates among the per-row selects are NOT deduped — the Menus
 * beforeValidate rule rejects those so the user sees the error instead of a
 * silently shrunken menu.
 */
export function rebuildMenuItems(original: MenuItem[], state: SlackStateValues): MenuItem[] {
  const removed = new Set(
    (state[SLACK_IDS.blockRemove]?.[SLACK_IDS.actionRemoveItems]?.selected_options ?? []).map(
      (o) => o.value,
    ),
  )

  const next: MenuItem[] = []
  original.forEach((item, i) => {
    const key = itemKey(item, i)
    if (removed.has(key)) return
    // Distinguish "the user cleared this row" from "this row wasn't in the
    // modal". The blocks are optional, so clearing a select submits the block
    // with a null selection — that means an empty tap. A block missing entirely
    // is stale state (the row didn't exist when the modal was built), which
    // must leave the item alone. Collapsing the two would either ignore a
    // deliberate clear or let a stale submit wipe a row.
    const block = state[`${SLACK_IDS.itemBlockPrefix}${key}`]?.[SLACK_IDS.actionProduct]
    const raw = block?.selected_option?.value
    const selected = parseProductValue(raw)
    if (!selected) {
      // Drop the price along with the product, as the swap case does: a price
      // override belongs to the beer that was there, not to an empty tap.
      next.push(block ? { product: null } : item)
      return
    }
    const ref = productRef(item)
    const unchanged = ref !== null && encodeProductValue(ref.relationTo, ref.id) === raw
    next.push(unchanged ? item : { product: selected })
  })

  // Skip appended products already on the menu, so a resubmit that re-adds an
  // existing beer is idempotent instead of a 400. Only ADDS are deduped:
  // duplicates among the per-row selects fall through to the Menus
  // beforeValidate duplicate rule (src/collections/Menus.ts), which rejects the
  // publish with a message the user can fix — silently dropping a row here
  // would shrink the menu while reporting success.
  const seen = new Set<string>()
  for (const item of next) {
    const ref = productRef(item)
    if (ref) seen.add(encodeProductValue(ref.relationTo, ref.id))
  }
  for (const option of state[SLACK_IDS.blockAdd]?.[SLACK_IDS.actionAddProducts]?.selected_options ??
    []) {
    const parsed = parseProductValue(option.value)
    if (!parsed || seen.has(option.value)) continue
    seen.add(option.value)
    next.push({ product: parsed })
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
          text: `*${escapeSlackText(menuLabel(menu))}* is live with ${itemCount} items. Displays refresh on their next poll — <${SITE_URL}/m/${menu.url}|view menu>.`,
        },
      },
    ],
  }
}

/** Interim view swapped in while a publish is in flight. */
export function buildPublishingView(label: string): Record<string, unknown> {
  return {
    type: 'modal',
    title: { type: 'plain_text', text: 'Publishing…' },
    close: { type: 'plain_text', text: 'Close' },
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `Working on ${escapeSlackText(label)} — hang tight.` },
      },
    ],
  }
}

/**
 * Terminal modal carrying a message — a failed publish by default, but the
 * invite flow reuses it for its own outcomes (including success) via `title`.
 */
export function buildModalErrorView(
  message: string,
  title = 'Publish failed',
): Record<string, unknown> {
  return {
    type: 'modal',
    title: { type: 'plain_text', text: title },
    close: { type: 'plain_text', text: 'Close' },
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: escapeSlackText(message) },
      },
    ],
  }
}

/**
 * Typeahead option groups for beers and products matching a query.
 *
 * `includeEmptyTap` appends the EMPTY_TAP_VALUE option (see there for why it
 * exists) — per-item selects only, since clearing a row is meaningless in the
 * multi-select that appends beers. It is offered for every query rather than
 * only blank ones, so clearing a row never depends on guessing a search term.
 */
export function buildProductOptionGroups(
  beers: Pick<Beer, 'id' | 'name'>[],
  products: Pick<Product, 'id' | 'name'>[],
  includeEmptyTap = false,
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
  if (includeEmptyTap) {
    groups.push({ label: { type: 'plain_text', text: 'Clear' }, options: [EMPTY_TAP_OPTION] })
  }
  // No matches: Slack's documented empty-result shape is an empty `options`
  // list, not an empty `option_groups`. Reachable only for the add-beers
  // multi-select now — Empty tap keeps per-item selects non-empty. Slack has no
  // non-selectable "no matches" option, so the multi-select can still render
  // this as "There was a problem loading options"; a selectable placeholder
  // that publishes garbage would be worse.
  if (groups.length === 0) return { options: [] }
  return { option_groups: groups }
}
