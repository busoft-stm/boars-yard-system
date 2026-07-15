import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages project site: https://busoft-stm.github.io/boars-yard-system/
// Local `npm run dev` stays at http://localhost:5174/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/boars-yard-system/' : '/',
}))
