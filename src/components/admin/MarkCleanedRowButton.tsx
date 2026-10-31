'use client'

/**
 * "Mark cleaned" button on a needs-attention lines row. Records today's line
 * cleaning as the signed-in user (lib/admin/mark-lines-cleaned), toasts the
 * result and refreshes the dashboard so the row drops off. The widget renders
 * it only for viewers who may update the location.
 */
import type React from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, toast } from '@payloadcms/ui'
import { markLinesCleaned } from '@/lib/admin/mark-lines-cleaned'
import { logger } from '@/lib/utils/logger'

export function MarkCleanedRowButton({
  locationId,
  rowTitle,
}: {
  locationId: string
  /** The row's title, e.g. 'Clean draft lines · Zelienople', for the accessible name. */
  rowTitle: string
}): React.JSX.Element {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function handleClick(): Promise<void> {
    setSaving(true)
    try {
      await markLinesCleaned(locationId)
      toast.success('Lines marked cleaned')
      router.refresh()
    } catch (error) {
      logger.error('Failed to mark lines cleaned:', error)
      toast.error('Lines were not marked cleaned. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Button
      buttonStyle="secondary"
      size="medium"
      margin={false}
      disabled={saving}
      onClick={() => void handleClick()}
      aria-label={`Mark cleaned: ${rowTitle}`}
      type="button"
    >
      Mark cleaned
    </Button>
  )
}
