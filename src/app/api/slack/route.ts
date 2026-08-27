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
 * workspace; requests older than 5 min are rejected (replay). Authorization is
 * then entirely Payload's: every request resolves to the requester's Payload
 * user (resolvePayloadUser) and runs as them, so menu editing needs an
 * admin/bartender role (Menus.access.update, scoped to assigned locations) and
 * inviting needs admin/lead-bartender (Users.access.create). Slack workspace
 * membership by itself grants nothing, and no access rule is restated here
 * where it could drift from the admin panel.
 *
 * Env: SLACK_SIGNING_SECRET (required), SLACK_BOT_TOKEN (required for the modal
 * and identity lookup). Setup steps are in README.md.
 */

import { NextRequest, NextResponse, after } from 'next/server'
import { getPayload, APIError, type TypedUser } from 'payload'
import crypto from 'crypto'
import config from '@/src/payload.config'
import { logger } from '@/lib/utils/logger'
import { isAdmin, leadBartenderAccess } from '@/src/access/roles'
import { canUpdateMenus } from '@/src/collections/Menus'
import type { User } from '@/src/payload-types'
import {
  buildEditModalView,
  buildModalErrorView,
  buildPublishedView,
  buildPublishingView,
  buildInviteDm,
  buildInviteModalView,
  buildMenuListMessage,
  buildPasswordResetMessage,
  buildProductOptionGroups,
  parseInviteSubmission,
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
  user?: { id: string; name?: string }
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

/**
 * May this user edit menus? Calls the Menus collection's own `update` rule, so
 * Slack and the admin panel agree by construction — including the per-location
 * scoping that a flat list of Slack ids could never express.
 *
 * Checked explicitly rather than left to the write: `Menus.access.read` falls
 * through to "published only" for everyone, so an unprivileged user could
 * otherwise list menus and open an editor that only fails at publish.
 */
function canEditMenus(user: TypedUser): boolean {
  return Boolean(canUpdateMenus({ req: { user } } as Parameters<typeof canUpdateMenus>[0]))
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
 * `users:read` and `users:read.email` bot scopes — the former to call
 * users.info at all, the latter to get the email field back; granting only the
 * latter fails with missing_scope. This is the only trusted way to tie a Slack
 * identity to a site account — an email the user types is self-asserted and
 * would let anyone request another account's reset link.
 *
 * Lowercased and trimmed to match how Payload stores it (its auth email field
 * normalizes in a beforeChange hook). Mongo's `equals` is case-sensitive, so
 * without this a Slack profile reading "Ted@Example.com" would never match the
 * stored "ted@example.com": that user would be told "no linked account" by
 * every command, and never auto-link.
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
      // missing_scope here means users:read and/or users:read.email was never
      // granted — reinstall the app after adding them (docs/slack-app-manifest.yml).
      logger.error(`Slack users.info failed: ${data.error}`)
      return null
    }
    return data.user?.profile?.email?.toLowerCase().trim() || null
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

/**
 * May this user create accounts? Calls the Users collection's own `create`
 * access rule so the invite modal never opens for someone Payload would reject
 * at submit time — and so the rule lives in exactly one place.
 */
function canCreateUsers(user: TypedUser): boolean {
  return Boolean(
    leadBartenderAccess({ req: { user } } as Parameters<typeof leadBartenderAccess>[0]),
  )
}

/** Ephemeral reply for a linked user whose role doesn't allow menu editing. */
function notAuthorizedMessage(): Record<string, unknown> {
  return {
    response_type: 'ephemeral',
    text: 'Your site account does not have permission to edit menus — ask an admin for the bartender role.',
  }
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

  // Not allowlist-gated: authority comes from the requester's own Payload
  // account (Users.create is admin/lead-bartender only), so Slack membership
  // alone can never create an account. See openInviteModal.
  if (subcommand === 'invite') {
    const triggerId = params.get('trigger_id')
    if (!triggerId) {
      return NextResponse.json({ response_type: 'ephemeral', text: 'Missing trigger_id.' })
    }
    after(() => openInviteModal(slackUserId, triggerId, responseUrl))
    return new NextResponse(null, { status: 200 })
  }

  if (subcommand !== 'menu') {
    return NextResponse.json({
      response_type: 'ephemeral',
      text:
        'Usage:\n' +
        '• `/lolevbeer menu` — list and edit the beer menus.\n' +
        '• `/lolevbeer invite` — create an admin account for a teammate.\n' +
        '• `/lolevbeer password` — get a link to set a new admin password.',
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
      if (!canEditMenus(user)) {
        await slackApi(responseUrl, notAuthorizedMessage())
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

/**
 * Open the invite modal, but only for a requester whose own Payload account may
 * create users. The check is Payload's (`Users.access.create`), asked via
 * canCreateUsers rather than re-stated here — the same rule the admin panel
 * uses, so the two can't drift. Slack workspace membership grants nothing.
 */
async function openInviteModal(
  slackUserId: string | undefined,
  triggerId: string,
  responseUrl: string,
): Promise<void> {
  try {
    const payload = await getPayload({ config })
    const user = await resolvePayloadUser(payload, slackUserId)
    if (!user) {
      await slackApi(responseUrl, noAccountMessage())
      return
    }
    if (!canCreateUsers(user)) {
      await slackApi(responseUrl, {
        response_type: 'ephemeral',
        text: 'Only admins and lead bartenders can create accounts.',
      })
      return
    }

    // Locations populate the optional scoping select; an empty list just omits
    // the block, so a lookup failure degrades rather than blocking the invite.
    const locations = await payload
      .find({
        collection: 'locations',
        limit: 100,
        depth: 0,
        sort: 'name',
        user,
        overrideAccess: false,
      })
      .catch((error) => {
        logger.error('Slack invite location lookup failed:', error)
        return null
      })

    // A lead bartender can only grant locations they hold themselves (capped
    // by Users' beforeChange hook), so don't offer choices that would 403.
    let selectableLocations = locations?.docs ?? []
    if (!isAdmin(user)) {
      const assignedLocations = Array.isArray(user.locations) ? user.locations : []
      const ownLocationIds = new Set(
        assignedLocations.map((location) => {
          if (typeof location === 'object' && location !== null) return String(location.id)
          return String(location)
        }),
      )
      selectableLocations = selectableLocations.filter((location) =>
        ownLocationIds.has(String(location.id)),
      )
    }

    const opened = await slackApi('views.open', {
      trigger_id: triggerId,
      view: buildInviteModalView(
        selectableLocations.map((l) => ({ id: String(l.id), name: l.name })),
      ),
    })
    if (!opened) {
      await slackApi(responseUrl, {
        response_type: 'ephemeral',
        text: 'Could not open the invite form — try `/lolevbeer invite` again.',
      })
    }
  } catch (error) {
    logger.error('Slack invite modal failed:', error)
    await slackApi(responseUrl, {
      response_type: 'ephemeral',
      text: 'Could not open the invite form — try again.',
    })
  }
}

/**
 * Create the invited user and DM them a link to set their password.
 *
 * The account is created AS the inviter (`overrideAccess: false`), so Payload
 * decides: `Users.access.create` gates who may invite at all, and the
 * collection's beforeChange hook caps lead bartenders at the bartender role —
 * a lead bartender picking "Admin" gets Payload's own 403 message back in the
 * modal rather than a rule maintained twice.
 *
 * The email comes from the invitee's verified Slack profile, never typed, so
 * an account can't be minted for someone outside the workspace.
 */
async function submitInvite(
  interaction: SlackInteractionPayload,
  state: SlackStateValues,
  viewId: string | undefined,
): Promise<void> {
  // buildModalErrorView defaults to the menu flow's "Publish failed" title.
  const INVITE_FAILED = 'Invite failed'
  const updateView = (v: Record<string, unknown>) =>
    slackApi('views.update', { view_id: viewId, view: v })
  const invite = parseInviteSubmission(state)
  try {
    if (!invite.slackUserId) {
      await updateView(
        buildModalErrorView('Pick the Slack member this account is for.', INVITE_FAILED),
      )
      return
    }

    const payload = await getPayload({ config })
    const inviter = await resolvePayloadUser(payload, interaction.user?.id)
    if (!inviter) {
      await updateView(
        buildModalErrorView(
          'No Lolev site account is linked to your Slack profile.',
          INVITE_FAILED,
        ),
      )
      return
    }

    const email = await slackUserEmail(invite.slackUserId)
    if (!email) {
      await updateView(
        buildModalErrorView(
          "Could not read that member's Slack email — they may be a bot or guest account.",
          INVITE_FAILED,
        ),
      )
      return
    }

    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs[0]) {
      await updateView(
        buildModalErrorView(
          `${email} already has an account — they can run \`/lolevbeer password\` to get back in.`,
          'Already has an account',
        ),
      )
      return
    }

    const created = await payload.create({
      collection: 'users',
      user: inviter,
      overrideAccess: false,
      depth: 0,
      data: {
        email,
        name: invite.name ?? undefined,
        // Validated by Payload against the collection's options, and by its
        // beforeChange hook against what the inviter may grant.
        roles: invite.roles as User['roles'],
        locations: invite.locations.length > 0 ? invite.locations : undefined,
        // Linked from birth: the invitee is a Slack member by construction, so
        // the bot never has to email-match them later.
        slackUserId: invite.slackUserId,
        // Unusable placeholder — the account is only reachable via the reset
        // link below, which is why it's generated rather than chosen here.
        password: crypto.randomUUID(),
      },
    })

    const token = await payload.forgotPassword({
      collection: 'users',
      data: { email },
      disableEmail: true,
    })
    if (!token) {
      await updateView(
        buildModalErrorView(
          `Created ${email}, but could not generate their setup link — ask them to run \`/lolevbeer password\`.`,
          'Account created',
        ),
      )
      return
    }

    // DM the invitee directly: chat.postMessage accepts a user id as the
    // channel. Needs chat:write to post at all, plus im:write to open the DM
    // conversation — im:write alone fails with missing_scope.
    const inviterName = interaction.user?.name || inviter.name || 'A teammate'
    const dmSent = await slackApi('chat.postMessage', {
      channel: invite.slackUserId,
      ...buildInviteDm(token, inviterName),
    })

    logger.info(
      `Slack invite: created=${created.id} email=${email} by=${inviter.id} slackUser=${interaction.user?.id} dm=${dmSent}`,
    )
    await updateView(
      buildModalErrorView(
        dmSent
          ? `Invited ${email}. They have a DM with their setup link.`
          : `Created ${email}, but the DM failed — ask them to run \`/lolevbeer password\`.`,
        dmSent ? 'Invite sent ✓' : 'Account created',
      ),
    )
  } catch (error) {
    // Payload's access/hook rejections land here (e.g. a lead bartender
    // choosing a role above bartender) — surface their message verbatim.
    logger.error('Slack invite failed:', error)
    const message =
      error instanceof APIError && error.status < 500
        ? error.message
        : 'Creating the account failed — try again or use the admin panel.'
    await updateView(buildModalErrorView(message, INVITE_FAILED))
  }
}

async function handleInteraction(interaction: SlackInteractionPayload): Promise<NextResponse> {
  // Invite submissions skip the menu allowlist: their authority is the
  // requester's Payload account, re-checked by payload.create in submitInvite.
  if (
    interaction.type === 'view_submission' &&
    interaction.view?.callback_id === SLACK_IDS.callbackInvite
  ) {
    return handleSubmit(interaction)
  }

  // No blanket gate here: each handler resolves the requester to their Payload
  // user and defers to Payload's access control, which is finer-grained than
  // anything this layer could check (per-location menu scoping, role-capped
  // invites) and can't drift from what the admin panel enforces.
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
        if (!canEditMenus(user)) {
          if (responseUrl) await slackApi(responseUrl, notAuthorizedMessage())
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
 * row's current product searchable so the user can revert to it, and offers an
 * "Empty tap" option that blanks the line without deleting the row. Any failure
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
    // One row's select, rather than the multi-select that appends beers. Both
    // the revert exemption below and the Empty tap option key off this: each
    // only makes sense when the query targets a single existing row.
    const isItemSelect = actionId === SLACK_IDS.actionProduct
    const revertKey =
      isItemSelect && interaction.block_id?.startsWith(SLACK_IDS.itemBlockPrefix)
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
        isItemSelect,
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
  if (!state) return new NextResponse(null, { status: 200 })

  if (view?.callback_id === SLACK_IDS.callbackInvite) {
    // Same ack-then-work shape as the menu publish: creating the user, minting
    // the token, and DMing it all exceed Slack's 3s submit window.
    const viewId = view.id
    after(() => submitInvite(interaction, state, viewId))
    return NextResponse.json({
      response_action: 'update',
      view: buildPublishingView('the invite'),
    })
  }

  if (view?.callback_id !== SLACK_IDS.callbackMenuEdit || !view.private_metadata) {
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
      // Belt and braces: the update below is access-checked too, but catching
      // it here yields a clearer message than Payload's generic Forbidden.
      if (!canEditMenus(user)) {
        await updateView(
          buildModalErrorView('Your site account does not have permission to edit menus.'),
        )
        return
      }
      // Published base (what the modal was built from) and the latest version
      // (to spot unpublished admin drafts) in parallel.
      //
      // disableErrors, not .catch(): a missing doc returns null while a real DB
      // failure still throws. Swallowing both made a failed read look like "no
      // draft exists", waving the guard below through and force-publishing over
      // the very admin changes it exists to protect. Genuine failures now reach
      // the outer catch and become a retry message instead.
      const [published, latest] = await Promise.all([
        payload.findByID({
          collection: 'menus',
          id: menuId,
          depth: 0,
          draft: false,
          disableErrors: true,
        }),
        payload.findByID({
          collection: 'menus',
          id: menuId,
          depth: 0,
          draft: true,
          disableErrors: true,
        }),
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
