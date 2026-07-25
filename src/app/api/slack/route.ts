/**
 * Slack bot endpoint for the /lolevbeer slash command.
 *
 * One URL handles all four Slack payload shapes:
 *  - slash command  → ephemeral list of menus with Edit buttons
 *  - block_actions  → "Edit" click opens the edit modal (views.open)
 *  - block_suggestion → typeahead options for the beer selects
 *  - view_submission → ack instantly with a "Publishing…" view, then rebuild
 *    items and publish in after() (Slack discards a submit response slower than
 *    3s, so the DB write can't block the ack); the final confirmation-or-error
 *    view is pushed into the still-open modal with views.update
 *
 * Writes go through Payload so the revalidation plugin's afterChange hooks
 * fire and the /m/ displays pick up changes on their next poll.
 *
 * Trust model: Slack's signing secret proves the request came from our app's
 * workspace; requests older than 5 min are rejected (replay).
 * SLACK_ALLOWED_USER_IDS (comma-separated) gates menu editing and fails closed
 * when unset. Menu reads and writes then run AS the requester's Payload user
 * (resolved via resolvePayloadUser), so Payload's role and location-scoped
 * access control is the real authority rather than a rule duplicated here.
 * `/lolevbeer password` is deliberately outside the allowlist: it only ever
 * acts on the caller's own account.
 *
 * Env: SLACK_SIGNING_SECRET (required), SLACK_BOT_TOKEN (required for the
 * modal and identity lookup), SLACK_ALLOWED_USER_IDS (required for menu
 * editing). Setup steps are in README.md.
 */

import { NextRequest, NextResponse, after } from 'next/server'
import { getPayload, APIError, type TypedUser } from 'payload'
import config from '@/src/payload.config'
import { logger } from '@/lib/utils/logger'
import {
  buildEditModalView,
  buildModalErrorView,
  buildPublishedView,
  buildPublishingView,
  buildMenuListMessage,
  buildPasswordResetMessage,
  buildProductOptionGroups,
  encodeProductValue,
  itemKey,
  parseMenuMetadata,
  productRef,
  rebuildMenuItems,
  SLACK_IDS,
  verifySlackSignature,
  type SlackStateValues,
} from '@/src/utils/slack'

/** Handled types: block_actions, block_suggestion, view_submission. */
interface SlackInteractionPayload {
  type: string
  user?: { id: string }
  trigger_id?: string
  // block_actions carries the source message's response_url (good ~30 min), used
  // to post ephemeral follow-ups when the after() open has no modal to message.
  response_url?: string
  actions?: { action_id: string; value?: string }[]
  // block_suggestion carries the querying element's ids at the payload top level.
  action_id?: string
  block_id?: string
  value?: string
  view?: {
    id?: string
    callback_id?: string
    private_metadata?: string
    state?: { values: SlackStateValues }
  }
}

// Warn just once per process (not per request) when the bot runs without an
// allowlist, so the log isn't spammed on every interaction.
let warnedNoAllowlist = false

// Fails CLOSED when SLACK_ALLOWED_USER_IDS is unset: the bot writes as system,
// bypassing Payload's location-scoped roles, so an accidentally dropped env var
// must not silently open menu publishing to the whole workspace.
function isAllowedUser(userId: string | undefined): boolean {
  const allowlist = process.env.SLACK_ALLOWED_USER_IDS
  if (!allowlist) {
    if (!warnedNoAllowlist) {
      warnedNoAllowlist = true
      logger.warn(
        'SLACK_ALLOWED_USER_IDS is unset — denying all Slack menu edits. Set it ' +
          '(comma-separated Slack user ids) to allow specific users.',
      )
    }
    return false
  }
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
 * Returns true only when Slack accepted the call, false on any failure — callers
 * that need to react (e.g. a failed views.open) branch on the result.
 */
async function slackApi(target: string, body: Record<string, unknown>): Promise<boolean> {
  const isWebhook = target.startsWith('https://')
  // A Web API call with no bot token can only 401 — fail fast, don't fetch.
  if (!isWebhook && !process.env.SLACK_BOT_TOKEN) {
    logger.error('SLACK_BOT_TOKEN is not configured')
    return false
  }
  try {
    const res = await fetch(isWebhook ? target : `https://slack.com/api/${target}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        ...(isWebhook ? {} : { authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` }),
      },
      body: JSON.stringify(body),
      // Bound the call so a hung Slack endpoint can't wedge the after() task.
      signal: AbortSignal.timeout(8000),
    })
    // Web API failures are 200s with {"ok":false,...}; webhook failures are non-2xx.
    const text = await res.text()
    if (!res.ok || /"ok"\s*:\s*false/.test(text)) {
      logger.error(`Slack ${target} failed: ${res.status} ${text.slice(0, 200)}`)
      return false
    }
    return true
  } catch (error) {
    // Network reject or the 8s AbortSignal timeout — log, never rethrow.
    logger.error(`Slack ${target} request failed:`, error)
    return false
  }
}

