import type { FastifyError, FastifyInstance } from 'fastify'
import { ZodError } from 'zod'

// Lỗi trả về luôn có dạng { error, message } (docs/03 mục 14). Trong service chỉ cần `throw`:
//   throw notFound()                      → 404
//   throw conflict('Bạn đã đăng ký sự kiện này.')  → 409
//   schema.parse(request.body)            → sai dữ liệu tự thành 422 kèm `issues`
export class AppError extends Error {
  constructor(
    readonly statusCode: 401 | 403 | 404 | 409 | 422 | 429,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export const unauthenticated = (message = 'Bạn cần đăng nhập để tiếp tục.') =>
  new AppError(401, 'unauthenticated', message)
export const forbidden = (message = 'Bạn không có quyền thực hiện thao tác này.') =>
  new AppError(403, 'forbidden', message)
export const notFound = (message = 'Không tìm thấy dữ liệu.') => new AppError(404, 'not_found', message)
export const conflict = (message = 'Dữ liệu đã thay đổi hoặc bị trùng. Vui lòng tải lại.') =>
  new AppError(409, 'conflict', message)
export const rateLimited = (message = 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.') =>
  new AppError(429, 'rate_limited', message)

export function registerErrorHandler(app: FastifyInstance) {
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: 'not_found', message: 'Không tìm thấy.' }))

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ error: error.code, message: error.message })
    }
    if (error instanceof ZodError || error.statusCode === 400) {
      const issues = error instanceof ZodError ? error.issues : []
      return reply.code(422).send({ error: 'validation', message: 'Dữ liệu không hợp lệ.', issues })
    }
    // Lỗi Prisma: trùng unique (P2002) → 409, bản ghi không tồn tại (P2025) → 404.
    if (error.code === 'P2002') return reply.code(409).send({ error: 'conflict', message: 'Dữ liệu đã tồn tại.' })
    if (error.code === 'P2025') return reply.code(404).send({ error: 'not_found', message: 'Không tìm thấy dữ liệu.' })
    if (error.statusCode === 429) {
      return reply.code(429).send({ error: 'rate_limited', message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.' })
    }
    if (error.statusCode && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ error: 'bad_request', message: 'Yêu cầu không hợp lệ.' })
    }

    // ERR-500: ghi log đầy đủ, trả mã tham chiếu, không lộ stack trace.
    request.log.error(error)
    return reply.code(500).send({ error: 'internal', message: `Lỗi hệ thống. Mã tham chiếu: ${request.id}` })
  })
}
