import { NextRequest } from 'next/server'
import { getMenuByUrl } from '@/lib/utils/payload-api'
import crypto from 'crypto'

/**
 * Generate hash from menu data to detect changes
 */
function generateHash(menu: { updatedAt?: string; items?: unknown[] }): string {
  const content = `${menu.updatedAt || ''}-${menu.items?.length || 0}`
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 16)
}

/**
 * SSE endpoint for real-time menu updates
 *
 * Uses Server-Sent Events to push menu updates to clients.
 * Vercel Edge has a 30s timeout, so clients auto-reconnect.
 * This is much more efficient than polling for many displays.
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

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial menu data
      try {
        const menu = await getMenuByUrl(url)
        if (!menu) {
          controller.enqueue(encoder.encode(`event: error\ndata: {"error": "Menu not found"}\n\n`))
          controller.close()
          return
        }

        lastHash = generateHash(menu)
        controller.enqueue(encoder.encode(`event: menu\ndata: ${JSON.stringify(menu)}\n\n`))

        // Poll for changes every 5 seconds (server-side, not client requests)
        const checkForUpdates = async () => {
          if (!isActive) return

          try {
            const currentMenu = await getMenuByUrl(url)
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
            setTimeout(checkForUpdates, 5000)
          }
        }

        // Start checking for updates after initial send
        setTimeout(checkForUpdates, 5000)

      } catch (error) {
        console.error('SSE start error:', error)
        controller.enqueue(encoder.encode(`event: error\ndata: {"error": "Internal server error"}\n\n`))
        controller.close()
      }
    },
    cancel() {
      isActive = false
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
