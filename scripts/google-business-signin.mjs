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

const envFile = process.argv[2]
if (!envFile) throw new Error('Usage: node scripts/google-business-signin.mjs .env.local')

const env = Object.fromEntries(
  readFileSync(envFile, 'utf8')
    .split('\n')
    .filter((line) => /^[A-Z0-9_]+=/.test(line))
    .map((line) => {
      const at = line.indexOf('=')
      return [
        line.slice(0, at),
        line
          .slice(at + 1)
          .trim()
          .replace(/^["']|["']$/g, ''),
      ]
    }),
)
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

const server = createServer(async (request, response) => {
  const url = new URL(request.url, redirect)
  const code = url.searchParams.get('code')
  if (!code || url.searchParams.get('state') !== state) {
    response
      .writeHead(400)
      .end('Sign-in was not completed. Close this tab and run the command again.')
    return
  }
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
  const token = await reply.json()
  if (!token.refresh_token) {
    response.writeHead(500).end('Google returned no refresh token. See the terminal.')
    console.error(
      'Google returned no refresh token:',
      token.error ?? 'unknown',
      token.error_description ?? '',
    )
    process.exit(1)
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
  console.log('Opening Google sign-in. Choose ted@lolev.beer and approve.')
  console.log(consent.toString())
  execFile('open', [consent.toString()])
})
