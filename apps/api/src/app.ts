import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'

import type { AppConfig } from './config.js'
import { registerErrorHandler } from './lib/errors.js'
import { aboutRoutes } from './modules/about/routes.js'
import { registerAuth } from './modules/auth/rbac.js'
import { authRoutes } from './modules/auth/routes.js'
import { contentRoutes } from './modules/content/routes.js'
import { registerSession } from './modules/auth/session.js'
import { emailRoutes } from './modules/email/routes.js'
import { filesRoutes } from './modules/files/routes.js'
import { createScanner } from './modules/files/scan.js'
import { createS3Storage, type FileStorage } from './modules/files/storage.js'

/** Phụ thuộc thay được khi test (vd kho tệp trong bộ nhớ: `createMemoryStorage()`). */
export type AppDeps = { storage?: FileStorage }

export function buildApp(config: AppConfig, deps: AppDeps = {}) {
  const app = Fastify({ logger: config.NODE_ENV !== 'test' })
  const storage = deps.storage ?? createS3Storage(config)

  app.register(cors, { origin: config.WEB_URL, credentials: true })
  app.register(cookie)
  // Đăng ký 1 lần; route cần giới hạn tự khai báo config.rateLimit (AGENTS.md).
  app.register(rateLimit, { global: false })
  registerErrorHandler(app)
  registerAuth(app)
  registerSession(app, config)

  app.get('/health', async () => ({ status: 'ok', service: 'apc-api' }))
  app.register(authRoutes(config))
  app.register(emailRoutes)
  app.register(contentRoutes())
  app.register(aboutRoutes)
  app.register(filesRoutes({ storage, scanner: createScanner(config) }))

  return app
}
