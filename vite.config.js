import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Custom plugin to serve eu_safety_laws as static files (dev) and copy to dist (build)
function serveEuSafetyLaws() {
  return {
    name: 'serve-eu-safety-laws',
    // Development server middleware
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
    },
    // Copy files to dist during production build
    closeBundle() {
      const srcDir = resolve(__dirname, 'eu_safety_laws')
      const destDir = resolve(__dirname, 'dist', 'eu_safety_laws')

      if (fs.existsSync(srcDir)) {
        copyDirRecursive(srcDir, destDir)
        console.log('✓ Copied eu_safety_laws to dist/')
      }
    }
  }
}

// Helper function to recursively copy directory
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }

  const entries = fs.readdirSync(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
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
