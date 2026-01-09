import { useEffect, useState } from 'react'

interface NewSessionModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (projectPath: string, name?: string) => void
}

export default function NewSessionModal({
  isOpen,
  onClose,
  onCreate,
}: NewSessionModalProps) {
  const [projectPath, setProjectPath] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setProjectPath('')
      setName('')
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!projectPath.trim()) {
      return
    }
    onCreate(projectPath.trim(), name.trim() || undefined)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md border border-border bg-elevated p-6"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">
          New Session
        </h2>
        <p className="mt-2 text-xs text-muted">
          Enter the absolute project path. A tmux window will launch Claude in
          that directory.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-secondary">
              Project Path
            </label>
            <input
              value={projectPath}
              onChange={(event) => setProjectPath(event.target.value)}
              placeholder="/Users/you/code/my-project"
              className="input"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-secondary">
              Display Name (optional)
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="my-project"
              className="input"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Create
          </button>
        </div>
      </form>
    </div>
  )
}
