import type { FastifyInstance } from 'fastify'

import type { AppConfig } from '../../config.js'
import { db } from '../../db/client.js'
import { currentUser, requireRole } from '../auth/rbac.js'
import {
  createAccount,
  createAccountSchema,
  deactivateFromAdmin,
  getAccount,
  listAccounts,
  listActiveDepartments,
  lockAccount,
  resetTemporaryPassword,
  revokeSessionsFromAdmin,
  unlockAccount,
} from './service.js'

// Quyền theo Vai trò & quyền §8.2 (phiếu A5):
//   tạo, cấp lại mật khẩu tạm, mở khóa, ngừng hoạt động: BOARD
//   khóa: BOARD; TECH_ADMIN chỉ kèm mã sự cố (INCIDENT, kiểm trong service)
//   thu hồi toàn bộ phiên, xem danh sách/chi tiết: BOARD và TECH_ADMIN (mỗi bên thấy trường khác nhau)
const BOARD = requireRole('BOARD')
const BOARD_OR_TECH = requireRole('BOARD', 'TECH_ADMIN')

type IdParams = { Params: { id: string } }

export function accountRoutes(config: AppConfig) {
  const options = () => ({ enforcePrivilegedMinimum: config.ENFORCE_PRIVILEGED_MINIMUM })

  return async function registerAccountRoutes(app: FastifyInstance) {
    app.get('/admin/accounts', { preHandler: BOARD_OR_TECH }, async (request) =>
      listAccounts(currentUser(request), request.query),
    )

    app.get('/admin/accounts/departments', { preHandler: BOARD }, async () => listActiveDepartments())

    app.get<IdParams>('/admin/accounts/:id', { preHandler: BOARD_OR_TECH }, async (request) =>
      getAccount(currentUser(request), request.params.id),
    )

    // Mật khẩu tạm chỉ có trong phản hồi này (STATE-03).
    app.post('/admin/accounts', { preHandler: BOARD }, async (request, reply) => {
      const input = createAccountSchema.parse(request.body)
      const result = await db.$transaction((tx) => createAccount(tx, request, input))
      return reply.code(201).send(result)
    })

    app.post<IdParams>('/admin/accounts/:id/lock', { preHandler: BOARD_OR_TECH }, async (request, reply) => {
      await lockAccount(request, request.params.id, request.body, options())
      return reply.code(204).send()
    })

    app.post<IdParams>('/admin/accounts/:id/unlock', { preHandler: BOARD }, async (request, reply) => {
      await unlockAccount(request, request.params.id, request.body)
      return reply.code(204).send()
    })

    app.post<IdParams>('/admin/accounts/:id/reset-password', { preHandler: BOARD }, async (request) =>
      resetTemporaryPassword(request, request.params.id, request.body, options()),
    )

    app.post<IdParams>('/admin/accounts/:id/deactivate', { preHandler: BOARD }, async (request, reply) => {
      await deactivateFromAdmin(request, request.params.id, request.body, options())
      return reply.code(204).send()
    })

    app.post<IdParams>('/admin/accounts/:id/revoke-sessions', { preHandler: BOARD_OR_TECH }, async (request) =>
      revokeSessionsFromAdmin(request, request.params.id, request.body),
    )
  }
}
