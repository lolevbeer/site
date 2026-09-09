/**
 * Shared Slack Web API client used by the slash-command route and outbound
 * pings (donation requests → #events). Failures are logged, never thrown, so a
 * down Slack cannot break a user-facing submit.
 */

import { logger } from '@/lib/utils/logger'
import { readServerEnvironment } from '@/lib/config/server-env'

const METHOD_RE = /^[a-z]+(\.[a-z]+)+$/

export function isAllowedSlackHostname(hostname: string): boolean {
  return hostname === 'slack.com' || hostname.endsWith('.slack.com')
}

function isAllowedWebhook(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && isAllowedSlackHostname(parsed.hostname)
  } catch {
    return false
  }
}

function slackOk(isWebhook: boolean, status: number, body: string): boolean {
  if (status < 200 || status >= 300) return false
  if (isWebhook) {
    const trimmed = body.trim()
    if (trimmed === 'ok' || trimmed === '') return true
  }
  try {
    const json = JSON.parse(body) as { ok?: boolean }
    return json.ok !== false
  } catch {
    return !/"ok"\s*:\s*false/.test(body)
  }
}

/**
 * `target` is a Web API method name (bot token attached) or a Slack
 * `response_url`. Returns true only when Slack accepted the call.
 * HTTPS targets must be `*.slack.com`; method names must look like `chat.postMessage`.
 */
export async function slackApi<T extends Record<string, unknown>>(
  target: string,
  body: T,
): Promise<boolean> {
  const isWebhook = target.startsWith('https://')
  if (isWebhook && !isAllowedWebhook(target)) {
    logger.error('Slack target rejected')
    return false
  }
  if (!isWebhook && !METHOD_RE.test(target)) {
    logger.error('Slack method rejected')
    return false
  }

  const label = isWebhook ? 'response_url' : target
  let token: string | undefined
  try {
    token = readServerEnvironment().slackBotToken
  } catch {
    logger.error('Slack environment is not configured')
    return false
  }
  if (!isWebhook && !token) {
    logger.error('SLACK_BOT_TOKEN is not configured')
    return false
  }

  try {
    const res = await fetch(isWebhook ? target : `https://slack.com/api/${target}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        ...(isWebhook ? {} : { authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    })
    const text = await res.text()
    if (!slackOk(isWebhook, res.status, text)) {
      logger.error(`Slack ${label} failed: ${res.status} ${text.slice(0, 200)}`)
      return false
    }
    return true
  } catch {
    logger.error(`Slack ${label} request failed`)
    return false
  }
}
