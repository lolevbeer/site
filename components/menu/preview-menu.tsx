'use client'

/**
 * The draft menu board shown in the admin's live preview pane (#376).
 *
 * Payload posts the editor's unsaved form data to this page; useLivePreview
 * merges it into the menu and fetches newly picked beers and products through
 * the REST API with the viewer's session cookie, so access rules still apply.
 * Unlike LiveMenu it never polls the public stream, which only has the
 * published menu.
 */
import { useLivePreview } from '@payloadcms/live-preview-react'
import { MenuBoard } from '@/components/menu/live-menu'
import { getMenuTheme } from '@/lib/utils/display-theme'
import type { Menu } from '@/src/payload-types'

export function PreviewMenu({ initialMenu }: { initialMenu: Menu }) {
  const { data } = useLivePreview<Menu>({
    initialData: initialMenu,
    // The admin frames this page from the same origin; the hook only reads
    // this in an effect, so the empty server value is never used.
    serverURL: typeof window === 'undefined' ? '' : window.location.origin,
    depth: 3,
  })

  return <MenuBoard menu={data} theme={getMenuTheme(data)} />
}
