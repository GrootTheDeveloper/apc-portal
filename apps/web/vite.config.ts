import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Trỏ chính xác về 127.0.0.1 (IPv4) để tránh lỗi ECONNREFUSED do Node 24 phân giải localhost sang IPv6 (::1).
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/public': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
})
