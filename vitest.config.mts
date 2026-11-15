import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  // Tests never need Tailwind; skipping postcss.config.mjs lets components that import SCSS load.
  css: { postcss: { plugins: [] } },
  test: {
    environment: 'jsdom',
    // Node 25+ has its own `localStorage` global, which is undefined without
    // --localstorage-file and hides jsdom's. Turn it off so tests get jsdom's.
    execArgv: ['--no-experimental-webstorage'],
    include: ['tests/int/**/*.int.spec.ts', 'tests/int/**/*.int.spec.tsx'],
  },
})
