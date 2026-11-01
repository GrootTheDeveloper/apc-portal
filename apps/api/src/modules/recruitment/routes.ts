import type { FastifyInstance } from 'fastify'
import { currentUser, requireAuth, requireRole } from '../auth/rbac.js'
import {
  changeRecruitmentRoundStatus,
  createRecruitmentRound,
  getAdminRecruitmentRoundById,
  getPublicRecruitmentRoundBySlug,
  listAdminRecruitmentRounds,
  listPublicRecruitmentRounds,
  lookupApplication,
  submitApplication,
  updateRecruitmentRound,
  withdrawApplication,
} from './service.js'

export async function recruitmentRoutes(app: FastifyInstance) {
  // ─── PUBLIC ROUTES ────────────────────────────────────────────────────────
  app.get('/public/recruitment-rounds', async (request) => {
    return listPublicRecruitmentRounds(request.query)
  })

  app.get('/public/recruitment-rounds/:slug', async (request) => {
    const { slug } = request.params as { slug: string }
    return getPublicRecruitmentRoundBySlug(slug)
  })
  
    // Nộp đơn ứng tuyển đợt tuyển công khai (R3, FLOW-04)
  app.post(
    '/public/recruitment-rounds/:slug/applications',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { slug } = request.params as { slug: string }
      const idempotencyKey = (request.headers['idempotency-key'] as string | undefined)?.trim()
      const user = request.user
      const result = await submitApplication(slug, request.body, idempotencyKey, user)
      return reply.code(201).send(result)
    },
  )
   // Tra cứu hồ sơ (R4, FLOW-05, SEC-05)
  app.post(
    '/public/applications/lookup',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '15 minutes',
          hook: 'preHandler',
          keyGenerator: (request) => {
            const body = request.body as { email?: string } | undefined
            const email = body?.email?.toLowerCase().trim() || ''
            return `${request.ip}:${email}`
          },
        },
      },
    },
    async (request) => {
      return lookupApplication(request.body)
    },
  )
  app.post(
    '/public/applications/withdraw',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '15 minutes',
          hook: 'preHandler',
          keyGenerator: (request) => {
            const body = request.body as { email?: string } | undefined
            const email = body?.email?.toLowerCase().trim() || ''
            return `${request.ip}:${email}`
          },
        },
      },
    },
    async (request) => {
      return withdrawApplication(request, request.body)
    },
  )

  // ─── ADMIN ROUTES ─────────────────────────────────────────────────────────

  // Danh sách đợt tuyển: BOARD hoặc DEPARTMENT_MANAGER
  app.get(
    '/admin/recruitment',
    { preHandler: [requireAuth, requireRole('BOARD', 'DEPARTMENT_MANAGER')] },
    async (request) => {
      const user = currentUser(request)
      return listAdminRecruitmentRounds(user, request.query)
    },
  )

  // Chi tiết đợt tuyển & Xem trước: BOARD hoặc DEPARTMENT_MANAGER (theo ban có hồ sơ)
  app.get(
    '/admin/recruitment/:id',
    { preHandler: [requireAuth, requireRole('BOARD', 'DEPARTMENT_MANAGER')] },
    async (request) => {
      const { id } = request.params as { id: string }
      const user = currentUser(request)
      return getAdminRecruitmentRoundById(id, user)
    },
  )

  app.get(
    '/admin/recruitment/:id/preview',
    { preHandler: [requireAuth, requireRole('BOARD', 'DEPARTMENT_MANAGER')] },
    async (request) => {
      const { id } = request.params as { id: string }
      const user = currentUser(request)
      return getAdminRecruitmentRoundById(id, user)
    },
  )

  // Tạo đợt tuyển: Chỉ BOARD
  app.post(
    '/admin/recruitment',
    { preHandler: [requireAuth, requireRole('BOARD')] },
    async (request, reply) => {
      const user = currentUser(request)
      const round = await createRecruitmentRound(request, request.body, user)
      reply.status(201)
      return round
    },
  )

  // Cập nhật đợt tuyển: Chỉ BOARD
  app.patch(
    '/admin/recruitment/:id',
    { preHandler: [requireAuth, requireRole('BOARD')] },
    async (request) => {
      const { id } = request.params as { id: string }
      return updateRecruitmentRound(request, id, request.body)
    },
  )

  // Chuyển trạng thái (OPEN, CLOSED, ARCHIVED): Chỉ BOARD
  app.post(
    '/admin/recruitment/:id/status',
    { preHandler: [requireAuth, requireRole('BOARD')] },
    async (request) => {
      const { id } = request.params as { id: string }
      return changeRecruitmentRoundStatus(request, id, request.body)
    },
  )
}