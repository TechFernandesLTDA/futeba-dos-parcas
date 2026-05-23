/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'
import fs from 'fs'

// Versão lida de versions.json (raiz) em build time — fonte única de verdade.
// Build number vem do CI (GITHUB_RUN_NUMBER) ou 'dev' em local.
const versions = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../versions.json'), 'utf-8'),
) as { web: { version: string } }
const appVersion = versions.web.version
const appBuild = process.env.GITHUB_RUN_NUMBER ?? 'dev'

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    'import.meta.env.VITE_APP_BUILD': JSON.stringify(appBuild),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React ecosystem
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('react-router-dom')) {
            return 'vendor-react'
          }
          // MUI icons (separate from core MUI for better caching)
          if (id.includes('@mui/icons-material')) {
            return 'vendor-mui-icons'
          }
          // MUI core + Emotion
          if (id.includes('@mui/') || id.includes('@emotion/')) {
            return 'vendor-mui'
          }
          // Firebase SDK
          if (id.includes('firebase/')) {
            return 'vendor-firebase'
          }
          // TanStack Query
          if (id.includes('@tanstack/react-query')) {
            return 'vendor-query'
          }
          // Date utilities
          if (id.includes('date-fns')) {
            return 'vendor-utils'
          }
          // HTML2Canvas (heavy, only used in specific screens)
          if (id.includes('html2canvas')) {
            return 'vendor-html2canvas'
          }
          // Charts (Recharts)
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'vendor-charts'
          }
          return undefined
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
})
