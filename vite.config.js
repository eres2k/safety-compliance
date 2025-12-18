import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Custom plugin to serve eu_safety_laws as static files
function serveEuSafetyLaws() {
  return {
    name: 'serve-eu-safety-laws',
    configureServer(server) {
      server.middlewares.use('/eu_safety_laws', (req, res, next) => {
        const filePath = resolve(__dirname, 'eu_safety_laws', req.url.slice(1))
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = filePath.split('.').pop()
          const mimeTypes = {
            json: 'application/json',
            html: 'text/html',
            css: 'text/css',
            js: 'application/javascript'
          }
          res.setHeader('Content-Type', mimeTypes[ext] || 'text/plain')
          fs.createReadStream(filePath).pipe(res)
        } else {
          next()
        }
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), serveEuSafetyLaws()],
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  server: {
    port: 3000
  }
})
