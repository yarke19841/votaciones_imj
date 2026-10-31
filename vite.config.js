import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  server: { allowedHosts: ['terminal.local'] },
  plugins: [react()]
})
