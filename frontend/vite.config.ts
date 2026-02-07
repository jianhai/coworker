import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Read config from ~/.cowork/settings.json
const configPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.cowork', 'settings.json')
let port = 5173
let host = '127.0.0.1'
let backendBindAddress = '127.0.0.1:3000'

try {
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    port = config.frontend?.port || 5173
    host = config.frontend?.host || '127.0.0.1'
    backendBindAddress = config.backend?.bind_address || '127.0.0.1:3000'
  }
} catch (e) {
  console.warn('Failed to load config, using defaults:', e)
}

// 支持 http 和 https
const isHttps = backendBindAddress.includes('localhost') || backendBindAddress.includes('127.0.0.1')
  ? false
  : !backendBindAddress.startsWith('http://')
const backendUrl = isHttps || backendBindAddress.startsWith('https://')
  ? (backendBindAddress.startsWith('https://') ? backendBindAddress : `https://${backendBindAddress}`)
  : `http://${backendBindAddress}`
const wsUrl = backendUrl.replace('http://', 'ws://').replace('https://', 'wss://')

export default defineConfig({
  plugins: [react()],
  server: {
    host,
    port,
    strictPort: true,
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
      '/ws': {
        target: wsUrl,
        ws: true,
      },
    },
  },
})
