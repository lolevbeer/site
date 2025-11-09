import { getMenuByUrl } from '@/lib/utils/payload-api'
import { FeaturedBeers } from '@/components/home/featured-beers'
import { FeaturedCans } from '@/components/home/featured-cans'
import { notFound } from 'next/navigation'

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

  // Render based on menu type
  if (menu.type === 'draft') {
    return (
      <div className="h-screen w-screen overflow-hidden flex flex-col">
        <FeaturedBeers menu={menu} />
      </div>
    )
  }

  if (menu.type === 'cans') {
    return (
      <div className="h-screen w-screen overflow-hidden flex flex-col">
        <FeaturedCans menu={menu} />
      </div>
    )
  }

  // For 'other' type or unknown
  return notFound()
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
