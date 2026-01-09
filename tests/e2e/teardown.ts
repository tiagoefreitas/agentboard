import { spawnSync } from 'node:child_process'

export default async function teardown() {
  const session = process.env.E2E_TMUX_SESSION
  if (!session) {
    return
  }

  const check = spawnSync('tmux', ['-V'], { stdio: 'ignore' })
  if (check.status !== 0) {
    return
  }

  spawnSync('tmux', ['kill-session', '-t', session], { stdio: 'ignore' })
}
