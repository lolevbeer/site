/**
 * Authentication utilities for checking Payload CMS user authentication
 */

import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import config from '@/src/payload.config'

/**
 * Check if the current user is authenticated
 * Uses Payload's cookie-based authentication
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const payload = await getPayload({ config })
    const cookieStore = await cookies()

    // Get the payload-token cookie
    const token = cookieStore.get('payload-token')

    if (!token?.value) {
      return false
    }

    // Create a proper Headers object for Payload
    const headers = new Headers()
    headers.set('cookie', `payload-token=${token.value}`)

    // Verify the token by attempting to get the current user
    const { user } = await payload.auth({ headers })

    return !!user
  } catch (error) {
    // If verification fails, user is not authenticated
    console.error('❌ Auth verification failed:', error)
    return false
  }
}
