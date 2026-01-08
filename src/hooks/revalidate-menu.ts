import type { CollectionAfterChangeHook } from 'payload'
import type { Menu } from '@/src/payload-types'

/**
 * After a menu is changed, trigger cache revalidation
 * This calls our Next.js revalidation endpoint to invalidate cached menu data
 */
export const revalidateMenuCache: CollectionAfterChangeHook<Menu> = async ({
  doc,
  operation,
}) => {
  // Only revalidate on create/update, not on read
  if (operation === 'create' || operation === 'update') {
    const menuUrl = doc.url

    // Call the revalidation endpoint
    // Use internal URL in production, localhost in development
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const revalidateUrl = `${baseUrl}/api/revalidate/menu`

    try {
      const response = await fetch(revalidateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-revalidate-token': process.env.REVALIDATE_SECRET || '',
        },
        body: JSON.stringify({ menuUrl }),
      })

      if (!response.ok) {
        console.error('Menu revalidation failed:', await response.text())
      }
    } catch (error) {
      // Don't block the save operation if revalidation fails
      console.error('Menu revalidation error:', error)
    }
  }

  return doc
}
