import type { Payload, PayloadRequest } from 'payload'

/**
 * Get authenticated user from request.
 * Fallback for when req.user isn't populated by Payload middleware.
 */
export async function getUserFromRequest(req: PayloadRequest, payload: Payload) {
  const cookies = req.headers.get('cookie')
  const tokenMatch = cookies?.match(/payload-token=([^;]+)/)
  const token = tokenMatch?.[1]

  if (!token) return null

  try {
    const payloadPart = token.split('.')[1]
    const decoded = JSON.parse(Buffer.from(payloadPart, 'base64').toString())

    // Check expiration
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return null
    }

    if (decoded.id && decoded.collection === 'users') {
      return await payload.findByID({
        collection: 'users',
        id: decoded.id,
      })
    }
  } catch {
    return null
  }

  return null
}
