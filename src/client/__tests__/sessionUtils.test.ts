import { describe, expect, test } from 'bun:test'
import type { AgentSession, Session } from '@shared/types'
import { getUniqueProjects } from '../utils/sessions'

const baseSession: Session = {
  id: 'session-1',
  name: 'alpha',
  tmuxWindow: 'agentboard:1',
  projectPath: '/tmp/alpha',
  status: 'working',
  lastActivity: '2024-01-01T00:00:00.000Z',
  createdAt: '2024-01-01T00:00:00.000Z',
  source: 'managed',
}

const baseInactive: AgentSession = {
  sessionId: 'inactive-1',
  logFilePath: '/tmp/log.jsonl',
  projectPath: '/tmp/alpha',
  agentType: 'claude',
  displayName: 'alpha',
  createdAt: '2024-01-01T00:00:00.000Z',
  lastActivityAt: '2024-01-01T00:00:00.000Z',
  isActive: false,
}

function makeSession(overrides: Partial<Session>): Session {
  return { ...baseSession, ...overrides }
}

function makeInactive(overrides: Partial<AgentSession>): AgentSession {
  return { ...baseInactive, ...overrides }
}

describe('getUniqueProjects', () => {
  test('dedupes and sorts project paths', () => {
    const sessions = [
      makeSession({ id: 'a', projectPath: '/tmp/beta' }),
      makeSession({ id: 'b', projectPath: '/tmp/alpha' }),
      makeSession({ id: 'c', projectPath: '/tmp/alpha' }),
    ]
    const inactive = [
      makeInactive({ sessionId: 'inactive-2', projectPath: '/tmp/charlie' }),
      makeInactive({ sessionId: 'inactive-3', projectPath: '/tmp/beta' }),
    ]

    expect(getUniqueProjects(sessions, inactive)).toEqual([
      '/tmp/alpha',
      '/tmp/beta',
      '/tmp/charlie',
    ])
  })

  test('ignores empty project paths', () => {
    const sessions = [
      makeSession({ id: 'empty', projectPath: '   ' }),
    ]
    const inactive = [
      makeInactive({ sessionId: 'empty-inactive', projectPath: '' }),
    ]

    expect(getUniqueProjects(sessions, inactive)).toEqual([])
  })
})
