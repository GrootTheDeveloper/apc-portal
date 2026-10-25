import type { FastifyPluginAsync } from 'fastify'

import { getAbout } from './service.js'

export const aboutRoutes: FastifyPluginAsync = async (app) => {
  // GET /public/about — không cần đăng nhập
  app.get('/public/about', async (_request, reply) => {
    const data = await getAbout()
    return reply.send(data)
  })
}
