import path from 'node:path'

import { config } from 'dotenv'
import { defineConfig } from 'prisma/config'

// .env nằm ở gốc repo (docs/07), không nằm trong apps/api.
const env = config({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true })
if (env.error && !process.env.DATABASE_URL) {
  console.warn('⚠ Chưa có file .env ở gốc repo. Chạy ở thư mục gốc: Copy-Item .env.example .env (xem docs/07).')
}

export default defineConfig({
  schema: 'src/db/schema.prisma',
  migrations: {
    seed: 'tsx src/db/seed.ts',
  },
})
