'use client'

/**
 * "Send test message" under each Slack Channels field (Admin → Site Content).
 * Tests the value as typed, before saving, and says which channel it hit.
 */

import { useState } from 'react'
import { Button, useField } from '@payloadcms/ui'
import { sendSlackTestMessage, type SlackTestForm } from '@/src/actions/slack-test'

export function SlackChannelTestButton({ path }: { path: string }) {
  const { value } = useField<string>({ path })
  const [status, setStatus] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function send() {
    setSending(true)
    setStatus(null)
    try {
      const form = path.split('.').pop() as SlackTestForm
      const result = await sendSlackTestMessage(form, value ?? '')
      setStatus(
        result.ok
          ? `Sent to ${result.channel}. Check Slack.`
          : result.channel
            ? `Slack refused ${result.channel}. Check the name and invite the Lolev Beer bot.`
            : 'Only admins can send a test message.',
      )
    } catch {
      setStatus('Could not reach the server. Try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <Button buttonStyle="secondary" onClick={send} disabled={sending}>
        {sending ? 'Sending…' : 'Send test message'}
      </Button>
      <p role="status" style={{ margin: '4px 0 0' }}>
        {status}
      </p>
    </div>
  )
}
