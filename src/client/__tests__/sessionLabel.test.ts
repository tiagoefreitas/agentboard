import { describe, expect, test } from 'bun:test'
import type { Session } from '@shared/types'
import { formatCommandLabel, getDisambiguatedProjectNames, getPathLeaf } from '../utils/sessionLabel'

const baseSession: Session = {
  id: 'test-session',
  name: 'test',
  tmuxWindow: 'agentboard:1',
  projectPath: '/Users/example/project',
  status: 'unknown',
  lastActivity: new Date(0).toISOString(),
  createdAt: new Date(0).toISOString(),
  source: 'managed',
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return { ...baseSession, ...overrides }
}

describe('formatCommandLabel', () => {
  test('uses agent type and cwd leaf', () => {
    const label = formatCommandLabel(
      makeSession({ agentType: 'claude', projectPath: '/Users/me/app' })
    )
    expect(label).toBe('claude / app')
  })

  test('falls back to command when agent type is missing', () => {
    const label = formatCommandLabel(
      makeSession({
        agentType: undefined,
        command: 'bun',
        projectPath: '/Users/me/app',
      })
    )
    expect(label).toBe('bun / app')
  })

  test('shows directory when no command is available', () => {
    const label = formatCommandLabel(
      makeSession({
        agentType: undefined,
        command: '',
        projectPath: '/Users/me/app',
      })
    )
    expect(label).toBe('app')
  })

  test('returns null when no label parts exist', () => {
    const label = formatCommandLabel(
      makeSession({
        agentType: undefined,
        command: '',
        projectPath: '   ',
      })
    )
    expect(label).toBeNull()
  })
})

describe('getPathLeaf', () => {
  test('handles trailing slashes', () => {
    expect(getPathLeaf('/Users/me/project/')).toBe('project')
  })

  test('handles Windows separators', () => {
    expect(getPathLeaf('C:\\Users\\me\\project')).toBe('project')
  })

  test('returns null for empty or root-only paths', () => {
    expect(getPathLeaf('   ')).toBeNull()
    expect(getPathLeaf('/')).toBeNull()
    expect(getPathLeaf('\\\\')).toBeNull()
  })
})

describe('getDisambiguatedProjectNames', () => {
  test('uses leaf names when unique', () => {
    const map = getDisambiguatedProjectNames(['/work/api', '/work/web'])
    expect(map.get('/work/api')).toBe('api')
    expect(map.get('/work/web')).toBe('web')
  })

  test('disambiguates duplicate leaf names', () => {
    const map = getDisambiguatedProjectNames([
      '/work/api',
      '/personal/api',
      '/work/tools/api',
    ])
    expect(map.get('/work/api')).toBe('work/api')
    expect(map.get('/personal/api')).toBe('personal/api')
    expect(map.get('/work/tools/api')).toBe('tools/api')
  })

  test('falls back to full path when still ambiguous', () => {
    const map = getDisambiguatedProjectNames(['/foo', 'foo'])
    expect(map.get('/foo')).toBe('/foo')
    expect(map.get('foo')).toBe('foo')
  })
})
