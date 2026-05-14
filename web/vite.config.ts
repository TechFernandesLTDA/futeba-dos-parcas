/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import pkg from './package.json'

// Versão lida de package.json em build time (single source of truth).
// Build number vem do CI (GITHUB_RUN_NUMBER) ou 'dev' em local.
const appVersion = pkg.version
const appBuild = process.env.GITHUB_RUN_NUMBER ?? 'dev'

export default defineConfig({
  plugins: [react()],
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
          if (id.includes('node_modules/react') || id.includes('react-router-dom')) return 'vendor-react'
          if (id.includes('@mui/icons-material')) return 'vendor-mui-icons'
          if (id.includes('@mui/') || id.includes('@emotion/')) return 'vendor-mui'
          if (id.includes('firebase/')) return 'vendor-firebase'
          if (id.includes('@tanstack/react-query')) return 'vendor-query'
          if (id.includes('date-fns')) return 'vendor-utils'
          if (id.includes('html2canvas')) return 'vendor-html2canvas'
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
