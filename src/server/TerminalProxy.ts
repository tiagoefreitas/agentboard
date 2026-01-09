import { spawn, type Subprocess } from 'bun'

interface TerminalCallbacks {
  onData: (data: string) => void
  onExit?: () => void
}

// Global registry of original window sizes - persists across terminal proxies
const originalSizes = new Map<string, { cols: number; rows: number }>()

export function restoreAllWindowSizes(): void {
  for (const [tmuxWindow, size] of originalSizes) {
    try {
      Bun.spawnSync([
        'tmux', 'resize-window', '-t', tmuxWindow,
        '-x', String(size.cols),
        '-y', String(size.rows)
      ])
    } catch {
      // Ignore errors
    }
  }
  originalSizes.clear()
}

export class TerminalProxy {
  private process: Subprocess | null = null
  private decoder = new TextDecoder()
  private buffer = ''

  constructor(
    private tmuxWindow: string,
    private callbacks: TerminalCallbacks
  ) {}

  private saveOriginalSize(): void {
    // Only save if we haven't already (don't overwrite with resized value)
    if (originalSizes.has(this.tmuxWindow)) return
    try {
      const result = Bun.spawnSync([
        'tmux', 'display-message', '-t', this.tmuxWindow, '-p', '#{window_width} #{window_height}'
      ])
      const output = result.stdout.toString().trim()
      const [cols, rows] = output.split(' ').map(Number)
      if (cols && rows) {
        originalSizes.set(this.tmuxWindow, { cols, rows })
      }
    } catch {
      // Ignore errors
    }
  }

  private restoreOriginalSize(): void {
    const size = originalSizes.get(this.tmuxWindow)
    if (!size) return
    try {
      Bun.spawnSync([
        'tmux', 'resize-window', '-t', this.tmuxWindow,
        '-x', String(size.cols),
        '-y', String(size.rows)
      ])
      originalSizes.delete(this.tmuxWindow)
    } catch {
      // Ignore errors
    }
  }

  start(): void {
    if (this.process) {
      return
    }

    // Save original size before we potentially resize
    this.saveOriginalSize()

    // Use tmux control mode (-C) for programmatic access
    // This doesn't require a real PTY
    const proc = spawn(
      ['tmux', '-C', 'attach', '-t', this.tmuxWindow],
      {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          ...process.env,
          TERM: 'xterm-256color',
        },
      }
    )

    this.process = proc

    this.readControlMode(proc.stdout)

    proc.exited.then(() => {
      this.callbacks.onExit?.()
    })

    // Request initial pane content after connecting
    setTimeout(() => {
      // Capture current pane content with ANSI escapes
      this.sendCommand(`capture-pane -t ${this.tmuxWindow} -p -e`)
      this.sendCommand('refresh-client')
    }, 100)
  }

  write(data: string): void {
    if (!this.process?.stdin) {
      return
    }

    // In control mode, we need to use send-keys
    // Escape special characters for tmux
    const escaped = data
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')

    this.sendCommand(`send-keys -t ${this.tmuxWindow} -l "${escaped}"`)
  }

  resize(cols: number, rows: number): void {
    // Resize tmux window to match web terminal
    this.sendCommand(`resize-window -t ${this.tmuxWindow} -x ${cols} -y ${rows}`)
    this.sendCommand(`capture-pane -t ${this.tmuxWindow} -p -e`)
  }

  dispose(): void {
    // Always try to restore original size, even if process is gone
    this.restoreOriginalSize()

    if (!this.process) {
      return
    }

    try {
      // Detach from tmux session before killing
      this.sendCommand('detach-client')
      // Give it a moment to detach cleanly
      setTimeout(() => {
        try {
          this.process?.kill()
        } catch {
          // Ignore if already exited
        }
        this.process = null
      }, 50)
    } catch {
      // Ignore if already exited
      this.process = null
    }
  }

  private sendCommand(cmd: string): void {
    const stdin = this.process?.stdin
    if (!stdin || typeof stdin === 'number') {
      return
    }
    stdin.write(cmd + '\n')
  }

  private async readControlMode(stream: ReadableStream<Uint8Array> | null) {
    if (!stream) {
      return
    }

    const reader = stream.getReader()
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }
      if (value) {
        this.buffer += this.decoder.decode(value)
        this.parseControlOutput()
      }
    }
  }

  private inCommandBlock = false
  private commandOutput = ''

  private parseControlOutput(): void {
    // Control mode outputs lines starting with % for notifications
    // %output <pane-id> <data> - output from pane
    // %begin, %end, %error - command responses
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() || '' // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith('%begin ')) {
        this.inCommandBlock = true
        this.commandOutput = ''
      } else if (line.startsWith('%end ')) {
        if (this.commandOutput) {
          this.callbacks.onData(this.commandOutput)
        }
        this.inCommandBlock = false
        this.commandOutput = ''
      } else if (line.startsWith('%error ')) {
        this.inCommandBlock = false
        this.commandOutput = ''
      } else if (this.inCommandBlock) {
        // Accumulate command output (e.g., from capture-pane)
        this.commandOutput += line + '\n'
      } else if (line.startsWith('%output ')) {
        // Format: %output %<pane-id> <base64-or-escaped-data>
        const match = line.match(/^%output %\d+ (.*)$/)
        if (match) {
          // The output is escaped, decode it
          const data = this.decodeOutput(match[1])
          this.callbacks.onData(data)
        }
      } else if (line.startsWith('%layout-change') || line.startsWith('%window-renamed')) {
        // Refresh on layout changes
        this.sendCommand('refresh-client')
      }
    }
  }

  private decodeOutput(data: string): string {
    // Control mode escapes special characters
    // Decode the escaped string
    return data
      .replace(/\\033/g, '\x1b')
      .replace(/\\015/g, '\r')
      .replace(/\\012/g, '\n')
      .replace(/\\\\/g, '\\')
  }
}
