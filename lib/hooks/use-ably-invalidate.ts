'use client'

/**
 * Subscribe to Ably kiosk invalidate channels and bump a signal when a
 * matching "updated" message arrives. Used by menu/events stream hooks so
 * displays can poll immediately on CMS edits while keeping polling as the
 * fallback when Ably is disabled or disconnected.
 *
 * Ably is loaded only when NEXT_PUBLIC_ABLY_ENABLED=true so the kiosk client
 * bundle (and hydration) stay polling-only when the flag is off. It uses the
 * `ably/modular` build with just the WebSocket transport and fetch (for the
 * auth request), about a third smaller gzipped than the full SDK. The pnpm
 * patch (patches/ably@2.29.0.patch) must cover that build's files.
 */

import { useEffect, useState } from 'react'
import type { Message, RealtimeChannel } from 'ably'
import type { BaseRealtime as RealtimeClient } from 'ably/modular'

import {
  ABLY_CHANNELS,
  ABLY_UPDATED_EVENT,
  type KioskInvalidateKind,
  type KioskInvalidateMessage,
} from '@/lib/ably/channels'
import { isAblyClientEnabled } from '@/lib/ably/config'

export interface UseAblyInvalidateOptions {
  kind: KioskInvalidateKind
  /** Menu url or location slug; when set, ignore messages for other keys. */
  key: string
}

export interface UseAblyInvalidateResult {
  /** Increments on each matching invalidate; pass into usePolling. */
  invalidateSignal: number
  /** True once Ably reports connected; drives slower poll fallback. */
  realtimeActive: boolean
}

function messageMatches(data: unknown, kind: KioskInvalidateKind, key: string): boolean {
  if (!data || typeof data !== 'object') return false
  const msg = data as KioskInvalidateMessage
  if (msg.kind !== kind) return false
  // No key on the message means "refresh every display on this channel".
  if (!msg.key) return true
  return msg.key === key
}

/**
 * Opens one Ably Realtime connection per mount when NEXT_PUBLIC_ABLY_ENABLED
 * is true. Closes on unmount. Auth via /api/ably-auth (token requests).
 */
export function useAblyInvalidate({
  kind,
  key,
}: UseAblyInvalidateOptions): UseAblyInvalidateResult {
  const [invalidateSignal, setInvalidateSignal] = useState(0)
  const [realtimeActive, setRealtimeActive] = useState(false)
  const enabled = isAblyClientEnabled()

  useEffect(() => {
    if (!enabled || !key) return

    let cancelled = false
    let client: RealtimeClient | null = null
    let channel: RealtimeChannel | null = null
    let onMessage: ((message: Message) => void) | null = null
    let onConnected: (() => void) | null = null
    let onNotConnected: (() => void) | null = null
    let onChannelState: (() => void) | null = null

    void import('ably/modular')
      .then(({ BaseRealtime, WebSocketTransport, FetchRequest }) => {
        if (cancelled) return
        // Ably's defaults already retry quietly (15s disconnected, 30s suspended).
        client = new BaseRealtime({
          authUrl: '/api/ably-auth',
          plugins: { WebSocketTransport, FetchRequest },
        })

        onConnected = () => {
          if (!cancelled) setRealtimeActive(channel?.state === 'attached')
        }
        onNotConnected = () => {
          if (!cancelled) setRealtimeActive(false)
        }

        client.connection.on('connected', onConnected)
        client.connection.on('disconnected', onNotConnected)
        client.connection.on('suspended', onNotConnected)
        client.connection.on('failed', onNotConnected)
        client.connection.on('closed', onNotConnected)

        channel = client.channels.get(ABLY_CHANNELS[kind])
        onChannelState = () => {
          if (!cancelled) {
            setRealtimeActive(
              client?.connection.state === 'connected' && channel?.state === 'attached',
            )
          }
        }
        channel.on(onChannelState)
        onMessage = (message: Message) => {
          if (cancelled) return
          if (!messageMatches(message.data, kind, key)) return
          setInvalidateSignal((n) => n + 1)
        }
        void channel.subscribe(ABLY_UPDATED_EVENT, onMessage).catch(() => {
          if (!cancelled) setRealtimeActive(false)
        })
      })
      .catch(() => {
        // Auth/config/network failures: leave realtimeActive false so polling
        // keeps the normal 10s/30s cadence.
        if (!cancelled) setRealtimeActive(false)
      })

    return () => {
      cancelled = true
      try {
        if (channel && onChannelState) channel.off(onChannelState)
        if (channel && onMessage) {
          channel.unsubscribe(ABLY_UPDATED_EVENT, onMessage)
        }
      } catch {
        // Channel may already be released.
      }
      if (client && onConnected && onNotConnected) {
        client.connection.off('connected', onConnected)
        client.connection.off('disconnected', onNotConnected)
        client.connection.off('suspended', onNotConnected)
        client.connection.off('failed', onNotConnected)
        client.connection.off('closed', onNotConnected)
        client.close()
      }
      setRealtimeActive(false)
    }
  }, [enabled, kind, key])

  return { invalidateSignal, realtimeActive: enabled ? realtimeActive : false }
}
