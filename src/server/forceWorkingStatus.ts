/**
 * Manages forced "working" status for sessions after Enter key press.
 * Prevents status flicker when Claude hasn't started outputting yet.
 */
import type { Session } from '../shared/types'

// Map of sessionId -> expiry timestamp
const forceWorkingUntil = new Map<string, number>()

/**
 * Set a session to forced "working" status until the expiry time.
 */
export function setForceWorkingUntil(sessionId: string, expiryMs: number): void {
  forceWorkingUntil.set(sessionId, expiryMs)
}

/**
 * Clear the forced "working" status for a session.
 */
export function clearForceWorking(sessionId: string): void {
  forceWorkingUntil.delete(sessionId)
}

/**
 * Check if a session has forced "working" status.
 */
export function hasForceWorking(sessionId: string, now = Date.now()): boolean {
  const expiry = forceWorkingUntil.get(sessionId)
  if (!expiry) return false
  if (now >= expiry) {
    forceWorkingUntil.delete(sessionId)
    return false
  }
  return true
}

/**
 * Apply forced "working" overrides to sessions.
 * If a session is within its force period, keep status as "working".
 */
export function applyForceWorkingOverrides(
  sessions: Session[],
  now = Date.now()
): Session[] {
  // Clean up expired entries
  for (const [sessionId, expiry] of forceWorkingUntil) {
    if (now >= expiry) {
      forceWorkingUntil.delete(sessionId)
    }
  }
  // Apply overrides
  return sessions.map((session) => {
    const expiry = forceWorkingUntil.get(session.id)
    if (expiry && now < expiry && session.status !== 'working') {
      return { ...session, status: 'working' as const }
    }
    return session
  })
}

/**
 * Clear all forced working statuses. Useful for testing.
 */
export function clearAllForceWorking(): void {
  forceWorkingUntil.clear()
}
