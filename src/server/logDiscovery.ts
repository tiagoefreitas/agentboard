import path from 'node:path'
import fs from 'node:fs/promises'
import { config } from './config'

export interface LogFileInfo {
  path: string
  mtimeMs: number
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
