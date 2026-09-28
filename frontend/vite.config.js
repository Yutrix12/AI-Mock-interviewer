import process from 'node:process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the site from /AI-Mock-interviewer/; local dev stays at /.
  base: process.env.BASE_PATH || '/',
})
