import { config } from '../config'
import { PipePaneTerminalProxy } from './PipePaneTerminalProxy'
import { PtyTerminalProxy } from './PtyTerminalProxy'
import type { ITerminalProxy, TerminalProxyOptions } from './types'

function resolveTerminalMode(): 'pty' | 'pipe-pane' {
  if (config.terminalMode === 'pipe-pane') {
    return 'pipe-pane'
  }
  if (config.terminalMode === 'pty') {
    return 'pty'
  }

  return process.stdin.isTTY ? 'pty' : 'pipe-pane'
}

function createTerminalProxy(options: TerminalProxyOptions): ITerminalProxy {
  const mode = resolveTerminalMode()
  return mode === 'pty'
    ? new PtyTerminalProxy(options)
    : new PipePaneTerminalProxy(options)
}

export { createTerminalProxy, resolveTerminalMode }
