import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

function copyModelsOnBuild() {
  return {
    name: 'copy-models-on-build',
    closeBundle() {
      const rootDir = process.cwd()
      const sourceDir = path.resolve(rootDir, 'models')
      const targetDir = path.resolve(rootDir, 'dist', 'models')

      if (!fs.existsSync(sourceDir)) {
        return
      }

      fs.rmSync(targetDir, { recursive: true, force: true })
      fs.cpSync(sourceDir, targetDir, { recursive: true })
    },
  }
}

const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react(), copyModelsOnBuild()],
  server: {
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
