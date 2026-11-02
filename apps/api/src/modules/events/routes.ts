import type { FastifyInstance, FastifyRequest } from 'fastify'

import type { AppConfig } from '../../config.js'
import { AppError, rateLimited } from '../../lib/errors.js'
import { cancelGuestRegistration, getPublicEventBySlug, listPublicEvents, lookupGuestRegistration, registerGuest } from './service.js'

/**
 * Khóa giới hạn tần suất đăng ký theo cả địa chỉ nguồn lẫn email trong body (SEC-05): mỗi cặp (IP, email)
 * một ô đếm riêng. Body đọc được vì hook chạy sau khi parse; email cắt ở 120 ký tự để body khổng lồ
 * không phình khóa trong kho đếm.
 */
function rateLimitKey(prefix: string) {
  return (request: FastifyRequest) => {
    const email = request.body && typeof request.body === 'object' ? String((request.body as { email?: unknown }).email ?? '') : ''
    return `${prefix}:${request.ip}:${email.toLowerCase().slice(0, 120)}`
  }
}

export function eventsRoutes(config: AppConfig) {
  return async function registerEventsRoutes(app: FastifyInstance) {
    /**
     * Lớp 2 của chặn lạm dụng (SEC-05): bên cạnh các giới hạn theo route, giới hạn theo mỗi địa chỉ nguồn —
     * một IP xoay email vẫn chỉ gửi được tối đa 30 lượt/15 phút trên cả ba route công khai của mảng sự kiện.
     * Dùng `createRateLimit` của chính plugin để có bộ đếm độc lập trong cùng kho: hàm `rateLimit()` có
     * cờ "đã chạy" chung nên không xếp lớp được hai lần trên một route.
     */
    const sourceIpLimiter = app.createRateLimit({
      max: 30,
      timeWindow: '15 minutes',
      keyGenerator: (request) => `event-public:${request.ip}`,
    })

    /** PreHandler dùng chung cho ba route: vượt ngưỡng theo IP thì 429, cùng dạng lỗi với các giới hạn còn lại. */
    const limitPerSourceIp = async (request: FastifyRequest) => {
      const result = await sourceIpLimiter(request)
      // `isAllowed: false` chỉ nghĩa là "không nằm trong allowList"; chặn khi bộ đếm thực sự vượt max.
      if (!result.isAllowed && result.isExceeded) {
        throw rateLimited('Bạn thao tác quá nhiều lần từ địa chỉ này. Vui lòng thử lại sau.')
      }
    }

    /**
     * Chặn dò mã của khách (SEC-05, cùng quy tắc R4): CHỈ lượt SAI (404 — sai email hoặc sai mã) mới tính
     * vào ô đếm của cặp (IP, email); lượt đúng giải tỏa ô đếm nên không tốn hạn mức. Sai quá
     * `LOOKUP_MAX_ATTEMPTS` lần trong 15 phút thì nhận 429 trong 15 phút. Không dùng `config.rateLimit`
     * của plugin cho việc này vì nó đếm cả lượt đúng; ngưỡng đọc từ cấu hình để nâng lên khi chạy e2e.
     */
    const FAILURE_WINDOW_MS = 15 * 60_000
    const failureBuckets = new Map<string, { count: number; resetAt: number }>()

    function guestAttemptKey(request: FastifyRequest) {
      const email = request.body && typeof request.body === 'object' ? String((request.body as { email?: unknown }).email ?? '') : ''
      return `event-guest:${request.ip}:${email.toLowerCase().slice(0, 120)}`
    }

    const guestAttempts = {
      /** Chặn trước khi xử lý: ô đếm của cặp này đã đạt ngưỡng trong 15 phút thì 429 ngay, không cho dò tiếp. */
      limit: async (request: FastifyRequest) => {
        const now = Date.now()
        const bucket = failureBuckets.get(guestAttemptKey(request))
        if (bucket && bucket.resetAt > now && bucket.count >= config.LOOKUP_MAX_ATTEMPTS) {
          throw rateLimited(`Bạn nhập sai quá ${config.LOOKUP_MAX_ATTEMPTS} lần. Vui lòng thử lại sau 15 phút.`)
        }
      },
      /** Ghi một lượt sai; cửa sổ 15 phút đếm lại từ lần sai đầu tiên. */
      noteFailure: (request: FastifyRequest) => {
        const key = guestAttemptKey(request)
        const now = Date.now()
        if (failureBuckets.size > 10_000) {
          for (const [staleKey, stale] of failureBuckets) if (stale.resetAt <= now) failureBuckets.delete(staleKey)
        }
        const bucket = failureBuckets.get(key)
        if (!bucket || bucket.resetAt <= now) failureBuckets.set(key, { count: 1, resetAt: now + FAILURE_WINDOW_MS })
        else bucket.count += 1
      },
      /** Lượt đúng giải tỏa ô đếm: gõ sai vài lần rồi tìm đúng thì bắt đầu lại từ đầu. */
      clear: (request: FastifyRequest) => {
        failureBuckets.delete(guestAttemptKey(request))
      },
    }

    /** Bọc handler tra cứu/hủy: chỉ lượt sai (404) được ghi vào ô dò mã, lượt đúng giải tỏa ô đếm. */
    function withGuestAttemptCounting(handler: (request: FastifyRequest) => Promise<unknown>) {
      return async (request: FastifyRequest) => {
        try {
          const result = await handler(request)
          guestAttempts.clear(request)
          return result
        } catch (error) {
          if (error instanceof AppError && error.statusCode === 404) guestAttempts.noteFailure(request)
          throw error
        }
      }
    }

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
     * Tra cứu đăng ký của khách bằng email + mã (E3, PAGE-PUB-08). Sai email hay sai mã đều một lỗi chung;
     * chỉ lượt sai mới đếm vào ngưỡng chặn dò mã `LOOKUP_MAX_ATTEMPTS` trong 15 phút (SEC-05, cùng quy tắc R4).
     */
    app.post(
      '/public/event-registrations/lookup',
      { preHandler: [limitPerSourceIp, guestAttempts.limit] },
      withGuestAttemptCounting(async (request) => lookupGuestRegistration(request.body)),
    )

    /** Hủy đăng ký của khách (E3, AC-09): trả về bản ghi vừa cập nhật; quy tắc chặn dò mã như tra cứu. */
    app.post(
      '/public/event-registrations/cancel',
      { preHandler: [limitPerSourceIp, guestAttempts.limit] },
      withGuestAttemptCounting(async (request) => cancelGuestRegistration(request.body)),
    )
  }
}
