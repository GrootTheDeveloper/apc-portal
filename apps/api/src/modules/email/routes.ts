import type { FastifyInstance } from 'fastify'

import { db } from '../../db/client.js'
import { notFound } from '../../lib/errors.js'
import { currentUser, requireRole } from '../auth/rbac.js'
import { enqueueEmail } from './service.js'

export async function emailRoutes(app: FastifyInstance) {
  // Gửi email thử tới chính người bấm để kiểm tra cấu hình SMTP (sau deploy, O4). Đi qua hàng đợi như email thật.
  app.post(
    '/admin/email/test',
    { preHandler: requireRole('TECH_ADMIN'), config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { id } = currentUser(request)
      const user = await db.user.findUnique({ where: { id }, select: { email: true } })
      if (!user) throw notFound()
      const delivery = await enqueueEmail(db, { type: 'TEST', to: user.email, refType: 'USER', refId: id })
      return reply.code(202).send({ id: delivery.id })
    },
  )
}
