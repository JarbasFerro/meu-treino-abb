import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      injectRegister: false,
      strategies: 'generateSW',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Hybrid Fit Daily Training',
        short_name: 'Hybrid Fit',
        description: 'Offline-first daily training cockpit for home, hotel, beginner cues, progressive overload, and habit consistency.',
        start_url: '/meu-treino-abb/',
        scope: '/meu-treino-abb/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F4F0E8',
        theme_color: '#2F6F5E',
        icons: [
          {
            src: '/meu-treino-abb/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/meu-treino-abb/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'hybrid-fit-navigation',
              networkTimeoutSeconds: 3,
            },
          },
          {
            urlPattern: ({ request }) => ['script', 'style', 'image', 'font'].includes(request.destination),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'hybrid-fit-static-assets',
            },
          },
        ],
      },
    }),
  ],
  base: '/meu-treino-abb/', // MUITO IMPORTANTE: Nome do seu repositório com barras no início e fim
})
