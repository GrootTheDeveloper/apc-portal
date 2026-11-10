import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { requireAuth } from '../auth/rbac.js'
import { downloadExport, type ExportsContext } from './service.js'

const exportParamsSchema = z.object({ id: z.string().min(1).max(64) })

export function exportsRoutes(context: ExportsContext) {
  return async function registerExportsRoutes(app: FastifyInstance) {
    app.get('/portal/exports/:id/download', { preHandler: requireAuth }, async (request, reply) => {
      const { id } = exportParamsSchema.parse(request.params)
      return downloadExport(context, request, reply, id)
    })
  }
}
