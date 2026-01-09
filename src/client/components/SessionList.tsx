import type { Session } from '@shared/types'

interface SessionListProps {
  sessions: Session[]
  selectedSessionId: string | null
  loading: boolean
  error: string | null
  onSelect: (sessionId: string) => void
  onKill: (sessionId: string) => void
}

const statusBarClass: Record<Session['status'], string> = {
  working: 'status-bar-working',
  needs_approval: 'status-bar-approval',
  waiting: 'status-bar-waiting',
  idle: 'status-bar-idle',
  unknown: 'status-bar-idle',
}

const statusLabel: Record<Session['status'], string> = {
  working: 'Working',
  needs_approval: 'Approval',
  waiting: 'Waiting',
  idle: 'Idle',
  unknown: 'Idle',
}

const statusTextClass: Record<Session['status'], string> = {
  working: 'text-working',
  needs_approval: 'text-approval',
  waiting: 'text-waiting',
  idle: 'text-muted',
  unknown: 'text-muted',
}

export default function SessionList({
  sessions,
  selectedSessionId,
  loading,
  error,
  onSelect,
  onKill,
}: SessionListProps) {
  // Sort: needs_approval first, then working, then waiting, then idle
  const sortedSessions = [...sessions].sort((a, b) => {
    const order: Record<string, number> = {
      needs_approval: 0,
      working: 1,
      waiting: 2,
      idle: 3,
      unknown: 4,
    }
    const aOrder = order[a.status] ?? 4
    const bOrder = order[b.status] ?? 4
    if (aOrder !== bOrder) return aOrder - bOrder
    return Date.parse(b.lastActivity) - Date.parse(a.lastActivity)
  })

  const handleKill = (session: Session) => {
    if (session.source !== 'managed') return
    const confirmed = window.confirm(
      `Kill session "${session.name}"? This will close the tmux window.`
    )
    if (confirmed) {
      onKill(session.id)
    }
  }

  return (
    <aside className="flex h-full flex-col border-r border-border bg-elevated">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">
          Sessions
        </span>
        <span className="text-xs text-muted">{sessions.length}</span>
      </div>

      {error && (
        <div className="border-b border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-1 p-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded bg-surface"
              />
            ))}
          </div>
        ) : sortedSessions.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted">
            No sessions
          </div>
        ) : (
          <div className="py-1">
            {sortedSessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                isSelected={session.id === selectedSessionId}
                onSelect={() => onSelect(session.id)}
                onKill={() => handleKill(session)}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

interface SessionRowProps {
  session: Session
  isSelected: boolean
  onSelect: () => void
  onKill: () => void
}

function SessionRow({ session, isSelected, onSelect, onKill }: SessionRowProps) {
  const lastActivity = formatRelativeTime(session.lastActivity)
  const isApproval = session.status === 'needs_approval'

  return (
    <div
      className={`session-row group cursor-pointer px-3 py-2 ${isSelected ? 'selected' : ''} ${isApproval ? 'pulse-approval' : ''}`}
      role="button"
      tabIndex={0}
      data-testid="session-card"
      data-session-id={session.id}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect()
      }}
    >
      <div className={`status-bar ${statusBarClass[session.status]}`} />

      <div className="flex items-start justify-between gap-2 pl-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-primary">
              {session.name}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs">
            <span className={statusTextClass[session.status]}>
              {statusLabel[session.status]}
            </span>
            <span className="text-muted">{lastActivity}</span>
          </div>
        </div>

        {session.source === 'managed' && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onKill()
            }}
            className="btn btn-danger hidden py-0.5 text-[10px] group-hover:flex"
          >
            Kill
          </button>
        )}
      </div>
    </div>
  )
}

function formatRelativeTime(iso: string): string {
  const timestamp = Date.parse(iso)
  if (Number.isNaN(timestamp)) return ''

  const delta = Date.now() - timestamp
  const minutes = Math.floor(delta / 60000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`

  const days = Math.floor(hours / 24)
  return `${days}d`
}
