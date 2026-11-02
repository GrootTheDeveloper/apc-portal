import { z } from 'zod'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { currentUser, requireAuth, requireRole } from '../auth/rbac.js'
import { rateLimited } from '../../lib/errors.js'
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

/**
 * Khóa giới hạn tần suất theo cả địa chỉ nguồn lẫn email trong body (SEC-05):
 * Mỗi cặp (IP, email) có một ô đếm riêng. Cắt email ở 120 ký tự để tránh phình bộ nhớ cache.
 */
function rateLimitKey(prefix: string) {
  return (request: FastifyRequest) => {
    const body = request.body && typeof request.body === 'object' ? (request.body as Record<string, unknown>) : {}
    const email = String(body.applicantEmail ?? body.email ?? '')
    return `${prefix}:${request.ip}:${email.toLowerCase().trim().slice(0, 120)}`
  }
}

export async function recruitmentRoutes(app: FastifyInstance) {
  /**
   * Lớp 2 của chặn lạm dụng (SEC-05): Giới hạn theo mỗi địa chỉ nguồn (IP) —
   * Một IP xoay nhiều email vẫn chỉ gửi được tối đa 30 lượt/15 phút trên toàn bộ route công khai (E3).
   */
  const sourceIpLimiter = app.createRateLimit({
    max: 30,
    timeWindow: '15 minutes',
    keyGenerator: (request) => `recruitment-public:${request.ip}`,
  })

  const limitPerSourceIp = async (request: FastifyRequest) => {
    const result = await sourceIpLimiter(request)
    if (!result.isAllowed && result.isExceeded) {
      throw rateLimited('Bạn thao tác quá nhiều lần từ địa chỉ này. Vui lòng thử lại sau.')
    }
  }
  // ─── PUBLIC ROUTES ────────────────────────────────────────────────────────
  app.get('/public/recruitment-rounds', async (request) => {
    return listPublicRecruitmentRounds(request.query)
  })

  app.get('/public/recruitment-rounds/:slug', async (request) => {
    const { slug } = request.params as { slug: string }
    return getPublicRecruitmentRoundBySlug(slug)
  })
  
  // Nộp đơn ứng tuyển đợt tuyển công khai (R3, FLOW-04, SEC-05)
  app.post(
    '/public/recruitment-rounds/:slug/applications',
    {
      preHandler: limitPerSourceIp, // Lớp 2: chặn IP xoay email (> 30 lần/15p)
      config: {
        rateLimit: {
          max: 10, // Lớp 1: mỗi cặp (IP, email) tối đa 10 lần/15p
          timeWindow: '15 minutes',
          hook: 'preHandler',
          keyGenerator: rateLimitKey('recruitment-apply'),
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params as { slug: string }

      // Validate header Idempotency-Key bắt buộc chuẩn UUID nếu có gửi lên
      const rawKey = request.headers['idempotency-key']
      const idempotencyKey =
        typeof rawKey === 'string' && rawKey.trim() !== ''
          ? z.string().trim().uuid('Header Idempotency-Key phải có định dạng UUID hợp lệ.').parse(rawKey)
          : undefined

      const user = request.user
      const result = await submitApplication(slug, request.body, idempotencyKey, user)
      return reply.code(201).send(result)
    },
  )
  // Tra cứu hồ sơ (R4, FLOW-05, SEC-05)
  app.post(
    '/public/applications/lookup',
    {
      preHandler: limitPerSourceIp,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '15 minutes',
          hook: 'preHandler',
          keyGenerator: rateLimitKey('recruitment-lookup'),
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
      preHandler: limitPerSourceIp,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '15 minutes',
          hook: 'preHandler',
          keyGenerator: rateLimitKey('recruitment-withdraw'),
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