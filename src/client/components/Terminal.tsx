import type { Session } from '@shared/types'
import type { ConnectionStatus } from '../stores/sessionStore'
import { useTerminal } from '../hooks/useTerminal'
import { useThemeStore, terminalThemes } from '../stores/themeStore'

interface TerminalProps {
  session: Session | null
  connectionStatus: ConnectionStatus
  sendMessage: (message: any) => void
  subscribe: (listener: any) => () => void
  onClose: () => void
  pendingApprovals: number
}

const statusText: Record<Session['status'], string> = {
  working: 'Working',
  needs_approval: 'Approval',
  waiting: 'Waiting',
  idle: 'Idle',
  unknown: 'Unknown',
}

const statusClass: Record<Session['status'], string> = {
  working: 'text-working',
  needs_approval: 'text-approval',
  waiting: 'text-waiting',
  idle: 'text-muted',
  unknown: 'text-muted',
}

export default function Terminal({
  session,
  connectionStatus,
  sendMessage,
  subscribe,
  onClose,
  pendingApprovals,
}: TerminalProps) {
  const theme = useThemeStore((state) => state.theme)
  const terminalTheme = terminalThemes[theme]

  const { containerRef } = useTerminal({
    sessionId: session?.id ?? null,
    sendMessage,
    subscribe,
    theme: terminalTheme,
  })

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
      </div>
    </section>
  )
}
