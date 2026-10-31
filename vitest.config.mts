import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  // Tests never need Tailwind; skipping postcss.config.mjs lets components that import SCSS load.
  css: { postcss: { plugins: [] } },
  test: {
    environment: 'jsdom',
    include: ['tests/int/**/*.int.spec.ts', 'tests/int/**/*.int.spec.tsx'],
  },
})
