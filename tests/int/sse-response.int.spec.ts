/** A reader that disconnects must not make the stream's body fail mid-import. */
import { describe, expect, it } from 'vitest'
import { createSSEResponse } from '@/src/utils/sse-response'

describe('createSSEResponse', () => {
  it('ignores sends after the reader cancels, so the body runs to the end', async () => {
    let release = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    let finished: (outcome: string) => void = () => {}
    const outcome = new Promise<string>((resolve) => (finished = resolve))

    const response = createSSEResponse(async (send) => {
      await gate
      try {
        send('progress', { current: 1 })
        finished('completed')
      } catch (error) {
        finished(`threw: ${(error as Error).message}`)
      }
    })

    await response.body!.cancel()
    release()

    await expect(outcome).resolves.toBe('completed')
  })
})
