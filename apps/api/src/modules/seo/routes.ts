import type { FastifyInstance } from 'fastify'

import { loadConfig } from '../../config.js'
import { buildRobots } from './robots.service.js'
import { buildSitemap } from './sitemap.service.js'

/** Route sitemap.xml / robots.txt (C6). Đăng ký bằng đúng 1 dòng `app.register(seoRoutes)` nên config
 *  nạp ở đây; loadConfig chỉ đọc biến môi trường đã được server.ts nạp, gọi lại không gây tác dụng phụ. */
export async function seoRoutes(app: FastifyInstance) {
  const config = loadConfig()

  app.get('/public/sitemap.xml', async (_request, reply) => {
    const content = await buildSitemap(config)
    return reply.header('Content-Type', 'application/xml; charset=utf-8').send(content)
  })

  app.get('/public/robots.txt', async (_request, reply) => {
    const content = buildRobots(config)
    return reply.header('Content-Type', 'text/plain; charset=utf-8').send(content)
  })
}