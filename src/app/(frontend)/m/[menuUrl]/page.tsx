import { getMenuByUrlFresh } from '@/lib/utils/payload-api'
import { LiveMenu } from '@/components/menu/live-menu'
import { notFound } from 'next/navigation'

// Use ISR with 60s revalidation for initial load performance
// SSE handles real-time updates after hydration, so stale initial data is fine
export const revalidate = 60

interface MenuPageProps {
  params: Promise<{
    menuUrl: string
  }>
}

export default async function MenuPage({ params }: MenuPageProps) {
  const { menuUrl } = await params
  const menu = await getMenuByUrlFresh(menuUrl)

  if (!menu) {
    notFound()
  }

  // For unknown types, return 404
  if (menu.type !== 'draft' && menu.type !== 'cans' && menu.type !== 'other') {
    notFound()
  }

  // Use LiveMenu for real-time updates via SSE
  // - Single persistent connection per display
  // - Updates within 5 seconds of Payload changes
  // - Auto-reconnects if connection drops
  return <LiveMenu menuUrl={menuUrl} initialMenu={menu} />
}

// Generate metadata
export async function generateMetadata({ params }: MenuPageProps) {
  const { menuUrl } = await params
  const menu = await getMenuByUrlFresh(menuUrl)

  if (!menu) {
    return {
      title: 'Menu Not Found',
    }
  }

  return {
    title: menu.name || `${menu.type} Menu`,
    description: menu.description || `View our ${menu.type} menu`,
  }
}
