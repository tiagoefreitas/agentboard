import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebglAddon } from 'xterm-addon-webgl'
import { ClipboardAddon } from '@xterm/addon-clipboard'
import type { ServerMessage } from '@shared/types'

interface UseTerminalOptions {
  sessionId: string | null
  sendMessage: (message: any) => void
  subscribe: (listener: (message: ServerMessage) => void) => () => void
}

export function useTerminal({
  sessionId,
  sendMessage,
  subscribe,
}: UseTerminalOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const webglAddonRef = useRef<WebglAddon | null>(null)
  const resizeTimer = useRef<number | null>(null)
  const sessionIdRef = useRef<string | null>(sessionId)

  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  useEffect(() => {
    if (!containerRef.current || terminalRef.current) {
      return
    }

    const terminal = new Terminal({
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      scrollback: 5000,
      cursorBlink: true,
      convertEol: true,
      theme: {
        background: '#171513',
        foreground: '#f6f2ec',
        cursor: '#f3b24f',
        selectionBackground: 'rgba(243, 178, 79, 0.3)',
      },
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(new ClipboardAddon())

    try {
      const webglAddon = new WebglAddon()
      terminal.loadAddon(webglAddon)
      webglAddonRef.current = webglAddon
    } catch {
      // WebGL addon is optional.
    }

    terminal.open(containerRef.current)
    fitAddon.fit()

    terminal.attachCustomKeyEventHandler((event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        if (terminal.hasSelection()) {
          const selection = terminal.getSelection()
          if (selection && navigator.clipboard) {
            void navigator.clipboard.writeText(selection)
          }
          return false
        }
      }
      return true
    })

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    const dispose = terminal.onData((data) => {
      const activeSession = sessionIdRef.current
      if (activeSession) {
        sendMessage({ type: 'terminal-input', sessionId: activeSession, data })
      }
    })

    return () => {
      dispose.dispose()
      // Dispose WebGL addon first to avoid cleanup race conditions
      if (webglAddonRef.current) {
        try {
          webglAddonRef.current.dispose()
        } catch {
          // Ignore errors during WebGL addon disposal
        }
        webglAddonRef.current = null
      }
      try {
        terminal.dispose()
      } catch {
        // Ignore errors during terminal disposal (can happen in React StrictMode)
      }
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [sendMessage])

  useEffect(() => {
    if (!terminalRef.current) {
      return
    }

    if (sessionId) {
      // Clear terminal completely before attaching to new session
      terminalRef.current.reset()
      terminalRef.current.clear()
      terminalRef.current.writeln(`\u001b[33mAttached to ${sessionId}\u001b[0m`)
      sendMessage({ type: 'terminal-attach', sessionId })
    }

    return () => {
      if (sessionId) {
        sendMessage({ type: 'terminal-detach', sessionId })
      }
      // Clear on detach too to prevent stale content showing
      if (terminalRef.current) {
        terminalRef.current.clear()
      }
    }
  }, [sendMessage, sessionId])

  useEffect(() => {
    if (!terminalRef.current || !sessionId) {
      return
    }

    const unsubscribe = subscribe((message) => {
      if (message.type === 'terminal-output' && message.sessionId === sessionId) {
        terminalRef.current?.write(message.data)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [sessionId, subscribe])

  useEffect(() => {
    if (!containerRef.current || !terminalRef.current || !fitAddonRef.current) {
      return
    }

    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current

    const handleResize = () => {
      if (resizeTimer.current) {
        window.clearTimeout(resizeTimer.current)
      }

      resizeTimer.current = window.setTimeout(() => {
        fitAddon.fit()
        if (sessionId) {
          sendMessage({
            type: 'terminal-resize',
            sessionId,
            cols: terminal.cols,
            rows: terminal.rows,
          })
        }
      }, 100)
    }

    const observer = new ResizeObserver(handleResize)
    observer.observe(containerRef.current)
    handleResize()

    return () => {
      observer.disconnect()
      if (resizeTimer.current) {
        window.clearTimeout(resizeTimer.current)
      }
    }
  }, [sendMessage, sessionId])

  return { containerRef }
}
