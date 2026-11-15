/**
 * Staff-only draft view of a menu board (#376). Payload's live preview pane
 * frames this page beside the Menu editor; it is the one page allowed inside a
 * same-origin frame (see vercel.json and next.config.mjs).
 *
 * The menu is read as the signed-in viewer, so anonymous visitors get a 404 and
 * menu access rules decide who sees the draft. The public board is
 * /m/[menuUrl], which only ever shows the published menu.
 */
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { PreviewMenu } from '@/components/menu/preview-menu'
import { getDraftMenuForViewer } from '@/lib/utils/payload-api'
import { NOINDEX_ROBOTS } from '@/lib/utils/seo'

export const metadata = { title: 'Menu preview', robots: NOINDEX_ROBOTS }

export default async function MenuPreviewPage({
  params,
}: {
  params: Promise<{ menuUrl: string }>
}) {
  const { menuUrl } = await params
  const menu = await getDraftMenuForViewer(menuUrl, await headers())

  if (!menu) notFound()

  return <PreviewMenu initialMenu={menu} />
}
