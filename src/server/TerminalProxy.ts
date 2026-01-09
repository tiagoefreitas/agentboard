import * as pty from 'node-pty'

interface TerminalCallbacks {
  onData: (data: string) => void
  onExit?: () => void
}

export class TerminalProxy {
  private ptyProcess: pty.IPty | null = null
  private cols = 80
  private rows = 24

  constructor(
    private tmuxWindow: string,
    private callbacks: TerminalCallbacks
  ) {}

  start(): void {
    if (this.ptyProcess) {
      return
    }

    const proc = pty.spawn('tmux', ['attach', '-t', this.tmuxWindow], {
      name: 'xterm-256color',
      cols: this.cols,
      rows: this.rows,
      cwd: process.cwd(),
      env: {
        ...process.env,
        TERM: 'xterm-256color',
      },
    })

    this.ptyProcess = proc

    proc.onData((data) => {
      this.callbacks.onData(data)
    })

    proc.onExit(() => {
      this.ptyProcess = null
      this.callbacks.onExit?.()
    })
  }

  write(data: string): void {
    if (!this.ptyProcess) {
      return
    }
    this.ptyProcess.write(data)
  }

  resize(cols: number, rows: number): void {
    this.cols = cols
    this.rows = rows

    if (this.ptyProcess) {
      try {
        this.ptyProcess.resize(cols, rows)
      } catch {
        // Ignore resize errors
      }
    }
  }

  dispose(): void {
    if (!this.ptyProcess) {
      return
    }

    try {
      this.ptyProcess.kill()
    } catch {
      // Ignore if already exited
    }
    this.ptyProcess = null
  }
}
