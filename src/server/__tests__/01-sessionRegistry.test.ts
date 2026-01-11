import { describe, expect, test } from 'bun:test'
import { SessionRegistry } from '../SessionRegistry'
import type { Session } from '../../shared/types'

const baseSession: Session = {
  id: 'session-1',
  name: 'alpha',
  tmuxWindow: 'agentboard:1',
  projectPath: '/Users/example/project',
  status: 'waiting',
  lastActivity: new Date('2024-01-01T00:00:00.000Z').toISOString(),
  createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
  source: 'managed',
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return { ...baseSession, ...overrides }
}

describe('SessionRegistry', () => {
  test('replaceSessions keeps latest activity and emits removals', () => {
    const registry = new SessionRegistry()
    const sessionsEvents: Session[][] = []
    const removedIds: string[] = []

    registry.on('sessions', (sessions) => sessionsEvents.push(sessions))
    registry.on('session-removed', (sessionId) => removedIds.push(sessionId))

    const latest = makeSession({
      id: 'alpha',
      lastActivity: new Date('2024-02-02T00:00:00.000Z').toISOString(),
    })
    const toRemove = makeSession({
      id: 'bravo',
      lastActivity: new Date('2024-02-01T00:00:00.000Z').toISOString(),
    })

    registry.replaceSessions([latest, toRemove])

    const olderUpdate = makeSession({
      id: 'alpha',
      lastActivity: new Date('2023-01-01T00:00:00.000Z').toISOString(),
    })
    registry.replaceSessions([olderUpdate])

    const stored = registry.get('alpha')
    expect(stored?.lastActivity).toBe(latest.lastActivity)
    expect(removedIds).toEqual(['bravo'])
    expect(sessionsEvents).toHaveLength(2)
  })

  test('updateSession merges updates and emits event', () => {
    const registry = new SessionRegistry()
    const updates: Session[] = []
    registry.on('session-update', (session) => updates.push(session))

    const session = makeSession({ id: 'delta', name: 'delta' })
    registry.replaceSessions([session])

    const result = registry.updateSession('delta', {
      status: 'working',
      name: 'renamed',
    })

    expect(result?.status).toBe('working')
    expect(registry.get('delta')?.name).toBe('renamed')
    expect(updates).toHaveLength(1)
    expect(updates[0]?.name).toBe('renamed')
  })

  test('updateSession returns undefined when missing', () => {
    const registry = new SessionRegistry()
    const updates: Session[] = []
    registry.on('session-update', (session) => updates.push(session))

    const result = registry.updateSession('missing', { status: 'working' })
    expect(result).toBeUndefined()
    expect(updates).toHaveLength(0)
  })

  test('replaceSessions skips session emit when data is unchanged', () => {
    const registry = new SessionRegistry()
    const sessionsEvents: Session[][] = []

    registry.on('sessions', (sessions) => sessionsEvents.push(sessions))

    const session = makeSession({ id: 'alpha' })
    registry.replaceSessions([session])
    registry.replaceSessions([session])

    expect(sessionsEvents).toHaveLength(1)
  })
})
