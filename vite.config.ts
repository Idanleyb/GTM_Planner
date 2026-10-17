/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks cache well across deploys; app code changes most.
        manualChunks(id: string) {
          if (id.includes('node_modules/@supabase')) return 'supabase'
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react'
          if (id.includes('node_modules/zod') || id.includes('node_modules/date-fns')) return 'libs'
        },
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}', 'supabase/**/*.test.ts'] },
})
