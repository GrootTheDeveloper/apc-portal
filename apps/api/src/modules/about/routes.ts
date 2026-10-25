import type { FastifyPluginAsync } from 'fastify'

import { getAbout } from './service.js'

export const aboutRoutes: FastifyPluginAsync = async (app) => {
  // GET /public/about — không cần đăng nhập
  app.get('/public/about', () => getAbout())
}