/**
 * The Slack account's workspace-verified profile email, or null. Requires the
 * `users:read.email` bot scope. This is the only trusted way to tie a Slack
 * identity to a site account — an email the user types is self-asserted and
 * would let anyone request another account's reset link.
 */
async function slackUserEmail(slackUserId: string): Promise<string | null> {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) {
    logger.error('SLACK_BOT_TOKEN is not configured')
    return null
  }
  try {
    const res = await fetch(
      `https://slack.com/api/users.info?user=${encodeURIComponent(slackUserId)}`,
      {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      },
    )
    const data = (await res.json()) as {
      ok?: boolean
      error?: string
      user?: { profile?: { email?: string } }
    }
    if (!data.ok) {
      // missing_scope here means users:read.email was never granted.
      logger.error(`Slack users.info failed: ${data.error}`)
      return null
    }
    return data.user?.profile?.email ?? null
  } catch (error) {
    logger.error('Slack users.info request failed:', error)
    return null
  }
}

/**
 * The Payload user behind a Slack account, or null when there is no match.
 *
 * Resolves by the stored `slackUserId` first, then falls back to matching the
 * Slack profile email — and on a successful email match, claims the mapping so
 * later lookups skip the Slack round trip and keep working if either address
 * changes. Slack profile emails are workspace-verified and unique per
 * workspace, so first-match claiming can't be raced by another member.
 *
 * The claim is a system write (overrideAccess): the field's update access is
 * admin-only precisely so a logged-in user can't retarget someone else's
 * mapping, but the bot establishing identity is not a privilege grant.
 */
async function resolvePayloadUser(
  payload: Awaited<ReturnType<typeof getPayload>>,
  slackUserId: string | undefined,
): Promise<TypedUser | null> {
  if (!slackUserId) return null

  const byId = await payload.find({
    collection: 'users',
    where: { slackUserId: { equals: slackUserId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (byId.docs[0]) return byId.docs[0] as TypedUser

  const email = await slackUserEmail(slackUserId)
  if (!email) return null

  const byEmail = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const user = byEmail.docs[0]
  if (!user) return null

  try {
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { slackUserId },
      depth: 0,
      overrideAccess: true,
    })
  } catch (error) {
    // A failed claim only costs a users.info call next time — the caller is
    // already resolved, so don't fail their command over it.
    logger.error(`Claiming slackUserId for user ${user.id} failed:`, error)
  }
  return user as TypedUser
}

/** Ephemeral reply explaining that no site account is linked to this Slack user. */
function noAccountMessage(): Record<string, unknown> {
  return {
    response_type: 'ephemeral',
    text:
      'No Lolev site account is linked to your Slack profile. This happens when your ' +
      'Slack email differs from your site login — ask an admin to set your Slack member ' +
      'ID on your user in the admin panel.',
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
    let interaction: SlackInteractionPayload
    try {
      interaction = JSON.parse(interactionJson) as SlackInteractionPayload
    } catch (error) {
      // A malformed payload is Slack's problem, not ours — ack 200 so Slack
      // doesn't retry, but never let a parse error become a 500.
      logger.error('Slack interaction payload parse failed:', error)
      return new NextResponse(null, { status: 200 })
    }
    return handleInteraction(interaction)
  }
  return handleSlashCommand(params)
}

/**
 * `/lolevbeer menu` → ephemeral menu list (allowlisted users only).
 * `/lolevbeer password` → one-time admin reset link for the caller's own
 * account. Anything else → usage help.
 */
async function handleSlashCommand(params: URLSearchParams): Promise<NextResponse> {
  const slackUserId = params.get('user_id') ?? undefined
  const subcommand = (params.get('text') ?? '').trim().toLowerCase()

  // Ack now, deliver via response_url: Slack discards replies slower than 3s,
  // and a cold Payload + Mongo init can exceed that. response_url is good for
  // 30 minutes.
  const responseUrl = params.get('response_url')
  if (!responseUrl) {
    return NextResponse.json({ response_type: 'ephemeral', text: 'Missing response_url.' })
  }

  // Outside the menu allowlist on purpose: this only ever issues a link for the
  // caller's own account, and the people most likely to need it are exactly the
  // ones locked out of the admin panel.
  if (subcommand === 'password') {
    after(() => sendPasswordResetLink(slackUserId, responseUrl))
    return new NextResponse(null, { status: 200 })
  }

  if (subcommand !== 'menu') {
    return NextResponse.json({
      response_type: 'ephemeral',
      text:
        'Usage:\n' +
        '• `/lolevbeer menu` — list and edit the beer menus.\n' +
        '• `/lolevbeer password` — get a link to set a new admin password.',
    })
  }

  if (!isAllowedUser(slackUserId)) {
    return NextResponse.json({
      response_type: 'ephemeral',
      text: 'Sorry, you are not authorized to manage menus.',
    })
  }

  after(async () => {
    try {
      const payload = await getPayload({ config })
      const user = await resolvePayloadUser(payload, slackUserId)
      if (!user) {
        await slackApi(responseUrl, noAccountMessage())
        return
      }
      const menus = await payload.find({
        // Listed as the requester, so a location-scoped bartender sees only
        // the menus they may actually edit.
        user,
        overrideAccess: false,
        collection: 'menus',
        // Only published menus: drafts aren't live displays, and the bot's
        // submit force-publishes — listing drafts would let it leak them live.
        where: { _status: { equals: 'published' } },
        limit: 20,
        depth: 0, // the list message only needs description/name, url, item count
        sort: 'url',
      })
      const message = buildMenuListMessage(menus.docs)
      // More published menus than we listed: point the overflow at the admin
      // panel rather than silently dropping them.
      if (menus.totalDocs > menus.docs.length) {
        const blocks = message.blocks
        if (Array.isArray(blocks)) {
          blocks.push({
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `…and ${menus.totalDocs - menus.docs.length} more — use the admin panel to edit the rest.`,
              },
            ],
          })
        }
      }
      await slackApi(responseUrl, message)
    } catch (error) {
      logger.error('Slack menu list failed:', error)
      // Best-effort user-facing failure; slackApi logs its own failure.
      await slackApi(responseUrl, {
        response_type: 'ephemeral',
        text: 'Fetching menus failed — try again.',
      })
    }
  })
  return new NextResponse(null, { status: 200 })
}

