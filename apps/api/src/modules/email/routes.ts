import type { FastifyInstance } from 'fastify'

import { db } from '../../db/client.js'
import { notFound } from '../../lib/errors.js'
import { currentUser, requireRole, requireScope } from '../auth/rbac.js'
import {
  enqueueEmail, getDelivery, getDeliveryAsIncident, listDeliveries, retryDelivery, searchDeliveriesAsIncident,
} from './service.js'

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

  // Theo dõi email (O3, NTF-04). Trưởng ban: ban mình; BOARD: tất cả.
  const viewers = requireRole('DEPARTMENT_MANAGER', 'BOARD')
  app.get('/admin/email-deliveries', { preHandler: viewers }, (request) => listDeliveries(currentUser(request), request.query))
  app.get(
    '/admin/email-deliveries/:id',
    {
      preHandler: [
        viewers,
        requireScope(({ id }) => db.notificationDelivery.findUnique({ where: { id }, select: { departmentId: true } })),
      ],
    },
    (request) => getDelivery(request.params),
  )
  // TECH_ADMIN chỉ theo quyền INCIDENT: mã sự cố và lý do nằm trong body (không đặt trên URL).
  app.post('/admin/email-deliveries/search', { preHandler: requireRole('TECH_ADMIN') }, (request) =>
    searchDeliveriesAsIncident(request, request.body),
  )
  app.post('/admin/email-deliveries/:id/metadata', { preHandler: requireRole('TECH_ADMIN') }, (request) =>
    getDeliveryAsIncident(request, request.params, request.body),
  )
  app.post('/admin/email-deliveries/:id/retry', { preHandler: requireRole('BOARD', 'TECH_ADMIN') }, (request) =>
    retryDelivery(request, currentUser(request), request.params, request.body),
  )
}
