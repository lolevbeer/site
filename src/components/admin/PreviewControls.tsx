'use client'

/**
 * Preview controls for the Beer and Menu edit pages (#376).
 *
 * Payload 4's own preview button is a link icon that only copies the preview
 * URL. This keeps that copy icon and adds a second icon button, styled like it
 * and the live preview toggle, that opens the public page in a new tab.
 *
 * Shows nothing until the document has a preview URL (saved, with a slug/url).
 */
import { Button, NewTabIcon, PreviewButton, useLivePreviewContext } from '@payloadcms/ui'

export function PreviewControls() {
  const { previewURL } = useLivePreviewContext()

  if (!previewURL) return null

  return (
    <>
      <PreviewButton />
      <Button
        aria-label="Open preview"
        buttonStyle="ghost"
        el="anchor"
        icon={<NewTabIcon size={24} />}
        id="open-preview"
        newTab
        tooltip="Open preview"
        url={previewURL}
      />
    </>
  )
}
