/**
 * Utility for parsing Server-Sent Events (SSE) streams
 * Extracts event types and JSON data from streaming responses
 */

export type SSEHandlers = Record<string, (data: unknown) => void>

export interface SSEParseOptions {
  /** Called when an error occurs during parsing */
  onError?: (error: Error) => void
}

/**
 * Parse a Server-Sent Events stream and dispatch to handlers
 *
 * @param response - The fetch Response object with SSE stream
 * @param handlers - Object mapping event names to handler functions
 * @param options - Optional configuration
 *
 * @example
 * ```ts
 * await parseSSEStream(response, {
 *   status: (data) => console.log('Status:', data.message),
 *   progress: (data) => updateProgress(data.percent),
 *   complete: (data) => setResults(data),
 *   error: (data) => showError(data.message),
 * })
 * ```
 */
export async function parseSSEStream(
  response: Response,
  handlers: SSEHandlers,
  options?: SSEParseOptions
): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body available for SSE parsing')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Split on newlines, keeping incomplete lines in buffer
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      let currentEvent = ''
      let currentData = ''

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7)
        } else if (line.startsWith('data: ')) {
          currentData = line.slice(6)

          if (currentEvent && currentData) {
            try {
              const data = JSON.parse(currentData)
              const handler = handlers[currentEvent]
              if (handler) {
                handler(data)
              }
            } catch (parseError) {
              // JSON parse errors are expected for malformed data, ignore silently
              options?.onError?.(parseError as Error)
            }

            // Reset for next event
            currentEvent = ''
            currentData = ''
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Check if a response is a streaming SSE response vs JSON error
 */
export function isSSEResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type') || ''
  return (
    contentType.includes('text/event-stream') ||
    (!contentType.includes('application/json') && response.ok)
  )
}
