import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

function debugLogPlugin() {
  const logFile = path.resolve('debug-c2ad74.log')
  return {
    name: 'debug-log',
    configureServer(server) {
      server.middlewares.use('/__debug_log', (req, res, next) => {
        if (req.method !== 'POST') return next()
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
          try {
            fs.appendFileSync(logFile, body.trim() + '\n')
          } catch (_) { /* ignore */ }
          res.statusCode = 204
          res.end()
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), debugLogPlugin()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
