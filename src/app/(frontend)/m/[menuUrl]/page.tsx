import { cache } from 'react'
import { getMenuByUrlFresh } from '@/lib/utils/payload-api'
import { LiveMenu } from '@/components/menu/live-menu'
import { notFound } from 'next/navigation'
import { LIVE_DISPLAY_META, NOINDEX_ROBOTS, pageOpenGraph } from '@/lib/utils/seo'

/**
 * Cached menu fetch — deduplicates between generateMetadata and page render.
 */
const getCachedMenu = cache((url: string) => getMenuByUrlFresh(url))

interface MenuPageProps {
  params: Promise<{
    menuUrl: string
  }>
}

export default async function MenuPage({ params }: MenuPageProps) {
  const { menuUrl } = await params
  const menu = await getCachedMenu(menuUrl)

  if (!menu) {
    notFound()
  }

  // For unknown types, return 404
  if (menu.type !== 'draft' && menu.type !== 'cans' && menu.type !== 'other') {
    notFound()
  }

  // LiveMenu refreshes via optional Ably invalidate + polling fallback on the
  // cached /api/menu-stream endpoint (10s warm / 30s idle when Ably is off or
  // disconnected; 120s safety net while Ably is connected); see live-menu.tsx.
  return <LiveMenu menuUrl={menuUrl} initialMenu={menu} />
}

// Generate metadata
export async function generateMetadata({ params }: MenuPageProps) {
  const { menuUrl } = await params
  const menu = await getCachedMenu(menuUrl)

  if (!menu) {
    return {
      title: 'Menu Not Found',
      robots: NOINDEX_ROBOTS,
    }
  }

  const title = menu.name || `${menu.type} Menu`
  const description = menu.description || `View our ${menu.type} menu`
  return {
    title,
    description,
    robots: NOINDEX_ROBOTS,
    openGraph: pageOpenGraph(`${title} • Lolev Beer`, description),
    other: { [LIVE_DISPLAY_META]: 'ready' },
  }
}
