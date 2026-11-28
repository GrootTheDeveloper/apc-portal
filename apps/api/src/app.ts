import { randomUUID } from 'node:crypto'

import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'

import type { AppConfig } from './config.js'
import { registerErrorHandler } from './lib/errors.js'
import { aboutRoutes } from './modules/about/routes.js'
import { registerAuth } from './modules/auth/rbac.js'
import { accountRoutes } from './modules/accounts/routes.js'
import { authRoutes } from './modules/auth/routes.js'
import { adminPostsRoutes } from './modules/content/admin-posts.routes.js'
import { adminProjectsRoutes } from './modules/content/admin-projects.routes.js'
import { contentRoutes } from './modules/content/routes.js'
import { portalAnnouncementsRoutes } from './modules/content/portal-announcements.routes.js'
import { registerSession } from './modules/auth/session.js'
import { emailRoutes } from './modules/email/routes.js'
import { eventsRoutes } from './modules/events/routes.js'
import { filesRoutes } from './modules/files/routes.js'
import { createScanner } from './modules/files/scan.js'
import { createS3Storage, type FileStorage } from './modules/files/storage.js'
import { organizationRoutes } from './modules/organization/routes.js'
import { exportsRoutes } from './modules/exports/routes.js'
import { documentsRoutes } from './modules/documents/routes.js'
import { memberRoutes } from './modules/members/routes.js'
import { portalRoutes } from './modules/portal/routes.js'
import { recruitmentRoutes } from './modules/recruitment/routes.js'

/** Phụ thuộc thay được khi test (vd kho tệp trong bộ nhớ: `createMemoryStorage()`). */
export type AppDeps = { storage?: FileStorage }

// Đúng dạng UUID phiên bản 4; x-request-id sai dạng thì tự sinh mã mới (OPS-11, C6).
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function buildApp(config: AppConfig, deps: AppDeps = {}) {
  const app = Fastify({
    // Mã tham chiếu (C6, OPS-11): genReqId chạy trước khi Fastify bind child logger theo reqId, nên id
    // trong log khớp với header trả về. Dùng tự viết thay vì mặc định (req-1, req-2...) để nhận
    // x-request-id của Nginx nếu đúng dạng UUID v4, không thì tự sinh UUID.
    genReqId: (req) => {
      const headerValue = req.headers['x-request-id']
      const headerStr = Array.isArray(headerValue) ? headerValue[0] : headerValue
      return headerStr && UUID_V4_REGEX.test(headerStr) ? headerStr : randomUUID()
    },
    logger:
      config.NODE_ENV === 'test'
        ? false
        : {
            redact: {
              // Bỏ header nhạy cảm khỏi log (OPS-11); giữ x-request-id để grep log theo mã tham chiếu.
              paths: ['req.headers.cookie', 'req.headers.authorization'],
              censor: '[REDACTED]',
            },
          },
  })
  const storage = deps.storage ?? createS3Storage(config)
  const scanner = createScanner(config)

  // Trả lại mã tham chiếu trong header của mọi phản hồi để người dùng báo mã khi gặp lỗi hệ thống.
  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('x-request-id', request.id)
    return payload
  })

  app.register(cors, { origin: config.WEB_URL, credentials: true })
  app.register(cookie)
  // Đăng ký 1 lần; route cần giới hạn tự khai báo config.rateLimit (AGENTS.md).
  app.register(rateLimit, { global: false })
  registerErrorHandler(app)
  registerAuth(app)
  registerSession(app, config)

  app.get('/health', async () => ({ status: 'ok', service: 'apc-api' }))
  app.register(authRoutes(config))
  app.register(accountRoutes(config))
  app.register(emailRoutes)
  app.register(portalRoutes)
  app.register(contentRoutes({ storage, scanner: createScanner(config) }))
  app.register(adminPostsRoutes())
  app.register(adminProjectsRoutes())
  app.register(portalAnnouncementsRoutes())
  app.register(eventsRoutes(config, { storage }))
  app.register(aboutRoutes)
  app.register(organizationRoutes)
  app.register(memberRoutes(config, { storage }))
  app.register(filesRoutes({ storage, scanner }))
  app.register(exportsRoutes({ storage }))
  app.register(documentsRoutes({ storage, scanner }))

  app.register(recruitmentRoutes(config, { storage }))

  // Route chỉ để kiểm tra mã tham chiếu lỗi 500 ở bản phát triển (C6); không tồn tại ở production.
  if (config.NODE_ENV !== 'production') {
    app.get('/public/_test/500', async () => {
      throw new Error('C6 test error — trigger 500')
    })
  }

  return app
}
