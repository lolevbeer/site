/**
 * One-time Google sign-in for the nightly hours check (src/jobs/check-google-hours.ts).
 *
 *   node scripts/google-business-signin.mjs .env.local
 *
 * Reads GOOGLE_BUSINESS_CLIENT_ID and GOOGLE_BUSINESS_CLIENT_SECRET from that
 * env file, opens Google's consent page (sign in as a manager of the Business
 * Profiles), and appends GOOGLE_BUSINESS_REFRESH_TOKEN to the file. Prints no
 * secrets. Run it again, after removing that line, if Google revokes the sign-in.
 */
import { createServer } from 'node:http'
import { appendFileSync, readFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { parseEnv } from 'node:util'

const envFile = process.argv[2]
if (!envFile) throw new Error('Usage: node scripts/google-business-signin.mjs .env.local')

const env = parseEnv(readFileSync(envFile, 'utf8'))
const clientId = env.GOOGLE_BUSINESS_CLIENT_ID
const clientSecret = env.GOOGLE_BUSINESS_CLIENT_SECRET
if (!clientId || !clientSecret) {
  throw new Error(
    'Add GOOGLE_BUSINESS_CLIENT_ID and GOOGLE_BUSINESS_CLIENT_SECRET to the env file first.',
  )
}
if (env.GOOGLE_BUSINESS_REFRESH_TOKEN) {
  throw new Error(
    'GOOGLE_BUSINESS_REFRESH_TOKEN is already set; remove that line to sign in again.',
  )
}

const PORT = 53682
const redirect = `http://127.0.0.1:${PORT}`
const state = randomBytes(16).toString('hex')

/** Tell the browser tab and the terminal why sign-in failed, then stop. */
function fail(response, reason) {
  response
    .writeHead(400)
    .end(`Sign-in failed: ${reason}. Close this tab and run the command again.`)
  console.error(`Sign-in failed: ${reason}`)
  server.close()
  process.exitCode = 1
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, redirect)
  // Browsers also ask for /favicon.ico; only the redirect back from Google counts.
  if (url.pathname !== '/') return response.writeHead(404).end()

  const code = url.searchParams.get('code')
  if (url.searchParams.get('state') !== state) return fail(response, 'the reply did not match')
  if (!code) return fail(response, url.searchParams.get('error') ?? 'Google sent no code')

  let token
  try {
    const reply = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirect,
        grant_type: 'authorization_code',
      }),
    })
    token = await reply.json()
  } catch (error) {
    return fail(response, `could not reach Google (${error.message})`)
  }
  if (!token.refresh_token) {
    const reason = [token.error, token.error_description].filter(Boolean).join(': ')
    return fail(response, reason || 'Google returned no refresh token')
  }

  appendFileSync(envFile, `\nGOOGLE_BUSINESS_REFRESH_TOKEN=${token.refresh_token}\n`)
  response.writeHead(200).end('Signed in. You can close this tab.')
  console.log(`Saved GOOGLE_BUSINESS_REFRESH_TOKEN to ${envFile}`)
  server.close()
})

server.listen(PORT, '127.0.0.1', () => {
  const consent = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  consent.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/business.manage',
    access_type: 'offline',
    prompt: 'consent',
    state,
  }).toString()
  console.log('Sign in with a Google account that manages the Business Profiles, and approve.')
  console.log('If no browser opens, paste this address into one:')
  console.log(consent.toString())
  // `open` exists on macOS only; elsewhere the printed address is the way in.
  execFile('open', [consent.toString()], () => {})
})
