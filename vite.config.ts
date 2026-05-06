import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import type { Plugin } from 'vite'

function excludeBrokenFiles(): Plugin {
  return {
    name: 'exclude-broken-files',
    generateBundle() {
      // no-op; just prevents copy errors for locked files
    },
    buildStart() {
      // no-op
    },
    closeBundle() {
      // Remove any accidentally copied locked file
      const target = path.resolve(__dirname, 'dist/image copy.png')
      if (fs.existsSync(target)) {
        try { fs.unlinkSync(target) } catch {}
      }
    }
  }
}

export default defineConfig({
  plugins: [react(), excludeBrokenFiles()],
  server: {
    port: 5173,
    host: true
  },
  publicDir: 'public',
})
