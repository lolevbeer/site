import { getMenuByUrl } from '@/lib/utils/payload-api'
import { LiveMenu } from '@/components/menu/live-menu'
import { notFound } from 'next/navigation'

// ISR: Revalidate every minute as fallback for initial page load
// SSE handles real-time updates after hydration
export const revalidate = 60

interface MenuPageProps {
  params: Promise<{
    menuUrl: string
  }>
}

export default async function MenuPage({ params }: MenuPageProps) {
  const { menuUrl } = await params
  const menu = await getMenuByUrl(menuUrl)

  if (!menu) {
    notFound()
  }

  // For 'other' type or unknown, return 404
  if (menu.type !== 'draft' && menu.type !== 'cans') {
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
  const menu = await getMenuByUrl(menuUrl)

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
