import { defineConfig, loadEnv } from 'vite'
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

export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  if (command === 'build') {
    const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter(name => !env[name]);
    if (missing.length) throw new Error(`Cannot build Lab: missing ${missing.join(', ')}. Configure the public client environment before publishing.`);
  }
  return {
  plugins: [react(), excludeBrokenFiles()],
  server: {
    port: 5173,
    host: true
  },
  publicDir: 'public',
  };
})
