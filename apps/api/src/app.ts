import cors from '@fastify/cors'
import Fastify from 'fastify'

import type { AppConfig } from './config.js'
import { registerErrorHandler } from './lib/errors.js'
import { registerAuth } from './modules/auth/rbac.js'

export function buildApp(config: AppConfig) {
  const app = Fastify({ logger: config.NODE_ENV !== 'test' })

  app.register(cors, { origin: config.WEB_URL, credentials: true })
  registerErrorHandler(app)
  registerAuth(app)

  app.get('/health', async () => ({ status: 'ok', service: 'apc-api' }))

  return app
}
