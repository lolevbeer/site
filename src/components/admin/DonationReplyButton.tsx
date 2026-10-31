'use client'

/**
 * Sidebar "Email requester" button on a donation request. Opens the staff
 * member's own email app with the requester's address and a summary of the
 * request filled in (see lib/donate/reply-mailto). Nothing is sent from the
 * site, so the conversation lives in that inbox.
 */

import type React from 'react'
import { Button, useFormFields } from '@payloadcms/ui'
import { reduceFieldsToValues } from 'payload/shared'
import { donationReplyMailto } from '@/lib/donate/reply-mailto'

export function DonationReplyButton(): React.JSX.Element | null {
  // Reads the form, not the saved doc, so unsaved edits show in the draft email.
  const href = useFormFields(([fields]) => donationReplyMailto(reduceFieldsToValues(fields)))
  if (!href) return null

  return (
    <Button el="anchor" url={href} buttonStyle="secondary" size="medium">
      Email requester
    </Button>
  )
}
