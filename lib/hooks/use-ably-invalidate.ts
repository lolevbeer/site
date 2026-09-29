'use client'

/**
 * Subscribe to Ably kiosk invalidate channels and bump a signal when a
 * matching "updated" message arrives. Used by menu/events stream hooks so
 * displays can poll immediately on CMS edits while keeping polling as the
 * fallback when Ably is disabled or disconnected.
 */

import { useEffect, useRef, useState } from 'react'
import Ably from 'ably'

import {
  ABLY_CHANNELS,
  ABLY_UPDATED_EVENT,
  type AblyChannelName,
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

function channelForKind(kind: KioskInvalidateKind): AblyChannelName {
  return kind === 'menu' ? ABLY_CHANNELS.menu : ABLY_CHANNELS.events
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
  // Keep the latest key without restarting the connection on every render.
  const keyRef = useRef(key)
  const kindRef = useRef(kind)
  useEffect(() => {
    keyRef.current = key
    kindRef.current = kind
  })

  useEffect(() => {
    if (!enabled || !key) return

    let cancelled = false
    const client = new Ably.Realtime({
      authUrl: '/api/ably-auth',
      authMethod: 'GET',
      // Kiosk TVs stay open for hours; let Ably reconnect quietly.
      disconnectedRetryTimeout: 15_000,
      suspendedRetryTimeout: 30_000,
    })

    const onConnected = () => {
      if (!cancelled) setRealtimeActive(true)
    }
    const onNotConnected = () => {
      if (!cancelled) setRealtimeActive(false)
    }

    client.connection.on('connected', onConnected)
    client.connection.on('disconnected', onNotConnected)
    client.connection.on('suspended', onNotConnected)
    client.connection.on('failed', onNotConnected)
    client.connection.on('closed', onNotConnected)

    const channel = client.channels.get(channelForKind(kind))
    const onMessage = (message: Ably.Message) => {
      if (cancelled) return
      if (!messageMatches(message.data, kindRef.current, keyRef.current)) return
      setInvalidateSignal((n) => n + 1)
    }
    void channel.subscribe(ABLY_UPDATED_EVENT, onMessage)

    return () => {
      cancelled = true
      try {
        channel.unsubscribe(ABLY_UPDATED_EVENT, onMessage)
      } catch {
        // Channel may already be released.
      }
      client.connection.off('connected', onConnected)
      client.connection.off('disconnected', onNotConnected)
      client.connection.off('suspended', onNotConnected)
      client.connection.off('failed', onNotConnected)
      client.connection.off('closed', onNotConnected)
      client.close()
      setRealtimeActive(false)
    }
  }, [enabled, kind, key])

  return { invalidateSignal, realtimeActive: enabled ? realtimeActive : false }
}
