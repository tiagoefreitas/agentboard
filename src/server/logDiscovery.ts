import path from 'node:path'
import fs, { type FileHandle } from 'node:fs/promises'
import { config } from './config'

export interface LogFileInfo {
  path: string
  mtimeMs: number
}

interface CodexLogInfo extends LogFileInfo {
  cwd: string
}

const CODEX_SCAN_TTL_MS = 30000

let codexCache: {
  baseDir: string
  scannedAt: number
  entries: CodexLogInfo[]
} = {
  baseDir: '',
  scannedAt: 0,
  entries: [],
}

export function escapeProjectPath(projectPath: string): string {
  return projectPath.replace(/\//g, '-')
}

export async function discoverLogFile(
  projectPath: string,
  baseDir = config.claudeProjectsDir
): Promise<string | null> {
  const files = await discoverLogFiles(projectPath, baseDir)
  return files[0]?.path ?? null
}

export async function discoverLogFiles(
  projectPath: string,
  baseDir = config.claudeProjectsDir
): Promise<LogFileInfo[]> {
  const [claudeFiles, codexFiles] = await Promise.all([
    discoverClaudeLogFiles(projectPath, baseDir),
    discoverCodexLogFiles(projectPath, config.codexSessionsDir),
  ])

  return [...claudeFiles, ...codexFiles].sort((a, b) => b.mtimeMs - a.mtimeMs)
}

function normalizePath(value: string): string {
  if (!value) {
    return ''
  }
  return path.resolve(value)
}

function isSubPath(parent: string, child: string): boolean {
  if (!parent || !child) {
    return false
  }
  const relative = path.relative(parent, child)
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  )
}

function matchesProjectPath(projectPath: string, cwd: string): boolean {
  const normalizedProject = normalizePath(projectPath)
  const normalizedCwd = normalizePath(cwd)

  return (
    isSubPath(normalizedProject, normalizedCwd) ||
    isSubPath(normalizedCwd, normalizedProject)
  )
}

async function discoverClaudeLogFiles(
  projectPath: string,
  baseDir: string
): Promise<LogFileInfo[]> {
  if (!baseDir) {
    return []
  }

  const escaped = escapeProjectPath(projectPath)
  const directory = path.join(baseDir, escaped)

  let entries
  try {
    entries = await fs.readdir(directory, { withFileTypes: true })
  } catch {
    return []
  }

  const jsonlFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith('.jsonl'))
    .filter((name) => !name.startsWith('agent-'))

  if (jsonlFiles.length === 0) {
    return []
  }

  const results: LogFileInfo[] = []

  for (const file of jsonlFiles) {
    const fullPath = path.join(directory, file)
    try {
      const stat = await fs.stat(fullPath)
      results.push({ path: fullPath, mtimeMs: stat.mtimeMs })
    } catch {
      continue
    }
  }

  return results.sort((a, b) => b.mtimeMs - a.mtimeMs)
}

async function discoverCodexLogFiles(
  projectPath: string,
  baseDir: string
): Promise<LogFileInfo[]> {
  if (!baseDir) {
    return []
  }

  const entries = await getCodexIndex(baseDir)
  const matches = entries.filter((entry) =>
    matchesProjectPath(projectPath, entry.cwd)
  )

  return matches.map(({ path, mtimeMs }) => ({ path, mtimeMs }))
}

async function getCodexIndex(baseDir: string): Promise<CodexLogInfo[]> {
  const now = Date.now()
  if (
    codexCache.baseDir === baseDir &&
    now - codexCache.scannedAt < CODEX_SCAN_TTL_MS
  ) {
    return codexCache.entries
  }

  const entries = await scanCodexSessions(baseDir)
  codexCache = {
    baseDir,
    scannedAt: now,
    entries,
  }

  return entries
}

async function scanCodexSessions(baseDir: string): Promise<CodexLogInfo[]> {
  const files = await listJsonlFiles(baseDir)
  const results: CodexLogInfo[] = []

  for (const filePath of files) {
    try {
      const [stat, cwd] = await Promise.all([
        fs.stat(filePath),
        readCodexCwd(filePath),
      ])
      if (!cwd) {
        continue
      }
      results.push({ path: filePath, mtimeMs: stat.mtimeMs, cwd })
    } catch {
      continue
    }
  }

  return results
}

async function listJsonlFiles(baseDir: string): Promise<string[]> {
  const results: string[] = []
  const stack = [baseDir]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) {
      continue
    }

    let entries
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        stack.push(path.join(current, entry.name))
        continue
      }
      if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        results.push(path.join(current, entry.name))
      }
    }
  }

  return results
}

async function readCodexCwd(filePath: string): Promise<string | null> {
  let handle: FileHandle | null = null
  try {
    handle = await fs.open(filePath, 'r')
    const buffer = Buffer.alloc(64 * 1024)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    if (!bytesRead) {
      return null
    }

    const chunk = buffer.subarray(0, bytesRead).toString('utf8')
    const firstLine = chunk.split('\n')[0]?.trim()
    if (!firstLine) {
      return null
    }

    const entry = JSON.parse(firstLine) as {
      type?: string
      payload?: { cwd?: string }
    }

    if (entry.type !== 'session_meta') {
      return null
    }

    return typeof entry.payload?.cwd === 'string' ? entry.payload.cwd : null
  } catch {
    return null
  } finally {
    if (handle) {
      await handle.close()
    }
  }
}
