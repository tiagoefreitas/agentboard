import { defineConfig } from '@playwright/test'

const port = Number(process.env.E2E_PORT) || 4173
const tmuxSession =
  process.env.E2E_TMUX_SESSION || `agentboard-e2e-${Date.now()}`

process.env.E2E_TMUX_SESSION = tmuxSession

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  use: {
    baseURL: `http://localhost:${port}`,
    headless: true,
  },
  webServer: {
    command: `[ -d dist/client ] || bun run build && PORT=${port} TMUX_SESSION=${tmuxSession} bun src/server/index.ts`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  globalTeardown: './tests/e2e/teardown.ts',
})
