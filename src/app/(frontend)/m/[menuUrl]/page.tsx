import { cache } from 'react'
import { getMenuByUrlFresh } from '@/lib/utils/payload-api'
import { LiveMenu } from '@/components/menu/live-menu'
import { notFound } from 'next/navigation'
import { NOINDEX_ROBOTS } from '@/lib/utils/seo'

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

  // LiveMenu polls the cached /api/menu-stream endpoint (10s after a change,
  // 30s when idle) and swaps in new menu data; see components/menu/live-menu.tsx.
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

  return {
    title: menu.name || `${menu.type} Menu`,
    description: menu.description || `View our ${menu.type} menu`,
    robots: NOINDEX_ROBOTS,
  }
}
