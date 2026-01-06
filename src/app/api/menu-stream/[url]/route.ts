import { NextRequest } from 'next/server'
import { getMenuByUrlFresh } from '@/lib/utils/payload-api'
import crypto from 'crypto'

// Poll interval in milliseconds (2 seconds for near-instant updates)
const POLL_INTERVAL_MS = 2000

// In dev mode, close connections after 30s to prevent blocking compilation
const DEV_TIMEOUT_MS = 30000
const isDev = process.env.NODE_ENV === 'development'

/**
 * Generate hash from menu data to detect changes
 * Includes updatedAt, item count, and item IDs/prices for comprehensive change detection
 */
function generateHash(menu: {
  updatedAt?: string
  items?: Array<{
    id?: string | null
    product?: { relationTo: string; value: unknown }
    price?: string | null
  }>
}): string {
  // Build a content string from all relevant data
  const itemsHash = (menu.items || [])
    .map(item => {
      // Extract product ID from the polymorphic relation
      const productValue = item.product?.value
      const productId = typeof productValue === 'object' && productValue !== null
        ? (productValue as { id?: string }).id
        : productValue
      return `${item.id || ''}-${productId || ''}-${item.price || ''}`
    })
    .join('|')

  const content = `${menu.updatedAt || ''}-${menu.items?.length || 0}-${itemsHash}`
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 16)
}

/**
 * SSE endpoint for real-time menu updates
 *
 * Uses Server-Sent Events to push menu updates to clients.
 * Vercel Edge has a 30s timeout, so clients auto-reconnect.
 * This is much more efficient than polling for many displays.
 *
 * Uses uncached getMenuByUrlFresh for immediate updates when content changes.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ url: string }> }
) {
  const { url } = await params

  // Check for SSE support
  const accept = request.headers.get('Accept')
  if (!accept?.includes('text/event-stream')) {
    return new Response('SSE not supported', { status: 400 })
  }

  const encoder = new TextEncoder()
  let lastHash = ''
  let isActive = true
  let devTimeout: NodeJS.Timeout | null = null

  const stream = new ReadableStream({
    async start(controller) {
      // In dev mode, auto-close after timeout to prevent blocking compilation
      if (isDev) {
        devTimeout = setTimeout(() => {
          if (isActive) {
            isActive = false
            controller.enqueue(encoder.encode(`event: reconnect\ndata: {"reason": "dev-timeout"}\n\n`))
            controller.close()
          }
        }, DEV_TIMEOUT_MS)
      }

      // Send initial menu data
      try {
        const menu = await getMenuByUrlFresh(url)
        if (!menu) {
          controller.enqueue(encoder.encode(`event: error\ndata: {"error": "Menu not found"}\n\n`))
          controller.close()
          return
        }

        lastHash = generateHash(menu)
        controller.enqueue(encoder.encode(`event: menu\ndata: ${JSON.stringify(menu)}\n\n`))

        // Poll for changes (server-side polling with uncached queries)
        const checkForUpdates = async () => {
          if (!isActive) return

          try {
            const currentMenu = await getMenuByUrlFresh(url)
            if (!currentMenu) return

            const currentHash = generateHash(currentMenu)
            if (currentHash !== lastHash) {
              lastHash = currentHash
              controller.enqueue(encoder.encode(`event: menu\ndata: ${JSON.stringify(currentMenu)}\n\n`))
            }

            // Send heartbeat to keep connection alive
            controller.enqueue(encoder.encode(`: heartbeat\n\n`))
          } catch (error) {
            console.error('SSE update check error:', error)
          }

          // Schedule next check if still active
          if (isActive) {
            setTimeout(checkForUpdates, POLL_INTERVAL_MS)
          }
        }

        // Start checking for updates after initial send
        setTimeout(checkForUpdates, POLL_INTERVAL_MS)

      } catch (error) {
        console.error('SSE start error:', error)
        controller.enqueue(encoder.encode(`event: error\ndata: {"error": "Internal server error"}\n\n`))
        controller.close()
      }
    },
    cancel() {
      isActive = false
      if (devTimeout) clearTimeout(devTimeout)
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  })
}
