import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.svg', 'icon-512.svg', 'icon-maskable.svg'],
      manifest: {
        name: 'BarsikChat — Безопасный мессенджер',
        short_name: 'BarsikChat',
        description: 'Защищённый чат с E2E шифрованием, звонками и конференциями',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: 'icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
          {
            src: 'icon-maskable.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cache app shell
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Don't cache API / WebSocket requests
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/ws\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/(api|ws)\//,
            handler: 'NetworkOnly',
          },
          {
            // Cache uploaded avatars/files
            urlPattern: /\/api\/uploads\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'uploads-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
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