/**
 * Issue a one-time password-reset link for the Slack caller's own site account.
 *
 * The account is resolved from the Slack identity (never from a typed email),
 * so this can only ever target the requester. `disableEmail: true` makes
 * Payload skip its mailer — which is the point, since there is no email
 * service — and hand back the raw token for us to deliver over Slack instead.
 * Re-running the command simply supersedes the previous token.
 */
async function sendPasswordResetLink(
  slackUserId: string | undefined,
  responseUrl: string,
): Promise<void> {
  try {
    const payload = await getPayload({ config })
    const user = await resolvePayloadUser(payload, slackUserId)
    if (!user?.email) {
      await slackApi(responseUrl, noAccountMessage())
      return
    }

    const token = await payload.forgotPassword({
      collection: 'users',
      data: { email: user.email },
      disableEmail: true,
    })
    // forgotPassword returns null for an unknown address rather than throwing.
    // resolvePayloadUser already found this user, so null here means a race
    // (deleted mid-request) — report it rather than posting a broken link.
    if (!token) {
      await slackApi(responseUrl, noAccountMessage())
      return
    }

    await slackApi(responseUrl, buildPasswordResetMessage(token))
    logger.info(`Slack password reset issued: user=${user.id} slackUser=${slackUserId}`)
  } catch (error) {
    logger.error('Slack password reset failed:', error)
    await slackApi(responseUrl, {
      response_type: 'ephemeral',
      text: 'Could not create a reset link — try again, or ask an admin.',
    })
  }
}

