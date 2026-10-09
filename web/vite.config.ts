/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'
import fs from 'fs'
import { codeSplittingGroups } from './vite/chunkGroups'

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
    alias: [
      // Rolldown can double-wrap the CommonJS icon modules, making Button startIcon
      // receive an object instead of a React component in production builds.
      { find: /^@mui\/icons-material$/, replacement: '@mui/icons-material/esm' },
      { find: /^@mui\/icons-material\/(?!esm\/)(.*)$/, replacement: '@mui/icons-material/esm/$1' },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    modulePreload: {
      resolveDependencies(_url, deps, context) {
        if (context.hostType !== 'html') return deps

        const deferInitialPreload = [
          'vendor-charts',
          'vendor-firebase-functions',
          'vendor-firebase-storage',
          'vendor-google-maps',
          'vendor-mui-icons',
          'i18n-locales',
        ]

        return deps.filter((dep) =>
          !deferInitialPreload.some((chunkName) => dep.includes(chunkName)),
        )
      },
    },
    rolldownOptions: {
      output: {
        codeSplitting: { groups: codeSplittingGroups },
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
