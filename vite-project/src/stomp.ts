export function createStompFrame(command: string, headers: Record<string, string> = {}, body = '') {
  const headerText = Object.entries(headers)
    .map(([key, value]) => `${key}:${value}`)
    .join('\n')
  return `${command}\n${headerText}\n\n${body}\0`
}

export function parseStompMessages(data: string) {
  return data
    .split('\0')
    .map((frame) => {
      const separator = frame.indexOf('\n\n')
      if (separator === -1) return null
      const command = frame.slice(0, frame.indexOf('\n')).trim()
      const body = frame.slice(separator + 2).trim()
      return { command, body }
    })
    .filter(Boolean) as Array<{ command: string; body: string }>
}
