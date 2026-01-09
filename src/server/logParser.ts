import type { StatusEvent } from './statusMachine'

interface LogEntry {
  type?: string
  stop_reason?: string
  message?: {
    role?: string
    content?: string | Array<{ type?: string }>
    stop_reason?: string
  }
}

export function parseLogLine(line: string): StatusEvent | null {
  const trimmed = line.trim()
  if (!trimmed) {
    return null
  }

  let entry: LogEntry
  try {
    entry = JSON.parse(trimmed) as LogEntry
  } catch {
    return null
  }

  const message = entry.message
  const stopReason = entry.stop_reason ?? message?.stop_reason
  const content = message?.content
  const contentIsText = typeof content === 'string'
  const contentTypes = Array.isArray(content)
    ? content
        .map((block) => block?.type)
        .filter((type): type is string => Boolean(type))
    : []

  if (entry.type === 'assistant') {
    if (stopReason === 'tool_use' || contentTypes.includes('tool_use')) {
      return { type: 'assistant_tool_use' }
    }
    if (stopReason === 'end_turn') {
      return { type: 'turn_end' }
    }

    if (
      (contentIsText || contentTypes.includes('text')) &&
      !contentTypes.includes('tool_use')
    ) {
      return { type: 'turn_end' }
    }
  }

  if (entry.type === 'user') {
    if (Array.isArray(content)) {
      const hasToolResult = content.some(
        (block) => block && block.type === 'tool_result'
      )
      if (hasToolResult) {
        return { type: 'tool_result' }
      }
    }

    return { type: 'user_prompt' }
  }

  return null
}
