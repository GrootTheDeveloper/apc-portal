import cors from '@fastify/cors'
import Fastify from 'fastify'

import type { AppConfig } from './config.js'

export function buildApp(config: AppConfig) {
  const app = Fastify({ logger: config.NODE_ENV !== 'test' })

  app.register(cors, { origin: config.WEB_URL, credentials: true })

  app.get('/health', async () => ({ status: 'ok', service: 'apc-api' }))

  return app
}
