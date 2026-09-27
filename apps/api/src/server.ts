import { fileURLToPath } from 'node:url'

import { config as loadEnvFile } from 'dotenv'

import { buildApp } from './app.js'
import { loadConfig } from './config.js'

// .env nằm ở gốc repo (docs/07). Production truyền biến môi trường trực tiếp, không cần file.
loadEnvFile({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true })

const config = loadConfig()
const app = buildApp(config)

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'Shutting down API')
  await app.close()
  process.exit(0)
}

process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))

try {
  await app.listen({ host: config.API_HOST, port: config.API_PORT })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
