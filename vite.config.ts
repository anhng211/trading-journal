import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// base './' keeps asset paths relative so the app works at any URL,
// including a GitHub Pages project path like /trading-journal/.
export default defineConfig({
  plugins: [react()],
  base: './',
})
