/**
 * Slack bot endpoint for the /lolevbeer slash command.
 *
 * One URL handles all four Slack payload shapes:
 *  - slash command  → ephemeral list of menus with Edit buttons
 *  - block_actions  → "Edit" click opens the edit modal (views.open)
 *  - block_suggestion → typeahead options for the beer selects
 *  - view_submission → rebuild items and publish via the Payload local API
 *
 * Writes go through Payload so the revalidation plugin's afterChange hooks
 * fire and the /m/ displays pick up changes on their next poll.
 *
 * Trust model: Slack's signing secret proves the request came from our app's
 * workspace; requests older than 5 min are rejected (replay). Optionally
 * SLACK_ALLOWED_USER_IDS (comma-separated) restricts who may use the bot.
 * Payload writes run as system (overrideAccess) — Slack users are not mapped
 * to Payload users.
 *
 * Env: SLACK_SIGNING_SECRET (required), SLACK_BOT_TOKEN (required for the
 * modal), SLACK_ALLOWED_USER_IDS (optional). Setup steps are in README.md.
 */

import { NextRequest, NextResponse, after } from 'next/server'
import { getPayload } from 'payload'
import config from '@/src/payload.config'
import { logger } from '@/lib/utils/logger'
import {
  buildEditModalView,
  buildPublishedView,
  buildMenuListMessage,
  buildProductOptionGroups,
  encodeProductValue,
  productRef,
  rebuildMenuItems,
  verifySlackSignature,
  type SlackStateValues,
} from '@/src/utils/slack'

/** Handled types: block_actions, block_suggestion, view_submission. */
interface SlackInteractionPayload {
  type: string
  user?: { id: string }
  trigger_id?: string
  actions?: { action_id: string; value?: string }[]
  value?: string
  view?: {
    callback_id?: string
    private_metadata?: string
    state?: { values: SlackStateValues }
  }
}

function isAllowedUser(userId: string | undefined): boolean {
  const allowlist = process.env.SLACK_ALLOWED_USER_IDS
  if (!allowlist) return true
  if (!userId) return false
  return allowlist
    .split(',')
    .map((s) => s.trim())
    .includes(userId)
}

/**
 * Minimal Slack HTTP client — plain fetch, no SDK needed. `target` is a Web
 * API method name (bot token attached) or a full response_url; either way
 * failures are logged here so no outbound Slack call can fail silently.
 */
async function slackApi(target: string, body: Record<string, unknown>): Promise<void> {
  const isWebhook = target.startsWith('https://')
  const res = await fetch(isWebhook ? target : `https://slack.com/api/${target}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(isWebhook ? {} : { authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` }),
    },
    body: JSON.stringify(body),
  })
  // Web API failures are 200s with {"ok":false,...}; webhook failures are non-2xx.
  const text = await res.text()
  if (!res.ok || /"ok"\s*:\s*false/.test(text)) {
    logger.error(`Slack ${target} failed: ${res.status} ${text.slice(0, 200)}`)
  }
}

export async function POST(request: NextRequest) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET
  if (!signingSecret) {
    logger.error('SLACK_SIGNING_SECRET is not configured')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  const rawBody = await request.text()
  const verified = verifySlackSignature({
    signingSecret,
    timestamp: request.headers.get('x-slack-request-timestamp'),
    signature: request.headers.get('x-slack-signature'),
    rawBody,
  })
  if (!verified) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const params = new URLSearchParams(rawBody)

  // Interactivity payloads (button clicks, typeahead, modal submit) arrive as
  // a JSON string in the `payload` form field; slash commands as flat fields.
  const interactionJson = params.get('payload')
  if (interactionJson) {
    return handleInteraction(JSON.parse(interactionJson) as SlackInteractionPayload)
  }
  return handleSlashCommand(params)
}

/** `/lolevbeer menu` → ephemeral menu list. Anything else → usage help. */
async function handleSlashCommand(params: URLSearchParams): Promise<NextResponse> {
  if (!isAllowedUser(params.get('user_id') ?? undefined)) {
    return NextResponse.json({
      response_type: 'ephemeral',
      text: 'Sorry, you are not authorized to manage menus.',
    })
  }

  const subcommand = (params.get('text') ?? '').trim().toLowerCase()
  if (subcommand !== 'menu') {
    return NextResponse.json({
      response_type: 'ephemeral',
      text: 'Usage: `/lolevbeer menu` — list and edit the beer menus.',
    })
  }

  // Ack now, deliver via response_url: Slack discards replies slower than 3s,
  // and a cold Payload + Mongo init can exceed that. response_url is good for
  // 30 minutes.
  const responseUrl = params.get('response_url')
  if (!responseUrl) {
    return NextResponse.json({ response_type: 'ephemeral', text: 'Missing response_url.' })
  }
  after(async () => {
    try {
      const payload = await getPayload({ config })
      const menus = await payload.find({
        collection: 'menus',
        // Only published menus: drafts aren't live displays, and the bot's
        // submit force-publishes — listing drafts would let it leak them live.
        where: { _status: { equals: 'published' } },
        limit: 20,
        depth: 0, // the list message only needs description/name, url, item count
        sort: 'url',
      })
      await slackApi(responseUrl, buildMenuListMessage(menus.docs))
    } catch (error) {
      logger.error('Slack menu list failed:', error)
    }
  })
  return new NextResponse(null, { status: 200 })
}

