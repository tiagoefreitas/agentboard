import { useState, useCallback, useEffect, useRef } from 'react'
import type { Session } from '@shared/types'
import type { ConnectionStatus } from '../stores/sessionStore'
import { useTerminal } from '../hooks/useTerminal'
import { useThemeStore, terminalThemes } from '../stores/themeStore'
import TerminalControls from './TerminalControls'
import TerminalTextOverlay from './TerminalTextOverlay'

interface TerminalProps {
  session: Session | null
  sessions: Session[]
  connectionStatus: ConnectionStatus
  sendMessage: (message: any) => void
  subscribe: (listener: any) => () => void
  onClose: () => void
  onSelectSession: (sessionId: string) => void
  pendingApprovals: number
}

const statusText: Record<Session['status'], string> = {
  working: 'Working',
  needs_approval: 'Approval',
  waiting: 'Waiting',
  unknown: 'Unknown',
}

const statusClass: Record<Session['status'], string> = {
  working: 'text-working',
  needs_approval: 'text-approval',
  waiting: 'text-waiting',
  unknown: 'text-muted',
}

export default function Terminal({
  session,
  sessions,
  connectionStatus,
  sendMessage,
  subscribe,
  onClose,
  onSelectSession,
  pendingApprovals,
}: TerminalProps) {
  const theme = useThemeStore((state) => state.theme)
  const terminalTheme = terminalThemes[theme]
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [showTextOverlay, setShowTextOverlay] = useState(false)
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('terminal-font-size')
    return saved ? parseInt(saved, 10) : 13
  })
  const lastTouchY = useRef<number | null>(null)
  const accumulatedDelta = useRef<number>(0)
  const lastTapTime = useRef<number>(0)
  const tapTimeout = useRef<number | null>(null)
  const longPressTimer = useRef<number | null>(null)

  const adjustFontSize = useCallback((delta: number) => {
    setFontSize((prev) => {
      const newSize = Math.max(8, Math.min(24, prev + delta))
      localStorage.setItem('terminal-font-size', String(newSize))
      return newSize
    })
  }, [])

  const { containerRef, terminalRef } = useTerminal({
    sessionId: session?.id ?? null,
    sendMessage,
    subscribe,
    theme: terminalTheme,
    fontSize,
    onScrollChange: (isAtBottom) => {
      setShowScrollButton(!isAtBottom)
    },
  })

  const scrollToBottom = useCallback(() => {
    terminalRef.current?.scrollToBottom()
  }, [terminalRef])

  // Touch scroll + double-tap/long-press detection for text selection (iOS-like)
  // Single tap (after confirming not double-tap) focuses terminal for keyboard input
  useEffect(() => {
    const container = containerRef.current
    if (!container || !session) return

    // Check if mobile
    const isMobile = window.matchMedia('(max-width: 767px)').matches
    if (!isMobile) return

    // Don't handle touch when text overlay is shown
    if (showTextOverlay) return

    const DOUBLE_TAP_DELAY = 500 // ms between taps
    const LONG_PRESS_DELAY = 500 // ms to trigger long press
    const TAP_MOVE_THRESHOLD = 10 // pixels - if moved more, it's not a tap

    let touchStartPos = { x: 0, y: 0 }
    let hasMoved = false
    let longPressTriggered = false

    // Get textarea and keep it disabled to prevent auto-focus
    const textarea = container.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement | null
    if (textarea) {
      textarea.setAttribute('disabled', 'true')
    }

    const activateOverlay = () => {
      if ('vibrate' in navigator) {
        navigator.vibrate(10)
      }
      setShowTextOverlay(true)
    }

    const focusTerminalInput = () => {
      // Enable, focus, then re-disable on blur
      if (textarea) {
        textarea.removeAttribute('disabled')
        textarea.focus()

        const handleBlur = () => {
          textarea.setAttribute('disabled', 'true')
          textarea.removeEventListener('blur', handleBlur)
        }
        textarea.addEventListener('blur', handleBlur)
      }
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        hasMoved = false
        longPressTriggered = false
        lastTouchY.current = e.touches[0].clientY
        accumulatedDelta.current = 0

        // Start long-press timer
        longPressTimer.current = window.setTimeout(() => {
          if (!hasMoved) {
            longPressTriggered = true
            activateOverlay()
          }
        }, LONG_PRESS_DELAY)
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1 || lastTouchY.current === null) return

      const x = e.touches[0].clientX
      const y = e.touches[0].clientY

      // Check if moved beyond tap threshold
      const dx = Math.abs(x - touchStartPos.x)
      const dy = Math.abs(y - touchStartPos.y)
      if (dx > TAP_MOVE_THRESHOLD || dy > TAP_MOVE_THRESHOLD) {
        hasMoved = true
        // Cancel long-press if moved
        if (longPressTimer.current) {
          window.clearTimeout(longPressTimer.current)
          longPressTimer.current = null
        }
      }

      const deltaY = lastTouchY.current - y
      lastTouchY.current = y

      accumulatedDelta.current += deltaY
      const threshold = 30 // pixels per scroll event
      const scrollEvents = Math.trunc(accumulatedDelta.current / threshold)

      if (scrollEvents !== 0) {
        // Send mouse wheel escape sequences (SGR mode)
        const button = scrollEvents < 0 ? 64 : 65
        const count = Math.abs(scrollEvents)
        const cols = terminalRef.current?.cols ?? 80
        const rows = terminalRef.current?.rows ?? 24
        const col = Math.floor(cols / 2)
        const row = Math.floor(rows / 2)

        for (let i = 0; i < count; i++) {
          sendMessage({
            type: 'terminal-input',
            sessionId: session.id,
            data: `\x1b[<${button};${col};${row}M`
          })
        }
        accumulatedDelta.current -= scrollEvents * threshold
      }
    }

    const handleTouchEnd = () => {
      // Cancel long-press timer
      if (longPressTimer.current) {
        window.clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }

      lastTouchY.current = null
      accumulatedDelta.current = 0

      // Skip if long-press already triggered overlay
      if (longPressTriggered) return

      // Only count as tap if didn't move much
      if (hasMoved) return

      const now = Date.now()
      const timeSinceLastTap = now - lastTapTime.current

      if (timeSinceLastTap < DOUBLE_TAP_DELAY) {
        // Double tap detected - show text selection overlay
        if (tapTimeout.current) {
          window.clearTimeout(tapTimeout.current)
          tapTimeout.current = null
        }
        activateOverlay()
        lastTapTime.current = 0
      } else {
        // First tap - wait to see if second tap comes
        // If no second tap, focus terminal for keyboard input
        lastTapTime.current = now
        tapTimeout.current = window.setTimeout(() => {
          lastTapTime.current = 0
          // Single tap confirmed - focus terminal for keyboard input
          focusTerminalInput()
        }, DOUBLE_TAP_DELAY)
      }
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: true })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      if (tapTimeout.current) {
        window.clearTimeout(tapTimeout.current)
      }
      if (longPressTimer.current) {
        window.clearTimeout(longPressTimer.current)
      }
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      // Re-enable textarea on cleanup
      if (textarea) {
        textarea.removeAttribute('disabled')
      }
    }
  }, [session, sendMessage, containerRef, terminalRef, showTextOverlay])

  const handleSendKey = useCallback(
    (key: string) => {
      if (!session) return
      sendMessage({ type: 'terminal-input', sessionId: session.id, data: key })
    },
    [session, sendMessage]
  )

  const hasSession = Boolean(session)

  return (
    <section
      className={`flex flex-1 flex-col bg-base ${hasSession ? 'terminal-mobile-overlay md:relative md:inset-auto' : 'hidden md:flex'}`}
      data-testid="terminal-panel"
    >
      {/* Terminal header - only show when session selected */}
      {session && (
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-elevated px-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="btn py-1 text-[11px] md:hidden"
            >
              Back
            </button>
            <span className="text-sm font-medium text-primary">
              {session.name}
            </span>
            <span className={`text-xs ${statusClass[session.status]}`}>
              {statusText[session.status]}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {pendingApprovals > 0 && (
              <span className="flex items-center gap-1.5 rounded bg-approval/20 px-2 py-0.5 text-xs font-medium text-approval md:hidden">
                {pendingApprovals} pending
              </span>
            )}
            {connectionStatus !== 'connected' && (
              <span className="text-xs text-approval">
                {connectionStatus}
              </span>
            )}
            {/* Font size controls - mobile only */}
            <div className="flex items-center gap-1 md:hidden">
              <button
                onClick={() => adjustFontSize(-1)}
                className="flex h-7 w-7 items-center justify-center rounded bg-surface border border-border text-secondary active:bg-hover"
                title="Decrease font size"
              >
                <span className="text-sm font-bold">−</span>
              </button>
              <button
                onClick={() => adjustFontSize(1)}
                className="flex h-7 w-7 items-center justify-center rounded bg-surface border border-border text-secondary active:bg-hover"
                title="Increase font size"
              >
                <span className="text-sm font-bold">+</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminal content - always rendered so ref is attached */}
      <div className="relative flex-1">
        <div ref={containerRef} className="absolute inset-0" />
        {!session && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
            Select a session to view terminal
          </div>
        )}

        {/* Text overlay for native iOS text selection */}
        {showTextOverlay && terminalRef.current && (
          <TerminalTextOverlay
            terminal={terminalRef.current}
            fontSize={fontSize}
            onDismiss={() => setShowTextOverlay(false)}
          />
        )}

        {/* Scroll to bottom button */}
        {showScrollButton && session && !showTextOverlay && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface border border-border shadow-lg hover:bg-hover transition-colors"
            title="Scroll to bottom"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-secondary"
            >
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Mobile control strip */}
      {session && (
        <TerminalControls
          onSendKey={handleSendKey}
          disabled={connectionStatus !== 'connected'}
          sessions={sessions.map(s => ({ id: s.id, name: s.name, status: s.status }))}
          currentSessionId={session.id}
          onSelectSession={onSelectSession}
        />
      )}
    </section>
  )
}
