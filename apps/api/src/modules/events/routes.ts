import type { FastifyInstance, FastifyRequest } from 'fastify'

import { cancelGuestRegistration, getPublicEventBySlug, listPublicEvents, lookupGuestRegistration, registerGuest } from './service.js'

/**
 * Khóa giới hạn tần suất theo cả địa chỉ nguồn lẫn email trong body (SEC-05): mỗi cặp (IP, email)
 * một ô đếm riêng, ô của các route khác nhau không dính nhau. Body đọc được vì hook chạy sau khi parse.
 */
function rateLimitKey(prefix: string) {
  return (request: FastifyRequest) => {
    const email = request.body && typeof request.body === 'object' ? String((request.body as { email?: unknown }).email ?? '') : ''
    return `${prefix}:${request.ip}:${email.toLowerCase()}`
  }
}

export function eventsRoutes() {
  return async function registerEventsRoutes(app: FastifyInstance) {
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
     * Chặn lạm dụng form công khai: mỗi (IP, email) tối đa 10 lượt/15 phút, vượt trả 429 (SEC-05).
     */
    app.post(
      '/public/events/:slug/registrations',
      {
        config: {
          rateLimit: {
            max: 10,
            timeWindow: '15 minutes',
            hook: 'preHandler',
            keyGenerator: rateLimitKey('event-register'),
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
     * Tra cứu đăng ký của khách bằng email + mã (E3, PAGE-PUB-08). Sai email hay sai mã đều một lỗi
     * chung; chặn dò mã: mỗi (IP, email) tối đa 5 lượt/15 phút, lượt thứ 6 nhận 429 (SEC-05, cùng quy tắc R4).
     */
    app.post(
      '/public/event-registrations/lookup',
      {
        config: {
          rateLimit: {
            max: 5,
            timeWindow: '15 minutes',
            hook: 'preHandler',
            keyGenerator: rateLimitKey('event-lookup'),
          },
        },
      },
      async (request) => lookupGuestRegistration(request.body),
    )

    /** Hủy đăng ký của khách (E3, AC-09): cùng quy tắc chặn dò mã như tra cứu. */
    app.post(
      '/public/event-registrations/cancel',
      {
        config: {
          rateLimit: {
            max: 5,
            timeWindow: '15 minutes',
            hook: 'preHandler',
            keyGenerator: rateLimitKey('event-cancel'),
          },
        },
      },
      async (request) => cancelGuestRegistration(request.body),
    )
  }
}
