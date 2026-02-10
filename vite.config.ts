import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

function isConnRefused(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false

  const anyErr = err as { code?: unknown; message?: unknown; errors?: unknown }
  if (anyErr.code === 'ECONNREFUSED') return true

  // Node can surface dual-stack localhost failures as an AggregateError.
  if (Array.isArray(anyErr.errors)) {
    for (const sub of anyErr.errors) {
      if (sub && typeof sub === 'object' && (sub as { code?: unknown }).code === 'ECONNREFUSED') {
        return true
      }
    }
  }

  return typeof anyErr.message === 'string' && anyErr.message.includes('ECONNREFUSED')
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const allowedHosts = env.VITE_ALLOWED_HOSTS
    ? env.VITE_ALLOWED_HOSTS.split(',').map((h) => h.trim())
    : []

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@shared': path.resolve(__dirname, 'src/shared'),
      },
    },
    server: {
      allowedHosts,
      proxy: {
        '/api': {
          target: 'http://localhost:4040',
          // Preserve Vite string-shorthand behavior.
          changeOrigin: true,
          configure: (proxy) => {
            // Vite registers its own error handler after calling `configure()`.
            // Patch `proxy.on()` so that handler doesn't log ECONNREFUSED during backend restarts.
            const p = proxy as unknown as {
              on: (event: string, listener: (...args: any[]) => void) => unknown
            }
            const originalOn = p.on.bind(p)
            p.on = ((event: string, listener: (...args: any[]) => void) => {
              if (event !== 'error') return originalOn(event, listener)
              return originalOn(event, (err: unknown, _req: unknown, res: any, target: unknown) => {
                if (isConnRefused(err)) {
                  // Backend is restarting; avoid noisy logs and fail fast.
                  if (res && typeof res.writeHead === 'function') {
                    if (!res.headersSent && !res.writableEnded) {
                      res.writeHead(502, { 'Content-Type': 'text/plain' })
                    }
                    if (!res.writableEnded) res.end()
                  } else if (res && typeof res.end === 'function') {
                    res.end()
                  }
                  return
                }
                listener(err, _req, res, target)
              })
            }) as typeof p.on
          },
        },
        '/ws': {
          target: 'ws://localhost:4040',
          ws: true,
          configure: (proxy) => {
            const p = proxy as unknown as {
              on: (event: string, listener: (...args: any[]) => void) => unknown
            }
            const originalOn = p.on.bind(p)
            p.on = ((event: string, listener: (...args: any[]) => void) => {
              if (event !== 'error') return originalOn(event, listener)
              return originalOn(event, (err: unknown, req: unknown, res: any, target: unknown) => {
                if (isConnRefused(err)) {
                  // ws upgrade socket
                  if (res && typeof res.end === 'function') res.end()
                  return
                }
                listener(err, req, res, target)
              })
            }) as typeof p.on
          },
        },
      },
    },
    build: {
      outDir: 'dist/client',
      emptyOutDir: true,
    },
  }
})
