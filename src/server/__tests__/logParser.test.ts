import { describe, expect, it } from 'bun:test'
import { parseLogLine } from '../logParser'

describe('parseLogLine', () => {
  it('returns null for blank lines', () => {
    expect(parseLogLine('   ')).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(parseLogLine('{not-json')).toBeNull()
  })

  it('detects tool use from stop_reason', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { stop_reason: 'tool_use', content: [] },
    })
    expect(parseLogLine(line)).toEqual({ type: 'assistant_tool_use' })
  })

  it('detects tool use from content blocks', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'tool_use' }] },
    })
    expect(parseLogLine(line)).toEqual({ type: 'assistant_tool_use' })
  })

  it('detects turn_end from stop_reason', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { stop_reason: 'end_turn', content: [{ type: 'text' }] },
    })
    expect(parseLogLine(line)).toEqual({ type: 'turn_end' })
  })

  it('treats assistant text as turn_end when stop_reason is missing', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'text' }] },
    })
    expect(parseLogLine(line)).toEqual({ type: 'turn_end' })
  })

  it('treats assistant string content as turn_end', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: 'hello' },
    })
    expect(parseLogLine(line)).toEqual({ type: 'turn_end' })
  })

  it('detects tool_result in user content blocks', () => {
    const line = JSON.stringify({
      type: 'user',
      message: { content: [{ type: 'tool_result' }] },
    })
    expect(parseLogLine(line)).toEqual({ type: 'tool_result' })
  })

  it('treats user string content as user_prompt', () => {
    const line = JSON.stringify({
      type: 'user',
      message: { content: 'hello' },
    })
    expect(parseLogLine(line)).toEqual({ type: 'user_prompt' })
  })

  it('treats user array content without tool_result as user_prompt', () => {
    const line = JSON.stringify({
      type: 'user',
      message: { content: [{ type: 'text' }] },
    })
    expect(parseLogLine(line)).toEqual({ type: 'user_prompt' })
  })

  it('returns null for unknown entry types', () => {
    const line = JSON.stringify({
      type: 'system',
      message: { content: 'hello' },
    })
    expect(parseLogLine(line)).toBeNull()
  })

  it('returns null for assistant entries without recognizable content', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'image' }] },
    })
    expect(parseLogLine(line)).toBeNull()
  })

  it('returns null for codex events without payload', () => {
    const line = JSON.stringify({ type: 'event_msg' })
    expect(parseLogLine(line)).toBeNull()
  })

  it('returns null for codex events with unknown type', () => {
    const line = JSON.stringify({
      type: 'event_msg',
      payload: { type: 'unknown_event' },
    })
    expect(parseLogLine(line)).toBeNull()
  })

  it('detects codex user_message events', () => {
    const line = JSON.stringify({
      type: 'event_msg',
      payload: { type: 'user_message', message: 'hi' },
    })
    expect(parseLogLine(line)).toEqual({ type: 'user_prompt' })
  })

  it('detects codex agent_message events', () => {
    const line = JSON.stringify({
      type: 'event_msg',
      payload: { type: 'agent_message', message: 'done' },
    })
    expect(parseLogLine(line)).toEqual({ type: 'turn_end' })
  })

  it('detects codex aborted turns as turn_end', () => {
    const line = JSON.stringify({
      type: 'event_msg',
      payload: { type: 'turn_aborted' },
    })
    expect(parseLogLine(line)).toEqual({ type: 'turn_end' })
  })

  it('detects codex response message roles', () => {
    const userLine = JSON.stringify({
      type: 'response_item',
      payload: { type: 'message', role: 'user', content: [] },
    })
    expect(parseLogLine(userLine)).toEqual({ type: 'user_prompt' })

    const assistantLine = JSON.stringify({
      type: 'response_item',
      payload: { type: 'message', role: 'assistant', content: [] },
    })
    expect(parseLogLine(assistantLine)).toEqual({ type: 'turn_end' })
  })

  it('detects codex tool calls and outputs', () => {
    const callLine = JSON.stringify({
      type: 'response_item',
      payload: { type: 'function_call', name: 'exec_command' },
    })
    expect(parseLogLine(callLine)).toEqual({ type: 'assistant_tool_use' })

    const outputLine = JSON.stringify({
      type: 'response_item',
      payload: { type: 'function_call_output', call_id: 'call_123' },
    })
    expect(parseLogLine(outputLine)).toEqual({ type: 'tool_result' })
  })

  it('returns null for codex response items with unknown payload types', () => {
    const line = JSON.stringify({
      type: 'response_item',
      payload: { type: 'metadata', role: 'assistant' },
    })
    expect(parseLogLine(line)).toBeNull()
  })
})
