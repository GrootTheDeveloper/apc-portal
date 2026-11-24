import type { FastifyInstance } from 'fastify'

import { currentUser, requireAuth } from '../auth/rbac.js'
import { getAnnouncementById, listAnnouncements } from './portal-announcements.service.js'

/** API thông báo nội bộ cho thành viên (C5): chỉ bài PUBLISHED + INTERNAL, lọc theo đối tượng nhận. */
export function portalAnnouncementsRoutes() {
  return async function registerPortalAnnouncementsRoutes(app: FastifyInstance) {
    app.get('/portal/announcements', { preHandler: [requireAuth] }, (request) =>
      listAnnouncements(currentUser(request), request.query),
    )

    app.get('/portal/announcements/:id', { preHandler: [requireAuth] }, (request) =>
      getAnnouncementById(currentUser(request), request.params),
    )
  }
}
