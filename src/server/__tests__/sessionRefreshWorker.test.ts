import { afterEach, describe, expect, test } from 'bun:test'
import type { RefreshWorkerRequest, RefreshWorkerResponse } from '../sessionRefreshWorker'
import type { Session } from '../../shared/types'

const bunAny = Bun as typeof Bun & { spawnSync: typeof Bun.spawnSync }
const originalSpawnSync = bunAny.spawnSync

const globalAny = globalThis as unknown as {
  self?: DedicatedWorkerGlobalScope | undefined
}
const originalSelf = globalAny.self

let messages: RefreshWorkerResponse[] = []
let ctx: DedicatedWorkerGlobalScope

async function loadWorker(tag: string) {
  messages = []
  ctx = {
    postMessage: (message: RefreshWorkerResponse) => {
      messages.push(message)
    },
  } as DedicatedWorkerGlobalScope
  globalAny.self = ctx
  await import(`../sessionRefreshWorker?${tag}`)
  if (!ctx.onmessage) {
    throw new Error('Worker did not register onmessage handler')
  }
  return ctx
}

function emitMessage(payload: RefreshWorkerRequest) {
  ctx.onmessage?.({ data: payload } as MessageEvent<RefreshWorkerRequest>)
}

function getLastResponse() {
  const response = messages[messages.length - 1]
  if (!response) {
    throw new Error('Missing worker response')
  }
  return response
}

afterEach(() => {
  bunAny.spawnSync = originalSpawnSync
  if (globalAny.self === ctx) {
    globalAny.self = originalSelf
  }
})

