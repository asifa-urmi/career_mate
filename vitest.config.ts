import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    // Vite resolves the "@/*" paths from tsconfig.json natively.
    tsconfigPaths: true,
    alias: {
      // Services import "server-only" so that pulling one into a client
      // component is a build error rather than a leaked service-role key.
      // Outside Next's bundler that package resolves to a module which throws on
      // import, so tests point at its own no-op react-server build — the same
      // file the server bundle gets.
      'server-only': fileURLToPath(new URL('./node_modules/server-only/empty.js', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    reporters: ['default'],
  },
})
