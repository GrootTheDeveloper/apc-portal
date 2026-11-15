import type { FastifyInstance } from 'fastify'

import type { AppConfig } from '../../config.js'
import { db } from '../../db/client.js'
import {
  createBodyEmailRateLimitKey,
  createLookupAttemptLimiter,
  createSourceIpLimiter,
} from '../../lib/rateLimit.js'
import { requireAuth, requireRole, requireScope } from '../auth/rbac.js'
import {
  archiveEvent,
  cancelEvent,
  cancelGuestRegistration,
  cancelMemberRegistration,
  createEvent,
  getAdminEvent,
  getPortalEvent,
  getPublicEventBySlug,
  listAdminEvents,
  listPortalEvents,
  listPublicEvents,
  lookupGuestRegistration,
  publishEvent,
  registerGuest,
  registerMember,
  updateEvent,
} from './service.js'

export function eventsRoutes(config: AppConfig) {
  return async function registerEventsRoutes(app: FastifyInstance) {
    /**
     * Lớp 2 của chặn lạm dụng (SEC-05): bên cạnh các giới hạn theo route, giới hạn theo mỗi địa chỉ nguồn —
     * một IP xoay email vẫn chỉ gửi được tối đa 30 lượt/15 phút trên cả ba route công khai của mảng sự kiện.
     */
    const limitPerSourceIp = createSourceIpLimiter(app, { prefix: 'event-public' })

    /**
     * Chặn dò mã của khách (SEC-05, cùng quy tắc R4): CHỈ lượt SAI (404 — sai email hoặc sai mã) mới tính
     * vào ô đếm của cặp (IP, email); lượt đúng giải tỏa ô đếm nên không tốn hạn mức. Sai quá
     * `LOOKUP_MAX_ATTEMPTS` lần trong 15 phút thì nhận 429 trong 15 phút.
     */
    const guestAttempts = createLookupAttemptLimiter({
      prefix: 'event-guest',
      maxAttempts: config.LOOKUP_MAX_ATTEMPTS,
    })

    /**
     * Danh sách sự kiện công khai (E2). Không yêu cầu đăng nhập (public/*).
     * Query: page, pageSize, type (tùy chọn), month=YYYY-MM (chế độ lịch, theo ngày Việt Nam),
     * upcoming=1 (chỉ sự kiện sắp diễn ra — khối trang chủ, FLOW-01; T4 sẽ thay bằng GET /public/home).
     * Chỉ trả sự kiện audience = PUBLIC ở trạng thái PUBLISHED, CANCELLED, ENDED.
     */
    app.get('/public/events', async (request) => {
      return listPublicEvents(request.query)
    })

    /**
     * Chi tiết sự kiện công khai theo slug. Không yêu cầu đăng nhập (public/*).
     * 404 nếu không tồn tại, DRAFT, ARCHIVED, hoặc audience nội bộ (CLUB/DEPARTMENT).
     */
    app.get('/public/events/:slug', async (request) => {
      const { slug } = request.params as { slug: string }
      return getPublicEventBySlug(slug)
    })

    /**
     * Khách đăng ký sự kiện công khai (E3, FLOW-14). Mã điều kiện gửi qua body, không đặt trên URL (OPS-11).
     * Tạo dữ liệu mới nên đếm MỌI lượt (cả lượt thành công) theo hai lớp: mỗi IP tối đa 30 lượt/15 phút
     * (preHandler bên dưới) và mỗi cặp (IP, email) tối đa 10 lượt/15 phút (config.rateLimit), vượt trả 429 (SEC-05).
     */
    app.post(
      '/public/events/:slug/registrations',
      {
        preHandler: limitPerSourceIp,
        config: {
          rateLimit: {
            max: 10,
            timeWindow: '15 minutes',
            hook: 'preHandler',
            keyGenerator: createBodyEmailRateLimitKey('event-register'),
          },
        },
      },
      async (request, reply) => {
        const { slug } = request.params as { slug: string }
        const result = await registerGuest(request.body, slug)
        return reply.code(201).send(result)
      },
    )

    /**
     * Tra cứu đăng ký của khách bằng email + mã (E3, PAGE-PUB-08). Sai email hay sai mã đều một lỗi chung;
     * chỉ lượt sai mới đếm vào ngưỡng chặn dò mã `LOOKUP_MAX_ATTEMPTS` trong 15 phút (SEC-05, cùng quy tắc R4).
     */
    app.post(
      '/public/event-registrations/lookup',
      { preHandler: [limitPerSourceIp, guestAttempts.limit] },
      guestAttempts.wrap(async (request) => lookupGuestRegistration(request.body)),
    )

    /** Hủy đăng ký của khách (E3, AC-09): trả về bản ghi vừa cập nhật; quy tắc chặn dò mã như tra cứu. */
    app.post(
      '/public/event-registrations/cancel',
      { preHandler: [limitPerSourceIp, guestAttempts.limit] },
      guestAttempts.wrap(async (request) => cancelGuestRegistration(request.body)),
    )

    // ─── PORTAL: THÀNH VIÊN (E5) ───────────────────────────────────────────
    // Thành viên đã đăng nhập (requireAuth — tài khoản chờ kích hoạt bị chặn 403). Phạm vi xem lọc
    // ngay trong truy vấn theo docs/plan E5: PUBLIC, CLUB, và DEPARTMENT của ban mình; mở thẳng link
    // ngoài phạm vi trả 404, không trả 403 (docs/02 mục 12). Không cần giới hạn tần suất như các
    // route công khai: mỗi lượt đều gắn tài khoản, lạm dụng truy được về người.

    /** Danh sách sự kiện cho thành viên (PAGE-MEM-04). Query: page, pageSize, type (tùy chọn), month=YYYY-MM (chế độ lịch). */
    app.get('/portal/events', { preHandler: requireAuth }, async (request) =>
      listPortalEvents(request, request.query),
    )

    /** Chi tiết sự kiện cho thành viên (PAGE-MEM-05), kèm đăng ký hiện có của chính người xem. */
    app.get('/portal/events/:id', { preHandler: requireAuth }, async (request) => {
      const { id } = request.params as { id: string }
      return getPortalEvent(request, id)
    })

    /**
     * Thành viên đăng ký sự kiện (FLOW-14 luồng 1): gắn userId, cùng các kiểm tra với khách (thời gian,
     * sức chứa, phạm vi xem). Idempotent: đã đăng ký trả 200 kèm trạng thái hiện tại, chưa thì 201.
     */
    app.post('/portal/events/:id/registrations', { preHandler: requireAuth }, async (request, reply) => {
      const { id } = request.params as { id: string }
      const result = await registerMember(request, id)
      return reply.code(result.alreadyRegistered ? 200 : 201).send(result)
    })

    /** Thành viên hủy đăng ký (AC-09): chỉ đến hết registrationClosesAt (BR-08); trả về bản ghi vừa cập nhật. */
    app.post('/portal/events/:id/registrations/cancel', { preHandler: requireAuth }, async (request) => {
      const { id } = request.params as { id: string }
      return cancelMemberRegistration(request, id)
    })

    // ─── QUẢN TRỊ (E4) ─────────────────────────────────────────────────────
    // Vai trò theo docs/02 §8.3: DEPARTMENT_MANAGER làm được với sự kiện ban mình (requireScope → 404
    // nếu mở sự kiện ban khác), BOARD làm được với tất cả. Riêng công bố CLUB/PUBLIC chặn thêm ở service.

    /** Phạm vi ban của sự kiện theo id trên URL: không tồn tại và ngoài phạm vi ban cùng trả 404 (docs/02 mục 12). */
    const loadEventScope = ({ id }: { id: string }) =>
      db.event.findUnique({ where: { id }, select: { departmentId: true } })
    const adminPreHandler = [requireRole('DEPARTMENT_MANAGER', 'BOARD'), requireScope(loadEventScope)]

    /** Danh sách sự kiện cho trang quản trị. Query: page, pageSize, status, audience, departmentId. */
    app.get('/admin/events', { preHandler: requireRole('DEPARTMENT_MANAGER', 'BOARD') }, async (request) =>
      listAdminEvents(request, request.query),
    )

    /** Tạo sự kiện mới ở trạng thái DRAFT; quản lý ban tự gán ban mình, BOARD chọn được ban khác (ORG-06). */
    app.post('/admin/events', { preHandler: requireRole('DEPARTMENT_MANAGER', 'BOARD') }, async (request, reply) => {
      const event = await createEvent(request, request.body)
      return reply.code(201).send(event)
    })

    /** Chi tiết sự kiện cho trang quản trị, kèm `registeredCount` (FLOW-15). */
    app.get('/admin/events/:id', { preHandler: adminPreHandler }, async (request) => {
      const { id } = request.params as { id: string }
      return getAdminEvent(id)
    })

    /** Sửa nội dung sự kiện; chỉ DRAFT và PUBLISHED sửa được (sai trạng thái trả 409). */
    app.patch('/admin/events/:id', { preHandler: adminPreHandler }, async (request) => {
      const { id } = request.params as { id: string }
      return updateEvent(request, id, request.body)
    })

    /** Công bố (DRAFT → PUBLISHED); sai bước trả 409, sai đối tượng với quản lý ban trả 403. */
    app.post('/admin/events/:id/publish', { preHandler: adminPreHandler }, async (request) => {
      const { id } = request.params as { id: string }
      return publishEvent(request, id)
    })

    /** Hủy (PUBLISHED → CANCELLED) với lý do bắt buộc trong body; giữ đăng ký và gửi email báo hủy (EVT-09). */
    app.post('/admin/events/:id/cancel', { preHandler: adminPreHandler }, async (request) => {
      const { id } = request.params as { id: string }
      return cancelEvent(request, id, request.body)
    })

    /** Lưu trữ (từ CANCELLED hoặc ENDED); PUBLISHED → ENDED do tác vụ nền 'event-end' làm, không có route. */
    app.post('/admin/events/:id/archive', { preHandler: adminPreHandler }, async (request) => {
      const { id } = request.params as { id: string }
      return archiveEvent(request, id)
    })
  }
}