async function handleInteraction(interaction: SlackInteractionPayload): Promise<NextResponse> {
  if (!isAllowedUser(interaction.user?.id)) {
    return new NextResponse(null, { status: 200 })
  }

  switch (interaction.type) {
    case 'block_actions':
      return handleEditClick(interaction)
    case 'block_suggestion':
      return handleTypeahead(interaction)
    case 'view_submission':
      return handleSubmit(interaction)
    default:
      return new NextResponse(null, { status: 200 })
  }
}

/**
 * "Edit" button → open the modal. Ack immediately and open the view in
 * after(): the trigger_id only lives 3s, so on a cold start the open can
 * still miss — the button just does nothing and a second (warm) click works.
 */
async function handleEditClick(interaction: SlackInteractionPayload): Promise<NextResponse> {
  const action = interaction.actions?.find((a) => a.action_id === 'edit_menu')
  const triggerId = interaction.trigger_id
  if (action?.value && triggerId) {
    const menuId = action.value
    after(async () => {
      try {
        const payload = await getPayload({ config })
        const menu = await payload.findByID({
          collection: 'menus',
          id: menuId,
          depth: 1,
          // The modal only reads id + name from related docs — skip hydrating
          // the full Beer schema (uploads, textures, reviews) per item.
          populate: { beers: { name: true }, products: { name: true } },
        })
        await slackApi('views.open', { trigger_id: triggerId, view: buildEditModalView(menu) })
      } catch (error) {
        logger.error('Slack edit_menu failed:', error)
      }
    })
  }
  return new NextResponse(null, { status: 200 })
}

/**
 * Typeahead for the beer selects: search beers and products by name,
 * excluding what's already on the menu being edited — the Menus collection
 * rejects duplicates, so offering them would only lead to a submit error.
 */
async function handleTypeahead(interaction: SlackInteractionPayload): Promise<NextResponse> {
  const query = interaction.value ?? ''
  const menuId = interaction.view?.private_metadata
  const payload = await getPayload({ config })

  const search = (collection: 'beers' | 'products', limit: number) =>
    payload.find({
      collection,
      where: { name: { contains: query } },
      limit,
      depth: 0,
      sort: 'name',
    })

  // The menu read only feeds the exclusion filter, so all three queries run in
  // parallel and the filter is applied in JS (limits over-fetched to cover it).
  const [menu, beers, products] = await Promise.all([
    menuId
      ? payload.findByID({ collection: 'menus', id: menuId, depth: 0 }).catch((error) => {
          logger.error('Slack typeahead menu lookup failed:', error)
          return null
        })
      : null,
    search('beers', 60),
    search('products', 30),
  ])

  const onMenu = new Set(
    (menu?.items ?? [])
      .map((item) => productRef(item))
      .filter((ref) => ref !== null)
      .map((ref) => encodeProductValue(ref.relationTo, ref.id)),
  )
  const available = <T extends { id: string }>(docs: T[], relationTo: 'beers' | 'products') =>
    docs.filter((doc) => !onMenu.has(encodeProductValue(relationTo, String(doc.id))))

  return NextResponse.json(
    buildProductOptionGroups(
      available(beers.docs, 'beers').slice(0, 50),
      available(products.docs, 'products').slice(0, 25),
    ),
  )
}

/** Modal submit → rebuild items from modal state and publish the menu. */
async function handleSubmit(interaction: SlackInteractionPayload): Promise<NextResponse> {
  const menuId = interaction.view?.private_metadata
  const state = interaction.view?.state?.values
  if (interaction.view?.callback_id !== 'menu_edit' || !menuId || !state) {
    return new NextResponse(null, { status: 200 })
  }

  const payload = await getPayload({ config })
  try {
    const menu = await payload.findByID({ collection: 'menus', id: menuId, depth: 0 })
    const items = rebuildMenuItems(menu.items ?? [], state)
    if (items.length === 0) {
      // Error keys must match a block_id present in the view; 'add' is the
      // only block guaranteed to exist (the 'remove' block is conditional).
      return NextResponse.json({
        response_action: 'errors',
        errors: { add: 'A menu needs at least one item.' },
      })
    }
    // Publish immediately — the whole point of the bot is a live tap swap.
    // The update stays inline (not after()) because validation errors can
    // only reach the user through this response; stale resubmits are safe
    // no-ops thanks to row-id keyed modal state.
    await payload.update({
      collection: 'menus',
      id: menuId,
      data: { items, _status: 'published' },
    })
    logger.info(`Slack menu publish: menu=${menuId} slackUser=${interaction.user?.id ?? 'unknown'}`)
    // Swap the modal to a confirmation instead of closing silently.
    return NextResponse.json({
      response_action: 'update',
      view: buildPublishedView(menu, items.length),
    })
  } catch (error) {
    logger.error('Slack menu update failed:', error)
    // Surface Payload validation messages (e.g. the duplicate-item check in
    // the Menus beforeValidate hook) instead of a dead-end generic error.
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Saving failed — try again or use the admin panel.'
    return NextResponse.json({
      response_action: 'errors',
      errors: { add: message },
    })
  }
}
