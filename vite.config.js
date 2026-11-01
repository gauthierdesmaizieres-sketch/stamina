import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './', // works both locally and under /stamina/ on GitHub Pages
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Stamina',
        short_name: 'Stamina',
        theme_color: '#10152A',
        background_color: '#10152A',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html}', 'assets/*-latin-*.woff2'], // fonts work offline
        maximumFileSizeToCacheInBytes: 3_000_000,
        // Exercise images (manga redraws, or the dataset's photos as fallback): cache them as they are viewed.
        runtimeCaching: [{
          urlPattern: /^https:\/\/raw\.githubusercontent\.com\/yuhonas\//,
          handler: 'CacheFirst',
          options: { cacheName: 'exercise-images', expiration: { maxEntries: 2000 } },
        }, {
          urlPattern: /\/manga\/.+\.webp$/,
          handler: 'CacheFirst',
          options: { cacheName: 'manga-images', expiration: { maxEntries: 2000 } },
        }],
      },
    }),
  ],
})