async function handleInteraction(interaction: SlackInteractionPayload): Promise<NextResponse> {
  if (!isAllowedUser(interaction.user?.id)) {
    // A view_submission must not be silently acked — an empty 200 closes the
    // modal as if the publish succeeded. Return a modal error so the user sees
    // the denial.
    if (interaction.type === 'view_submission') {
      return NextResponse.json({
        response_action: 'errors',
        errors: { [SLACK_IDS.blockAdd]: 'You are not authorized to manage menus.' },
      })
    }
    // block_suggestion comes from an open modal's typeahead and must be answered
    // with an options list — an empty body renders a load error in the select.
    if (interaction.type === 'block_suggestion') {
      return NextResponse.json({ options: [] })
    }
    // block_actions has no response surface, so it stays a silent 200 ack.
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
 * after(): the trigger_id only lives 3s, so on a cold start the open can miss.
 * When it does (or the menu was unpublished since the list rendered), an
 * ephemeral posted to response_url tells the user to try again rather than
 * leaving the click looking like it did nothing.
 */
async function handleEditClick(interaction: SlackInteractionPayload): Promise<NextResponse> {
  const action = interaction.actions?.find((a) => a.action_id === SLACK_IDS.actionEditMenu)
  const triggerId = interaction.trigger_id
  const responseUrl = interaction.response_url
  if (action?.value && triggerId) {
    const menuId = action.value
    after(async () => {
      try {
        const payload = await getPayload({ config })
        const user = await resolvePayloadUser(payload, interaction.user?.id)
        if (!user) {
          if (responseUrl) await slackApi(responseUrl, noAccountMessage())
          return
        }
        const menu = await payload.findByID({
          collection: 'menus',
          id: menuId,
          // Opened as the requester: a menu they may not read (location scope)
          // throws here rather than rendering an editor they can't submit.
          user,
          overrideAccess: false,
          depth: 1,
          // The modal only reads id + name from related docs — skip hydrating
          // the full Beer schema (uploads, textures, reviews) per item.
          populate: { beers: { name: true }, products: { name: true } },
        })
        // The list is a snapshot; the menu may have been unpublished (in admin,
        // or by another Slack submit) since the button rendered. The editor
        // only publishes menus, so refuse a non-published base.
        if (menu._status !== 'published') {
          if (responseUrl) {
            await slackApi(responseUrl, {
              response_type: 'ephemeral',
              text: 'That menu is no longer published — run /lolevbeer menu again.',
            })
          }
          return
        }
        const opened = await slackApi('views.open', {
          trigger_id: triggerId,
          view: buildEditModalView(menu),
        })
        // Expired trigger, bad token, or invalid blocks — surface it so the
        // click isn't a silent no-op.
        if (!opened && responseUrl) {
          await slackApi(responseUrl, {
            response_type: 'ephemeral',
            text: 'Could not open the editor — try clicking Edit again.',
          })
        }
      } catch (error) {
        logger.error('Slack edit_menu failed:', error)
      }
    })
  }
  return new NextResponse(null, { status: 200 })
}

/**
 * Typeahead for the beer selects: search beers and products by name, excluding
 * what's already on the menu being edited — the Menus collection rejects
 * duplicates, so offering them would only lead to a submit error. Only the
 * menu-edit modal's product selects are served; a per-item select keeps its own
 * row's current product searchable so the user can revert to it. Any failure
 * degrades to an empty option list rather than a 500 Slack renders as broken.
 */
async function handleTypeahead(interaction: SlackInteractionPayload): Promise<NextResponse> {
  try {
    // Only serve the menu-edit modal's product selects; ignore any other
    // block_suggestion so a stray select can't trigger a catalog scan.
    const actionId = interaction.action_id
    if (
      interaction.view?.callback_id !== SLACK_IDS.callbackMenuEdit ||
      (actionId !== SLACK_IDS.actionProduct && actionId !== SLACK_IDS.actionAddProducts)
    ) {
      return NextResponse.json({ options: [] })
    }

    const query = interaction.value ?? ''
    // private_metadata is now `<id>|<updatedAt>`; only the id is needed here.
    const { menuId } = parseMenuMetadata(interaction.view.private_metadata ?? '')
    const payload = await getPayload({ config })
    // ponytail: this one stays a system read. It fires on every keystroke, and
    // resolvePayloadUser costs a users query — while the data it returns
    // (beer/product names, and the menu the user already has open) is public
    // catalog content. The submit that follows is access-checked for real.

    const search = (collection: 'beers' | 'products', limit: number) =>
      payload.find({
        collection,
        // `contains` is an unindexable collection scan — fine at catalog scale
        // (hundreds); a Mongo text index on `name` is the upgrade path if the
        // catalog grows large.
        where: { name: { contains: query } },
        limit,
        depth: 0,
        select: { name: true }, // only name (+ id) feeds the option list
        sort: 'name',
      })

    // The menu read only feeds the exclusion filter, so all three queries run in
    // parallel and the filter is applied in JS. Over-fetch well past the 50/25
    // we serve: a modal caps at 90 items, so a worst-case 90-item menu can
    // exclude up to 90 matches — 150/120 leaves ≥50/≥25 after exclusion.
    const [menu, beers, products] = await Promise.all([
      menuId
        ? payload.findByID({ collection: 'menus', id: menuId, depth: 0 }).catch((error) => {
            logger.error('Slack typeahead menu lookup failed:', error)
            return null
          })
        : null,
      search('beers', 150),
      search('products', 120),
    ])

    // Revert support: for a per-item select (block_id `item_<rowKey>`), keep that
    // row's own current product searchable — exclude every other row's product
    // but not this one's, so the user can pick the original beer back.
    const revertKey =
      actionId === SLACK_IDS.actionProduct &&
      interaction.block_id?.startsWith(SLACK_IDS.itemBlockPrefix)
        ? interaction.block_id.slice(SLACK_IDS.itemBlockPrefix.length)
        : null

    const onMenu = new Set(
      (menu?.items ?? [])
        .filter((item, i) => itemKey(item, i) !== revertKey)
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
  } catch (error) {
    // DB down, bad payload, anything: degrade to an empty typeahead.
    logger.error('Slack typeahead failed:', error)
    return NextResponse.json({ options: [] })
  }
}

/**
 * Modal submit → ack instantly with a "Publishing…" view, then validate and
 * publish in after(). Slack drops a view_submission response slower than 3s, so
 * no DB work can precede the ack; the final result (confirmation or error) is
 * pushed into the still-open modal with views.update.
 */
async function handleSubmit(interaction: SlackInteractionPayload): Promise<NextResponse> {
  const view = interaction.view
  const state = view?.state?.values
  if (view?.callback_id !== SLACK_IDS.callbackMenuEdit || !view.private_metadata || !state) {
    return new NextResponse(null, { status: 200 })
  }

  const { menuId, updatedAt } = parseMenuMetadata(view.private_metadata)
  const viewId = view.id
  const slackUser = interaction.user?.id ?? 'unknown'

  after(async () => {
    const updateView = (v: Record<string, unknown>) =>
      slackApi('views.update', { view_id: viewId, view: v })
    try {
      const payload = await getPayload({ config })
      const user = await resolvePayloadUser(payload, interaction.user?.id)
      if (!user) {
        await updateView(
          buildModalErrorView(
            'No Lolev site account is linked to your Slack profile — ask an admin to link it.',
          ),
        )
        return
      }
      // Published base (what the modal was built from) and the latest version
      // (to spot unpublished admin drafts) in parallel.
      const [published, latest] = await Promise.all([
        payload
          .findByID({ collection: 'menus', id: menuId, depth: 0, draft: false })
          .catch(() => null),
        payload
          .findByID({ collection: 'menus', id: menuId, depth: 0, draft: true })
          .catch(() => null),
      ])

      if (!published || published._status !== 'published') {
        await updateView(buildModalErrorView('This menu is not published — use the admin panel.'))
        return
      }
      // A draft newer than the published version means someone edited in the
      // admin without publishing; force-publishing a stale base would bury it.
      if (latest?._status === 'draft') {
        await updateView(
          buildModalErrorView(
            'This menu has unpublished admin changes — publish it from the admin panel first.',
          ),
        )
        return
      }
      // Optimistic lock: the modal encoded the updatedAt it opened at; a
      // mismatch means the published menu moved under us.
      if (updatedAt !== null && published.updatedAt !== updatedAt) {
        await updateView(
          buildModalErrorView(
            'This menu changed since you opened the editor — close and reopen it.',
          ),
        )
        return
      }

      const items = rebuildMenuItems(published.items ?? [], state)
      if (items.length === 0) {
        await updateView(buildModalErrorView('A menu needs at least one item.'))
        return
      }

      await payload.update({
        collection: 'menus',
        id: menuId,
        // Written as the requester so Payload's role and location-scoped access
        // control decides — a bartender scoped elsewhere gets a 403 here, which
        // the catch below renders as a modal error.
        user,
        overrideAccess: false,
        // type is included so the Menus beforeChange recipe-sort (gated on
        // data.type === 'cans') runs for Slack publishes like admin saves.
        data: { items, _status: 'published', type: published.type },
        depth: 0, // the returned doc is discarded
      })
      logger.info(`Slack menu publish: menu=${menuId} slackUser=${slackUser}`)
      await updateView(buildPublishedView(published, items.length))
    } catch (error) {
      logger.error('Slack menu update failed:', error)
      // Only Payload's own validation messages (e.g. the duplicate-item check
      // in the Menus beforeValidate hook) are safe to surface; never leak raw
      // infra errors into the modal.
      const message =
        error instanceof APIError && error.status < 500
          ? error.message
          : 'Saving failed — try again or use the admin panel.'
      await updateView(buildModalErrorView(message))
    }
  })

  // Ack within Slack's 3s window; after() pushes the real result via views.update.
  return NextResponse.json({
    response_action: 'update',
    view: buildPublishingView('the menu'),
  })
}
