import { afterEach, describe, expect, test } from 'bun:test'
import type { Session } from '../../shared/types'
import {
  setForceWorkingUntil,
  clearForceWorking,
  hasForceWorking,
  applyForceWorkingOverrides,
  clearAllForceWorking,
} from '../forceWorkingStatus'

const createSession = (id: string, status: Session['status']): Session => ({
  id,
  name: id,
  tmuxWindow: `agentboard:${id}`,
  projectPath: `/tmp/${id}`,
  status,
  lastActivity: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  agentType: 'claude',
  source: 'managed',
})

describe('forceWorkingStatus', () => {
  afterEach(() => {
    clearAllForceWorking()
  })

  describe('setForceWorkingUntil', () => {
    test('sets forced working status for a session', () => {
      const now = Date.now()
      setForceWorkingUntil('session-1', now + 5000)

      expect(hasForceWorking('session-1', now)).toBe(true)
      expect(hasForceWorking('session-1', now + 4999)).toBe(true)
    })

    test('overwrites previous expiry', () => {
      const now = Date.now()
      setForceWorkingUntil('session-1', now + 1000)
      setForceWorkingUntil('session-1', now + 5000)

      expect(hasForceWorking('session-1', now + 2000)).toBe(true)
    })
  })

  describe('hasForceWorking', () => {
    test('returns false for unknown session', () => {
      expect(hasForceWorking('unknown')).toBe(false)
    })

    test('returns false after expiry', () => {
      const now = Date.now()
      setForceWorkingUntil('session-1', now + 1000)

      expect(hasForceWorking('session-1', now + 1000)).toBe(false)
      expect(hasForceWorking('session-1', now + 2000)).toBe(false)
    })

    test('cleans up expired entries', () => {
      const now = Date.now()
      setForceWorkingUntil('session-1', now + 1000)

      // First check after expiry cleans it up
      expect(hasForceWorking('session-1', now + 2000)).toBe(false)
      // Second check also returns false (entry was deleted)
      expect(hasForceWorking('session-1', now)).toBe(false)
    })
  })

  describe('clearForceWorking', () => {
    test('removes forced working status', () => {
      const now = Date.now()
      setForceWorkingUntil('session-1', now + 5000)
      expect(hasForceWorking('session-1', now)).toBe(true)

      clearForceWorking('session-1')
      expect(hasForceWorking('session-1', now)).toBe(false)
    })

    test('does nothing for unknown session', () => {
      clearForceWorking('unknown') // Should not throw
    })
  })

  describe('applyForceWorkingOverrides', () => {
    test('overrides waiting status to working during force period', () => {
      const now = Date.now()
      setForceWorkingUntil('session-1', now + 5000)

      const sessions = [
        createSession('session-1', 'waiting'),
        createSession('session-2', 'waiting'),
      ]

      const result = applyForceWorkingOverrides(sessions, now)

      expect(result[0]?.status).toBe('working')
      expect(result[1]?.status).toBe('waiting')
    })

    test('does not override already working status', () => {
      const now = Date.now()
      setForceWorkingUntil('session-1', now + 5000)

      const sessions = [createSession('session-1', 'working')]
      const result = applyForceWorkingOverrides(sessions, now)

      expect(result[0]?.status).toBe('working')
      // Should be same object reference since no change needed
      expect(result[0]).toBe(sessions[0])
    })

    test('does not override after expiry', () => {
      const now = Date.now()
      setForceWorkingUntil('session-1', now - 1000) // Already expired

      const sessions = [createSession('session-1', 'waiting')]
      const result = applyForceWorkingOverrides(sessions, now)

      expect(result[0]?.status).toBe('waiting')
    })

    test('overrides permission status to working during force period', () => {
      const now = Date.now()
      setForceWorkingUntil('session-1', now + 5000)

      const sessions = [createSession('session-1', 'permission')]
      const result = applyForceWorkingOverrides(sessions, now)

      expect(result[0]?.status).toBe('working')
    })

    test('cleans up expired entries', () => {
      const now = Date.now()
      setForceWorkingUntil('session-1', now - 1000) // Expired
      setForceWorkingUntil('session-2', now + 5000) // Active

      const sessions = [
        createSession('session-1', 'waiting'),
        createSession('session-2', 'waiting'),
      ]

      const result = applyForceWorkingOverrides(sessions, now)

      expect(result[0]?.status).toBe('waiting') // Expired, no override
      expect(result[1]?.status).toBe('working') // Active, override applied

      // session-1 should be cleaned up
      expect(hasForceWorking('session-1', now)).toBe(false)
    })

    test('preserves other session properties', () => {
      const now = Date.now()
      setForceWorkingUntil('session-1', now + 5000)

      const sessions = [createSession('session-1', 'waiting')]
      const result = applyForceWorkingOverrides(sessions, now)

      expect(result[0]?.id).toBe('session-1')
      expect(result[0]?.name).toBe('session-1')
      expect(result[0]?.tmuxWindow).toBe('agentboard:session-1')
      expect(result[0]?.projectPath).toBe('/tmp/session-1')
      expect(result[0]?.agentType).toBe('claude')
    })
  })
})
