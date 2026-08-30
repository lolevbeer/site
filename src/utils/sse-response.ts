/**
 * Server side of the Server-Sent Events protocol used by the admin import
 * endpoints. The client half lives in `lib/utils/sse-parser.ts`.
 *
 * Every long-running admin endpoint (distributor import, Lake Beverage CSV
 * import, re-geocoding, Untappd sync) streams progress the same way: wrap
 * a `ReadableStream`, encode `event:`/`data:` frames by hand, and return the
 * same three headers. That boilerplate was copied into each endpoint; it lives
 * here so the wire format is defined once and matches `parseSSEStream`.
 */

/** Emit one SSE frame: an event name plus a JSON payload. */
export type SSESend = (event: string, data: Record<string, unknown>) => void

/** Headers required for a response to be consumed as an SSE stream. */
const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const

/**
 * Build a streaming SSE `Response` driven by `body`.
 *
 * `body` receives a `send(event, data)` function and runs until it resolves;
 * the stream is then closed. Errors are the caller's to handle — an import that
 * wants to report a failure to the browser should catch it and `send` an
 * `error` event, exactly as it would have inside a hand-rolled stream.
 *
 * @example
 * ```ts
 * return createSSEResponse(async (send) => {
 *   send('progress', { current: 1, total: 10 })
 *   send('complete', { imported: 10 })
 * })
 * ```
 */
export function createSSEResponse(body: (send: SSESend) => Promise<void> | void): Response {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send: SSESend = (event, data) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      await body(send)
      controller.close()
    },
  })

  return new Response(stream, { headers: SSE_HEADERS })
}
