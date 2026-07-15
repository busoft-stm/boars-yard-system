import { copyFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const rootDir = dirname(fileURLToPath(import.meta.url))

/**
 * GitHub Pages has no SPA rewrite. Unknown paths serve 404.html.
 * Shipping the same shell as index.html lets React Router handle /trailers etc.
 */
function githubPagesSpaFallback(): Plugin {
  return {
    name: 'github-pages-spa-fallback',
    closeBundle() {
      const outDir = resolve(rootDir, 'dist')
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'))
      writeFileSync(resolve(outDir, '.nojekyll'), '')
    },
  }
}

// GitHub Pages project site: https://busoft-stm.github.io/boars-yard-system/
// Local `npm run dev` stays at http://localhost:5174/
export default defineConfig(({ command }) => ({
  plugins: [react(), ...(command === 'build' ? [githubPagesSpaFallback()] : [])],
  base: command === 'build' ? '/boars-yard-system/' : '/',
}))
