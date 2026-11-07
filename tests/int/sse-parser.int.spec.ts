/** SSE frames must survive being split across transport chunks at any line boundary. */
import { describe, expect, it, vi } from 'vitest'
import { parseSSEStream } from '@/lib/utils/sse-parser'

function streamOf(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(body)
}

describe('parseSSEStream', () => {
  it.each([
    ['in one chunk', ['event: complete\ndata: {"ok":true}\n\n']],
    ['split after the event line', ['event: complete\n', 'data: {"ok":true}\n\n']],
    ['split inside the data line', ['event: complete\ndata: {"o', 'k":true}\n\n']],
  ])('dispatches a frame delivered %s', async (_label, chunks) => {
    const complete = vi.fn()
    await parseSSEStream(streamOf(chunks), { complete })
    expect(complete).toHaveBeenCalledExactlyOnceWith({ ok: true })
  })
})
