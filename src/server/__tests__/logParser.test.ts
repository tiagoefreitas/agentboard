import { describe, expect, it } from 'bun:test'
import { parseLogLine } from '../logParser'

describe('parseLogLine', () => {
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
})
