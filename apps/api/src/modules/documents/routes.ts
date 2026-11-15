import type { FastifyInstance } from 'fastify'

import { currentUser, hasRole, requireAuth, requireRole } from '../auth/rbac.js'
import { notFound } from '../../lib/errors.js'
import type { FilesContext } from '../files/service.js'
import {
  archiveDocument,
  createDocument,
  downloadDocumentVersion,
  getAdminDocument,
  getDocumentStorageMetadata,
  getPortalDocument,
  listAdminDocuments,
  listAdminVersions,
  listPortalDocuments,
  replaceDocumentFile,
  restoreDocument,
  restoreDocumentVersion,
  updateDocument,
} from './service.js'

const documentManagers = requireRole('DEPARTMENT_MANAGER', 'BOARD')
const techAdmin = requireRole('TECH_ADMIN')

// TECH_ADMIN không được biết tài liệu nghiệp vụ tồn tại (docs/02 §8.5).
async function hideDocumentContentFromTech(request: Parameters<typeof currentUser>[0]) {
  if (hasRole(currentUser(request), 'TECH_ADMIN')) throw notFound()
}

export function documentsRoutes(context: FilesContext) {
  return async function registerDocumentsRoutes(app: FastifyInstance) {
    app.get('/admin/documents', { preHandler: [requireAuth, hideDocumentContentFromTech, documentManagers] }, (request) =>
      listAdminDocuments(currentUser(request), request.query),
    )

    app.post('/admin/documents', { preHandler: [requireAuth, hideDocumentContentFromTech, documentManagers] }, async (request, reply) => {
      const document = await createDocument(request as typeof request & { user: NonNullable<typeof request.user> }, request.body)
      return reply.code(201).send(document)
    })

    app.get('/admin/documents/:id', { preHandler: [requireAuth, hideDocumentContentFromTech, documentManagers] }, (request) =>
      getAdminDocument(currentUser(request), request.params),
    )

    app.patch('/admin/documents/:id', { preHandler: [requireAuth, hideDocumentContentFromTech, documentManagers] }, (request) =>
      updateDocument(request as typeof request & { user: NonNullable<typeof request.user> }, request.params, request.body),
    )

    app.post('/admin/documents/:id/versions', { preHandler: [requireAuth, hideDocumentContentFromTech, documentManagers] }, (request) =>
      replaceDocumentFile(request as typeof request & { user: NonNullable<typeof request.user> }, request.params, request.body),
    )

    app.get('/admin/documents/:id/versions', { preHandler: [requireAuth, hideDocumentContentFromTech, documentManagers] }, (request) =>
      listAdminVersions(currentUser(request), request.params),
    )

    app.post('/admin/documents/:id/versions/:versionId/restore', { preHandler: [requireAuth, hideDocumentContentFromTech, documentManagers] }, (request) =>
      restoreDocumentVersion(request as typeof request & { user: NonNullable<typeof request.user> }, request.params, request.body),
    )

    app.post('/admin/documents/:id/archive', { preHandler: [requireAuth, hideDocumentContentFromTech, documentManagers] }, (request) =>
      archiveDocument(request as typeof request & { user: NonNullable<typeof request.user> }, request.params, request.body),
    )

    app.post('/admin/documents/:id/restore', { preHandler: [requireAuth, hideDocumentContentFromTech, documentManagers] }, (request) =>
      restoreDocument(request as typeof request & { user: NonNullable<typeof request.user> }, request.params, request.body),
    )

    // Endpoint riêng theo quyền INCIDENT: chỉ metadata lưu trữ, không trả nội dung tài liệu.
    app.post('/admin/documents/:id/versions/:versionId/metadata', { preHandler: [requireAuth, techAdmin] }, (request) =>
      getDocumentStorageMetadata(request, request.params, request.body),
    )

    app.get('/portal/documents', { preHandler: requireAuth }, (request) =>
      listPortalDocuments(currentUser(request), request.query),
    )

    app.get('/portal/documents/:id', { preHandler: requireAuth }, (request) =>
      getPortalDocument(currentUser(request), request.params),
    )

    app.get('/portal/documents/:id/versions/:versionId/download', { preHandler: requireAuth }, (request, reply) =>
      downloadDocumentVersion(context, currentUser(request), reply, request.params),
    )
  }
}
