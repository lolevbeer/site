/** Validates server-only configuration before Payload or operational probes consume it. */

export interface ServerEnvironment {
  databaseUri: string
  payloadSecret: string
  blobReadWriteToken: string | undefined
}

export class ServerEnvironmentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ServerEnvironmentError'
  }
}

function required(name: string, env: NodeJS.ProcessEnv): string {
  const value = env[name]?.trim()

  if (!value) {
    throw new ServerEnvironmentError(`Missing required server environment variable: ${name}`)
  }

  return value
}

export function readServerEnvironment(env: NodeJS.ProcessEnv = process.env): ServerEnvironment {
  const databaseUri = required('DATABASE_URI', env)
  const payloadSecret = required('PAYLOAD_SECRET', env)

  if (payloadSecret === 'YOUR_SECRET_HERE') {
    throw new ServerEnvironmentError('Invalid server environment variable: PAYLOAD_SECRET')
  }

  const blobReadWriteToken = env.BLOB_READ_WRITE_TOKEN?.trim() || undefined
  if (env.VERCEL_ENV === 'production' && !blobReadWriteToken) {
    throw new ServerEnvironmentError(
      'Missing required server environment variable: BLOB_READ_WRITE_TOKEN',
    )
  }

  const slackSigningSecret = env.SLACK_SIGNING_SECRET?.trim()
  const slackBotToken = env.SLACK_BOT_TOKEN?.trim()
  if (Boolean(slackSigningSecret) !== Boolean(slackBotToken)) {
    throw new ServerEnvironmentError(
      'SLACK_SIGNING_SECRET and SLACK_BOT_TOKEN must be configured together',
    )
  }

  return { databaseUri, payloadSecret, blobReadWriteToken }
}
