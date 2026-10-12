'use client'

/**
 * "Send test message" under each Slack Channels field (Admin → Site Content).
 * Tests the value as typed, before saving, and says which channel it hit.
 */

import { useState } from 'react'
import { Button, useField } from '@payloadcms/ui'
import {
  sendSlackTestMessage,
  type SlackTestForm,
  type SlackTestResult,
} from '@/src/actions/slack-test'

type Reason = Extract<SlackTestResult, { ok: false }>['reason']

const FAILURE: Record<Exclude<Reason, 'refused'>, string> = {
  forbidden: 'Only admins can send a test message.',
  invalid: 'Use #channel-name or a channel ID like C0123456789.',
  'not-configured': 'Slack is not set up on this server (no bot token).',
}

function describe(result: SlackTestResult): string {
  if (result.ok) return `Sent to ${result.channel}. Check Slack, then save to apply.`
  if (result.reason === 'refused') {
    return `Slack refused ${result.channel}. Invite the Lolev Beer bot to it, or check the name.`
  }
  return FAILURE[result.reason]
}

export function SlackChannelTestButton({
  path,
  field,
}: {
  path: string
  field?: { label?: unknown }
}) {
  const { value } = useField<string>({ path })
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null)
  const [sending, setSending] = useState(false)
  const label = typeof field?.label === 'string' ? field.label : 'this channel'

  async function send() {
    if (sending) return
    setSending(true)
    setStatus(null)
    try {
      // The field name is the form key (slackChannels.<form>).
      const form = path.split('.').pop() as SlackTestForm
      const result = await sendSlackTestMessage(form, value ?? '')
      setStatus({ text: describe(result), ok: result.ok })
    } catch {
      setStatus({ text: 'Could not reach the server. Try again.', ok: false })
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <Button
        buttonStyle="secondary"
        onClick={send}
        aria-disabled={sending}
        aria-label={`Send test message for ${label}`}
      >
        {sending ? 'Sending…' : 'Send test message'}
      </Button>
      <p
        role={status && !status.ok ? 'alert' : 'status'}
        style={{
          margin: '4px 0 0',
          color: status && !status.ok ? 'var(--theme-error-500)' : undefined,
        }}
      >
        {status?.text}
      </p>
    </div>
  )
}
