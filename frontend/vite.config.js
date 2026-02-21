import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:9001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:9001',
        ws: true,
      },
    },
  },
  test: {
    // Component tests use jsdom environment
    // Crypto tests use default node environment
    environmentMatchGlobs: [
      ['**/components/**', 'jsdom'],
    ],
  },
})
