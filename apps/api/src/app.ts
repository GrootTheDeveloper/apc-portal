import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'

import type { AppConfig } from './config.js'
import { registerErrorHandler } from './lib/errors.js'
import { registerAuth } from './modules/auth/rbac.js'
import { authRoutes } from './modules/auth/routes.js'
import { registerSession } from './modules/auth/session.js'

export function buildApp(config: AppConfig) {
  const app = Fastify({ logger: config.NODE_ENV !== 'test' })

  app.register(cors, { origin: config.WEB_URL, credentials: true })
  app.register(cookie)
  // Đăng ký 1 lần; route cần giới hạn tự khai báo config.rateLimit (AGENTS.md).
  app.register(rateLimit, { global: false })
  registerErrorHandler(app)
  registerAuth(app)
  registerSession(app, config)

  app.get('/health', async () => ({ status: 'ok', service: 'apc-api' }))
  app.register(authRoutes(config))

  return app
}
