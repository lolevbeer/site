/**
 * Slack mrkdwn helpers shared by donation and job pings.
 * Escape user text before it lands in `text` or Block Kit fields.
 */

export const DEFAULT_SLACK_CHANNEL = '#events'

const CHANNEL_NAME = /^#[a-z0-9_-]+$/i
const CHANNEL_ID = /^[CGD][A-Z0-9]{8,}$/

/**
 * Clip to `max` characters, appending an ellipsis when truncated.
 */
export function clip(text: string, max = 280): string {
  const chars = Array.from(text.trim())
  return chars.length <= max ? chars.join('') : `${chars.slice(0, max - 1).join('')}…`
}

/** Slack mrkdwn special characters. Mentions like `<!channel>` become inert. */
export function escapeMrkdwn(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Strip control characters that break Block Kit `plain_text` headers. */
export function slackPlainText(text: string, max = 140): string {
  const cleaned = text.replace(/[\n\r\t]/g, ' ').replace(/[\u0000-\u001F\u007F]/g, '')
  return clip(cleaned, max)
}

/**
 * Env channel or `#events`. Rejects unexpected values so a typo cannot
 * send PII to a user DM.
 */
export function resolveSlackChannel(
  value: string | undefined,
  fallback = DEFAULT_SLACK_CHANNEL,
): string {
  const raw = value?.trim()
  if (raw && (CHANNEL_NAME.test(raw) || CHANNEL_ID.test(raw))) return raw
  return fallback
}

export function field(label: string, value: string): { type: 'mrkdwn'; text: string } {
  return { type: 'mrkdwn', text: `*${label}*\n${escapeMrkdwn(clip(value))}` }
}
