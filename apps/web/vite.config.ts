import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // /api/* → API (bỏ tiền tố /api). Production làm y hệt bằng Nginx (docs/06 mục 5).
    // Dùng 127.0.0.1 thay localhost: Node mới phân giải localhost sang IPv6 (::1) trong khi API nghe IPv4.
    proxy: {
      '/api': { target: 'http://127.0.0.1:3000', rewrite: (path) => path.replace(/^\/api/, '') },
    },
  },
})
