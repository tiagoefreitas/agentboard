import type { ConnectionStatus } from '../stores/sessionStore'
import { useThemeStore } from '../stores/themeStore'

interface HeaderProps {
  connectionStatus: ConnectionStatus
  needsApprovalCount: number
  onNewSession: () => void
  onRefresh: () => void
}

const statusDot: Record<ConnectionStatus, string> = {
  connected: 'bg-working',
  connecting: 'bg-approval',
  reconnecting: 'bg-approval',
  disconnected: 'bg-danger',
  error: 'bg-danger',
}

export default function Header({
  connectionStatus,
  needsApprovalCount,
  onNewSession,
  onRefresh,
}: HeaderProps) {
  const theme = useThemeStore((state) => state.theme)
  const toggleTheme = useThemeStore((state) => state.toggleTheme)

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-elevated px-4">
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-semibold tracking-tight text-primary">
          AGENTBOARD
        </h1>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span className={`h-2 w-2 rounded-full ${statusDot[connectionStatus]}`} />
          <span className="hidden sm:inline">{connectionStatus}</span>
        </div>
        {needsApprovalCount > 0 && (
          <span className="flex items-center gap-1.5 rounded bg-approval/20 px-2 py-0.5 text-xs font-medium text-approval">
            <span className="h-1.5 w-1.5 rounded-full bg-approval" />
            {needsApprovalCount} approval{needsApprovalCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="btn"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        <button onClick={onRefresh} className="btn">
          Refresh
        </button>
        <button onClick={onNewSession} className="btn btn-primary">
          + New
        </button>
      </div>
    </header>
  )
}
