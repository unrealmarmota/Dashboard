import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    proxy: {
      '/uptimekuma': {
        target: 'http://192.168.178.30:3005',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/uptimekuma/, ''),
      },
      '/glances': {
        target: 'http://192.168.178.30:61208',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/glances/, ''),
      },
    },
  },
})
