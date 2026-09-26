import path from 'node:path'

import { config } from 'dotenv'
import { defineConfig } from 'prisma/config'

// .env nằm ở gốc repo (docs/07), không nằm trong apps/api.
config({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true })

export default defineConfig({
  schema: 'src/db/schema.prisma',
})
