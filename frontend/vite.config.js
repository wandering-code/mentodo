import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'child_process'

function version() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

// Backend de `docker compose up` en la raíz del repo (puerto 8005 de dev)
const BACKEND = 'http://localhost:8005'

export default defineConfig({
  define: { __VERSION__: JSON.stringify(version()) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Service worker propio (src/sw.js) para poder recibir Web Push
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        name: 'Mentodo',
        short_name: 'Mentodo',
        description: 'Tu mente. Todo en orden.',
        lang: 'es',
        id: '/',
        start_url: '/',
        display: 'standalone',
        background_color: '#f7f5f0',
        theme_color: '#f7f5f0',
        // Sin «?v=» en las URL (algunas versiones de iOS fallan con ellas) y
        // con nombres nuevos para que iOS no use un fallo guardado. iOS usa
        // estos iconos, no el apple-touch-icon, cuando lee el manifest.
        icons: [
          { src: '/icons/app-180.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
          { src: '/icons/app-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/app-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/mentodo-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Los iconos y el manifest no pasan por el service worker: iOS los pide
      // al añadir a la pantalla de inicio y, servidos desde él, puede no
      // usarlos (y poner una letra gris)
      includeManifestIcons: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['icons/**', 'apple-touch-icon*.png', 'icon-*.png', 'manifest.webmanifest'],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5180,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
      '/ws': { target: BACKEND, ws: true, changeOrigin: true },
    },
  },
})
