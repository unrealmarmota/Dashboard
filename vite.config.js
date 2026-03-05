import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/uptimekuma': {
        target: 'http://192.168.178.30:3005',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/uptimekuma/, ''),
      },
    },
  },
})
