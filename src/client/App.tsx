import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session, ServerMessage } from '@shared/types'
import Header from './components/Header'
import SessionList from './components/SessionList'
import Terminal from './components/Terminal'
import NewSessionModal from './components/NewSessionModal'
import { useSessionStore } from './stores/sessionStore'
import { useThemeStore } from './stores/themeStore'
import { useWebSocket } from './hooks/useWebSocket'
import { useNotifications } from './hooks/useNotifications'
import { useFaviconBadge } from './hooks/useFaviconBadge'

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const sessions = useSessionStore((state) => state.sessions)
  const selectedSessionId = useSessionStore(
    (state) => state.selectedSessionId
  )
  const setSessions = useSessionStore((state) => state.setSessions)
  const updateSession = useSessionStore((state) => state.updateSession)
  const setSelectedSessionId = useSessionStore(
    (state) => state.setSelectedSessionId
  )
  const hasLoaded = useSessionStore((state) => state.hasLoaded)
  const connectionStatus = useSessionStore(
    (state) => state.connectionStatus
  )
  const connectionError = useSessionStore((state) => state.connectionError)

  const theme = useThemeStore((state) => state.theme)

  const { sendMessage, subscribe } = useWebSocket()
  const { notify, requestPermission } = useNotifications()

  useEffect(() => {
    requestPermission()
  }, [requestPermission])

  useEffect(() => {
    const unsubscribe = subscribe((message: ServerMessage) => {
      if (message.type === 'sessions') {
        setSessions(message.sessions)
      }
      if (message.type === 'session-update') {
        updateSession(message.session)
      }
      if (message.type === 'error') {
        setServerError(message.message)
        window.setTimeout(() => setServerError(null), 6000)
      }
    })

    return () => { unsubscribe() }
  }, [sendMessage, setSessions, subscribe, updateSession])

  const selectedSession = useMemo(() => {
    return sessions.find((session) => session.id === selectedSessionId) || null
  }, [selectedSessionId, sessions])

  const needsApprovalCount = useMemo(
    () => sessions.filter((session) => session.status === 'needs_approval').length,
    [sessions]
  )

  useFaviconBadge(needsApprovalCount > 0)

  const previousStatuses = useRef<Map<string, Session['status']>>(new Map())

  useEffect(() => {
    const prev = previousStatuses.current
    for (const session of sessions) {
      const previousStatus = prev.get(session.id)
      if (
        session.status === 'needs_approval' &&
        previousStatus !== 'needs_approval'
      ) {
        notify('Agentboard', `${session.name} needs approval.`)
      }
      prev.set(session.id, session.status)
    }
  }, [notify, sessions])

  const handleNewSession = () => setIsModalOpen(true)

  const handleCreateSession = (projectPath: string, name?: string) => {
    sendMessage({ type: 'session-create', projectPath, name })
  }

  const handleKillSession = (sessionId: string) => {
    sendMessage({ type: 'session-kill', sessionId })
  }

  const handleRefresh = () => {
    sendMessage({ type: 'session-refresh' })
  }

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <div className="flex h-screen flex-col">
      <Header
        connectionStatus={connectionStatus}
        needsApprovalCount={needsApprovalCount}
        onNewSession={handleNewSession}
        onRefresh={handleRefresh}
      />

      <div className="flex min-h-0 flex-1">
        {/* Sidebar - hidden on mobile when session selected */}
        <div className={`w-full shrink-0 md:w-60 lg:w-72 ${selectedSession ? 'hidden md:block' : ''}`}>
          <SessionList
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            onSelect={setSelectedSessionId}
            onKill={handleKillSession}
            loading={!hasLoaded}
            error={connectionError || serverError}
          />
        </div>

        {/* Terminal - hero element */}
        <Terminal
          session={selectedSession}
          connectionStatus={connectionStatus}
          sendMessage={sendMessage}
          subscribe={subscribe}
          onClose={() => setSelectedSessionId(null)}
          pendingApprovals={needsApprovalCount}
        />
      </div>

      <NewSessionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateSession}
      />
    </div>
  )
}
