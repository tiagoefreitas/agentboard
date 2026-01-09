import { describe, expect, it } from 'bun:test'
import { transitionStatus, type StatusEvent } from '../statusMachine'

describe('statusMachine', () => {
  it('moves from unknown to idle on log_found', () => {
    expect(transitionStatus('unknown', { type: 'log_found' })).toBe('idle')
  })

  it('marks tool use as needs_approval', () => {
    expect(transitionStatus('working', { type: 'assistant_tool_use' })).toBe(
      'needs_approval'
    )
  })

  it('marks user prompts as working', () => {
    expect(transitionStatus('idle', { type: 'user_prompt' })).toBe('working')
  })

  it('marks tool results as working', () => {
    expect(transitionStatus('waiting', { type: 'tool_result' })).toBe('working')
  })

  it('falls back to current state for unknown events', () => {
    const event = { type: 'unknown' } as unknown as StatusEvent
    expect(transitionStatus('idle', event)).toBe('idle')
  })

  it('keeps needs_approval during idle timeout', () => {
    expect(transitionStatus('needs_approval', { type: 'idle_timeout' })).toBe(
      'needs_approval'
    )
  })

  it('turn_end moves to waiting', () => {
    expect(transitionStatus('working', { type: 'turn_end' })).toBe('waiting')
  })
})
