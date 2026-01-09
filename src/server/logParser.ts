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

interface CodexEntry {
  type?: string
  payload?: {
    type?: string
    role?: string
    content?: Array<{ type?: string }> | string
  }
}

export function parseLogLine(line: string): StatusEvent | null {
  const trimmed = line.trim()
  if (!trimmed) {
    return null
  }

  let entry: LogEntry & CodexEntry
  try {
    entry = JSON.parse(trimmed) as LogEntry & CodexEntry
  } catch {
    return null
  }

  if (entry.type === 'assistant' || entry.type === 'user') {
    return parseClaudeEntry(entry)
  }

  if (entry.type === 'event_msg' || entry.type === 'response_item') {
    return parseCodexEntry(entry)
  }

  return null
}

function parseClaudeEntry(entry: LogEntry): StatusEvent | null {
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

function parseCodexEntry(entry: CodexEntry): StatusEvent | null {
  const payload = entry.payload
  if (!payload || typeof payload !== 'object') {
    return null
  }

  if (entry.type === 'event_msg') {
    const eventType = typeof payload.type === 'string' ? payload.type : ''
    if (eventType === 'user_message') {
      return { type: 'user_prompt' }
    }
    if (eventType === 'agent_message') {
      return { type: 'turn_end' }
    }
    if (eventType === 'turn_aborted') {
      return { type: 'turn_end' }
    }
    return null
  }

  if (entry.type !== 'response_item') {
    return null
  }

  const payloadType = typeof payload.type === 'string' ? payload.type : ''
  if (payloadType === 'message') {
    if (payload.role === 'user') {
      return { type: 'user_prompt' }
    }
    if (payload.role === 'assistant') {
      return { type: 'turn_end' }
    }
  }

  if (payloadType.endsWith('_call')) {
    return { type: 'assistant_tool_use' }
  }

  if (payloadType.endsWith('_call_output')) {
    return { type: 'tool_result' }
  }

  return null
}
