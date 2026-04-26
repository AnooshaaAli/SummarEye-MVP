import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['sallie-phototypic-humorlessly.ngrok-free.dev'],
    proxy: {
      '/api': 'http://localhost:8000'
    }
  },
  preview: {
    port: 5173,
    allowedHosts: ['sallie-phototypic-humorlessly.ngrok-free.dev'],
    proxy: {
      '/api': 'http://localhost:8000'
    }
  }
})
