import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    tanstackStart(),
    tsconfigPaths(),
    react(),
  ],
  resolve: {
    alias: {
      "@": "/src"
    }
  }
})
