import path from 'node:path'

import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

// Test đọc DATABASE_URL từ .env ở gốc repo (CI truyền biến môi trường trực tiếp).
config({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true })

export default defineConfig({
  test: {
    exclude: ['dist/**', 'node_modules/**'],
  },
})
