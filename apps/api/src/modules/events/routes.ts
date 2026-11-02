import type { FastifyInstance } from 'fastify'

import type { AppConfig } from '../../config.js'
import {
  createBodyEmailRateLimitKey,
  createLookupAttemptLimiter,
  createSourceIpLimiter,
} from '../../lib/rateLimit.js'
import { cancelGuestRegistration, getPublicEventBySlug, listPublicEvents, lookupGuestRegistration, registerGuest } from './service.js'

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
  }
}
