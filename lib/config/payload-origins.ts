const LOCAL_DEV_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0'] as const
const DEFAULT_LOCAL_DEV_PORTS = ['3000', '3001', '3002'] as const

function isValidPort(port: string | undefined): port is string {
  if (!port || !/^\d+$/.test(port)) return false

  const portNumber = Number(port)
  return portNumber > 0 && portNumber <= 65535
}

export function getLocalDevOrigins(runtimePort?: string): string[] {
  const ports = new Set<string>(DEFAULT_LOCAL_DEV_PORTS)

  if (isValidPort(runtimePort)) {
    ports.add(runtimePort)
  }

  return Array.from(ports).flatMap((port) =>
    LOCAL_DEV_HOSTS.map((host) => `http://${host}:${port}`),
  )
}
