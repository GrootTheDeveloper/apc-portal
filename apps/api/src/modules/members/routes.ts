import type { FastifyInstance } from 'fastify'

import type { AppConfig } from '../../config.js'
import { requireRole } from '../auth/rbac.js'
import { getMemberDetail, listMembers, updateMember } from './service.js'

const BOARD = requireRole('BOARD')
const MANAGER_OR_BOARD = requireRole('DEPARTMENT_MANAGER', 'BOARD')

type IdParams = { Params: { id: string } }

export function memberRoutes(config: AppConfig) {
  const options = () => ({ enforcePrivilegedMinimum: config.ENFORCE_PRIVILEGED_MINIMUM })

  return async function registerMemberRoutes(app: FastifyInstance) {
    app.get('/admin/members', { preHandler: MANAGER_OR_BOARD }, async (request) => {
      return listMembers(request, request.query)
    })

    app.get<IdParams>('/admin/members/:id', { preHandler: MANAGER_OR_BOARD }, async (request) => {
      return getMemberDetail(request, request.params.id)
    })

    app.patch<IdParams>('/admin/members/:id', { preHandler: BOARD }, async (request) => {
      return updateMember(request, request.params.id, request.body, options())
    })
  }
}
