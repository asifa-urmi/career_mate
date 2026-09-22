import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Vite resolves the "@/*" paths from tsconfig.json natively.
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    reporters: ['default'],
  },
})
