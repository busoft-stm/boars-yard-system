import { copyFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const rootDir = dirname(fileURLToPath(import.meta.url))

/**
 * SPA fallback for static hosts without rewrite rules.
 * Unknown paths can serve 404.html (same shell as index.html).
 */
function spaFallback(): Plugin {
  return {
    name: 'spa-fallback',
    closeBundle() {
      const outDir = resolve(rootDir, 'dist')
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'))
      writeFileSync(resolve(outDir, '.nojekyll'), '')
    },
  }
}

// Deploy at domain root (e.g. https://your-demo-domain.com/)
export default defineConfig({
  plugins: [react(), spaFallback()],
  base: '/',
})
