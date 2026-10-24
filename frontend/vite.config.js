import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // During development, forward /api requests to the Python backend
    proxy: { '/api': 'http://localhost:8000' }
  }
})
