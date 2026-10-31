'use client'

/**
 * Sidebar "Email requester" button on a donation request. Opens the staff
 * member's own email app with the requester's address and a summary of the
 * request filled in (see lib/donate/reply-mailto). Nothing is sent from the
 * site, so the conversation lives in that inbox.
 */

import { Button, useFormFields } from '@payloadcms/ui'
import { donationReplyMailto } from '@/lib/donate/reply-mailto'

export function DonationReplyButton() {
  // Reads the form, not the saved doc, so unsaved edits show in the draft email.
  const href = useFormFields(([fields]) => {
    const value = (path: string) => fields[path]?.value as never
    return donationReplyMailto({
      email: value('email'),
      contactName: value('contactName'),
      organizationName: value('organizationName'),
      askType: value('askType'),
      eventName: value('eventName'),
      eventDate: value('eventDate'),
      attendees: value('attendees'),
      venue: value('venue'),
      taproom: value('taproom'),
      requestDetails: value('requestDetails'),
    })
  })
  if (!href) return null

  return (
    <Button el="anchor" url={href} buttonStyle="secondary" size="medium">
      Email requester
    </Button>
  )
}