describe('sessionRefreshWorker', () => {
  test('refresh filters windows and infers session metadata', async () => {
    await loadWorker('refresh-filter')

    const listOutput = [
      'agentboard\t1\talpha\t/Users/test/project\t100\t1700000000\tcodex --search\t80\t24',
      'agentboard-ws-foo\t2\tws\t/Users/test/ws\t100\t1700000001\tbash\t80\t24',
      'external-session\t3\text\t/Users/test/ext\t100\t1700000002\tclaude\t100\t40',
      'other\t4\tother\t/Users/test/other\t100\t1700000003\tbash\t80\t24',
    ].join('\n')

    const captureOutputs = new Map<string, string>([
      ['agentboard:1', 'ready'],
      ['external-session:3', 'waiting'],
    ])

    bunAny.spawnSync = ((args: string[]) => {
      if (args[0] === 'tmux' && args[1] === 'list-windows') {
        return {
          exitCode: 0,
          stdout: Buffer.from(listOutput),
          stderr: Buffer.from(''),
        } as ReturnType<typeof Bun.spawnSync>
      }
      if (args[0] === 'tmux' && args[1] === 'capture-pane') {
        const targetIndex = args.indexOf('-t')
        const target = targetIndex >= 0 ? args[targetIndex + 1] : ''
        const output = captureOutputs.get(target ?? '')
        if (output === undefined) {
          return {
            exitCode: 1,
            stdout: Buffer.from(''),
            stderr: Buffer.from('missing'),
          } as ReturnType<typeof Bun.spawnSync>
        }
        return {
          exitCode: 0,
          stdout: Buffer.from(output),
          stderr: Buffer.from(''),
        } as ReturnType<typeof Bun.spawnSync>
      }
      return {
        exitCode: 0,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
      } as ReturnType<typeof Bun.spawnSync>
    }) as typeof Bun.spawnSync

    emitMessage({
      id: '1',
      kind: 'refresh',
      managedSession: 'agentboard',
      discoverPrefixes: ['external-'],
    })

    const response = getLastResponse()
    if (response.type !== 'result' || response.kind !== 'refresh') {
      throw new Error('Unexpected response type')
    }

    expect(response.sessions).toHaveLength(2)

    const managed = response.sessions.find(
      (session) => session.tmuxWindow === 'agentboard:1'
    )
    const external = response.sessions.find(
      (session) => session.tmuxWindow === 'external-session:3'
    )

    expect(managed).toEqual(
      expect.objectContaining({
        name: 'alpha',
        source: 'managed',
        status: 'waiting',
        agentType: 'codex',
      })
    )
    expect(external).toEqual(
      expect.objectContaining({
        name: 'external-session',
        source: 'external',
        status: 'waiting',
        agentType: 'claude',
      })
    )
  })

  test('refresh falls back when tmux format is unsupported', async () => {
    await loadWorker('format-fallback')

    const listOutput = [
      'agentboard\t1\talpha\t/Users/test/project\t100\t1700000000\tcodex\t80\t24',
    ].join('\n')

    let listCalls = 0

    bunAny.spawnSync = ((args: string[]) => {
      if (args[0] === 'tmux' && args[1] === 'list-windows') {
        listCalls += 1
        if (listCalls === 1) {
          return {
            exitCode: 1,
            stdout: Buffer.from(''),
            stderr: Buffer.from('unknown variable'),
          } as ReturnType<typeof Bun.spawnSync>
        }
        return {
          exitCode: 0,
          stdout: Buffer.from(listOutput),
          stderr: Buffer.from(''),
        } as ReturnType<typeof Bun.spawnSync>
      }
      if (args[0] === 'tmux' && args[1] === 'capture-pane') {
        return {
          exitCode: 0,
          stdout: Buffer.from('ready'),
          stderr: Buffer.from(''),
        } as ReturnType<typeof Bun.spawnSync>
      }
      return {
        exitCode: 0,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
      } as ReturnType<typeof Bun.spawnSync>
    }) as typeof Bun.spawnSync

    emitMessage({
      id: '1',
      kind: 'refresh',
      managedSession: 'agentboard',
      discoverPrefixes: [],
    })

    const response = getLastResponse()
    if (response.type !== 'result' || response.kind !== 'refresh') {
      throw new Error('Unexpected response type')
    }

    expect(response.sessions).toHaveLength(1)
    expect(listCalls).toBe(2)
  })

  test('last-user-message returns the latest prompt', async () => {
    await loadWorker('last-user-message')

    bunAny.spawnSync = ((args: string[]) => {
      if (args[0] === 'tmux' && args[1] === 'capture-pane') {
        return {
          exitCode: 0,
          stdout: Buffer.from('❯ First message\nok\n❯ Second message\n'),
          stderr: Buffer.from(''),
        } as ReturnType<typeof Bun.spawnSync>
      }
      return {
        exitCode: 0,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
      } as ReturnType<typeof Bun.spawnSync>
    }) as typeof Bun.spawnSync

    emitMessage({
      id: '1',
      kind: 'last-user-message',
      tmuxWindow: 'agentboard:1',
    })

    const response = getLastResponse()
    if (response.type !== 'result' || response.kind !== 'last-user-message') {
      throw new Error('Unexpected response type')
    }

    expect(response.message).toBe('Second message')
  })

  test('refresh responds with error on tmux failure', async () => {
    await loadWorker('refresh-error')

    bunAny.spawnSync = ((args: string[]) => {
      if (args[0] === 'tmux' && args[1] === 'list-windows') {
        return {
          exitCode: 1,
          stdout: Buffer.from(''),
          stderr: Buffer.from('boom'),
        } as ReturnType<typeof Bun.spawnSync>
      }
      return {
        exitCode: 0,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
      } as ReturnType<typeof Bun.spawnSync>
    }) as typeof Bun.spawnSync

    emitMessage({
      id: '1',
      kind: 'refresh',
      managedSession: 'agentboard',
      discoverPrefixes: [],
    })

    const response = getLastResponse()
    expect(response.type).toBe('error')
    if (response.type === 'error') {
      expect(response.error).toContain('boom')
    }
  })

  test('status changes track content updates and permission prompts', async () => {
    const originalNow = Date.now
    let now = 1_700_000_000_000
    Date.now = () => now

    try {
      await loadWorker('status-changes')

      const listOutput = [
        'agentboard\t1\talpha\t/Users/test/project\t100\t1700000000\tcodex\t80\t24',
      ].join('\n')

      const captureSequence = [
        'idle',
        'idle',
        'new output',
        'Do you want to proceed? [Y/n]',
      ]
      let captureIndex = 0

      bunAny.spawnSync = ((args: string[]) => {
        if (args[0] === 'tmux' && args[1] === 'list-windows') {
          return {
            exitCode: 0,
            stdout: Buffer.from(listOutput),
            stderr: Buffer.from(''),
          } as ReturnType<typeof Bun.spawnSync>
        }
        if (args[0] === 'tmux' && args[1] === 'capture-pane') {
          const output = captureSequence[captureIndex] ?? ''
          captureIndex += 1
          return {
            exitCode: 0,
            stdout: Buffer.from(output),
            stderr: Buffer.from(''),
          } as ReturnType<typeof Bun.spawnSync>
        }
        return {
          exitCode: 0,
          stdout: Buffer.from(''),
          stderr: Buffer.from(''),
        } as ReturnType<typeof Bun.spawnSync>
      }) as typeof Bun.spawnSync

      const runRefresh = () => {
        emitMessage({
          id: `refresh-${now}`,
          kind: 'refresh',
          managedSession: 'agentboard',
          discoverPrefixes: [],
        })
        const response = getLastResponse()
        if (response.type !== 'result' || response.kind !== 'refresh') {
          throw new Error('Unexpected response type')
        }
        return response.sessions[0] as Session
      }

      const first = runRefresh()
      const firstActivity = Date.parse(first.lastActivity)
      expect(first.status).toBe('waiting')

      // Advance past the grace period (4000ms) to trigger "waiting" on unchanged content
      now += 5000
      const second = runRefresh()
      const secondActivity = Date.parse(second.lastActivity)
      expect(second.status).toBe('waiting')
      expect(secondActivity).toBe(firstActivity)

      now += 1000
      const third = runRefresh()
      const thirdActivity = Date.parse(third.lastActivity)
      expect(third.status).toBe('working')
      expect(thirdActivity).toBe(now)

      now += 1000
      const fourth = runRefresh()
      const fourthActivity = Date.parse(fourth.lastActivity)
      expect(fourth.status).toBe('working')
      expect(fourthActivity).toBe(now)
    } finally {
      Date.now = originalNow
    }
  })

  test('status skips grace-period working on first observation', async () => {
    const originalNow = Date.now
    const originalGraceEnv = process.env.AGENTBOARD_WORKING_GRACE_MS
    process.env.AGENTBOARD_WORKING_GRACE_MS = '4000'
    let now = 1_700_000_000_000
    Date.now = () => now

    try {
      await loadWorker('status-first-observation')

      const listOutput = [
        'agentboard\t1\talpha\t/Users/test/project\t100\t1700000000\tcodex\t80\t24',
      ].join('\n')

      const captureSequence = ['idle', 'idle']
      let captureIndex = 0

      bunAny.spawnSync = ((args: string[]) => {
        if (args[0] === 'tmux' && args[1] === 'list-windows') {
          return {
            exitCode: 0,
            stdout: Buffer.from(listOutput),
            stderr: Buffer.from(''),
          } as ReturnType<typeof Bun.spawnSync>
        }
        if (args[0] === 'tmux' && args[1] === 'capture-pane') {
          const output = captureSequence[captureIndex] ?? ''
          captureIndex += 1
          return {
            exitCode: 0,
            stdout: Buffer.from(output),
            stderr: Buffer.from(''),
          } as ReturnType<typeof Bun.spawnSync>
        }
        return {
          exitCode: 0,
          stdout: Buffer.from(''),
          stderr: Buffer.from(''),
        } as ReturnType<typeof Bun.spawnSync>
      }) as typeof Bun.spawnSync

      const runRefresh = () => {
        emitMessage({
          id: `refresh-${now}`,
          kind: 'refresh',
          managedSession: 'agentboard',
          discoverPrefixes: [],
        })
        const response = getLastResponse()
        if (response.type !== 'result' || response.kind !== 'refresh') {
          throw new Error('Unexpected response type')
        }
        return response.sessions[0] as Session
      }

      const first = runRefresh()
      const firstActivity = Date.parse(first.lastActivity)
      expect(first.status).toBe('waiting')

      now += 1000
      const second = runRefresh()
      const secondActivity = Date.parse(second.lastActivity)
      expect(second.status).toBe('waiting')
      expect(secondActivity).toBe(firstActivity)
    } finally {
      Date.now = originalNow
      if (originalGraceEnv === undefined) {
        delete process.env.AGENTBOARD_WORKING_GRACE_MS
      } else {
        process.env.AGENTBOARD_WORKING_GRACE_MS = originalGraceEnv
      }
    }
  })
})
