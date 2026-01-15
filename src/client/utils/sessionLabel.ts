import type { Session } from '@shared/types'

export function formatCommandLabel(session: Session): string | null {
  const dirLabel = getPathLeaf(session.projectPath)
  const baseLabel = session.agentType || session.command || ''
  const parts = [baseLabel, dirLabel].filter(Boolean)

  if (parts.length === 0) {
    return null
  }

  return parts.join(' / ')
}

export function getPathLeaf(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const normalized = trimmed.replace(/[\\/]+$/, '')
  if (!normalized) {
    return null
  }

  const parts = normalized.split(/[\\/]/)
  return parts[parts.length - 1] || null
}

export function getDisambiguatedProjectNames(paths: string[]): Map<string, string> {
  const entries = paths.map((path) => {
    const trimmed = path.trim()
    const normalized = trimmed.replace(/[\\/]+$/, '')
    const parts = normalized.split(/[\\/]/).filter(Boolean)
    const fallback = normalized || trimmed || path
    return { path, parts, fallback }
  })

  const depthByPath = new Map<string, number>()
  for (const entry of entries) {
    depthByPath.set(entry.path, 1)
  }

  let changed = true
  while (changed) {
    changed = false
    const counts = new Map<string, number>()
    for (const entry of entries) {
      if (entry.parts.length === 0) continue
      const depth = depthByPath.get(entry.path) ?? 1
      const label = entry.parts.slice(-depth).join('/')
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }

    for (const entry of entries) {
      if (entry.parts.length === 0) continue
      const depth = depthByPath.get(entry.path) ?? 1
      const label = entry.parts.slice(-depth).join('/')
      if ((counts.get(label) ?? 0) > 1 && depth < entry.parts.length) {
        depthByPath.set(entry.path, depth + 1)
        changed = true
      }
    }
  }

  const labels = new Map<string, string>()
  const labelCounts = new Map<string, number>()
  for (const entry of entries) {
    let label = entry.fallback
    if (entry.parts.length > 0) {
      const depth = depthByPath.get(entry.path) ?? 1
      label = entry.parts.slice(-depth).join('/')
    }
    labels.set(entry.path, label)
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1)
  }

  const result = new Map<string, string>()
  for (const entry of entries) {
    let label = labels.get(entry.path) ?? entry.fallback
    if ((labelCounts.get(label) ?? 0) > 1) {
      label = entry.fallback
    }
    result.set(entry.path, label)
  }

  return result
}
