import type { FastifyPluginAsync } from 'fastify'

import { requireRole } from '../auth/rbac.js'
import {
  createAdminDepartment,
  getAdminDepartment,
  getAdminFeaturedContent,
  getAdminProfile,
  getPublicHome,
  listAdminDepartments,
  reorderAdminDepartments,
  updateAdminDepartment,
  updateAdminFeaturedContent,
  updateAdminProfile,
} from './service.js'

export const organizationRoutes: FastifyPluginAsync = async (app) => {
  // Public route: GET /public/home
  app.get('/public/home', () => getPublicHome())

  // Admin routes: Chỉ vai trò BOARD (PAGE-MGT-ORG-01 đến 05, FLOW-24)
  app.register(async (admin) => {
    admin.addHook('preHandler', requireRole('BOARD'))

    // Profile
    admin.get('/admin/organization/profile', () => getAdminProfile())
    admin.put('/admin/organization/profile', (request) => updateAdminProfile(request, request.body))

    // Departments: Route tĩnh /order khai báo trước route động /:id
    admin.get('/admin/organization/departments', () => listAdminDepartments())
    admin.post('/admin/organization/departments', (request) => createAdminDepartment(request, request.body))
    admin.put('/admin/organization/departments/order', (request) => reorderAdminDepartments(request, request.body))
    admin.get<{ Params: { id: string } }>('/admin/organization/departments/:id', (request) =>
      getAdminDepartment(request.params.id),
    )
    admin.patch<{ Params: { id: string } }>('/admin/organization/departments/:id', (request) =>
      updateAdminDepartment(request, request.params.id, request.body),
    )

    // Featured Content
    admin.get('/admin/organization/featured-content', () => getAdminFeaturedContent())
    admin.put('/admin/organization/featured-content', (request) => updateAdminFeaturedContent(request, request.body))
  })
}
