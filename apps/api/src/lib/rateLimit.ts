import type { FastifyInstance, FastifyRequest } from 'fastify'
import { AppError, rateLimited } from './errors.js'

/**
 * Khóa giới hạn tần suất theo cả địa chỉ nguồn lẫn email trong body (SEC-05):
 * Mỗi cặp (IP, email) có một ô đếm riêng. Cắt email ở 120 ký tự để tránh phình bộ nhớ cache.
 */
export function createBodyEmailRateLimitKey(prefix: string) {
  return (request: FastifyRequest) => {
    const body = request.body && typeof request.body === 'object' ? (request.body as Record<string, unknown>) : {}
    const email = String(body.email ?? body.applicantEmail ?? '')
    return `${prefix}:${request.ip}:${email.toLowerCase().trim().slice(0, 120)}`
  }
}

export type SourceIpLimiterOptions = {
  prefix?: string
  max?: number
  timeWindow?: string
  message?: string
}

/**
 * Lớp 2 của chặn lạm dụng (SEC-05): Giới hạn theo mỗi địa chỉ nguồn (IP) —
 * Một IP xoay nhiều email vẫn chỉ gửi được tối đa số lượt cấu hình (mặc định 30 lượt/15 phút)
 * trên toàn bộ các route công khai của mảng.
 */
export function createSourceIpLimiter(app: FastifyInstance, options?: SourceIpLimiterOptions) {
  const prefix = options?.prefix ?? 'public'
  const max = options?.max ?? 30
  const timeWindow = options?.timeWindow ?? '15 minutes'
  const message = options?.message ?? 'Bạn thao tác quá nhiều lần từ địa chỉ này. Vui lòng thử lại sau.'

  const limiter = app.createRateLimit({
    max,
    timeWindow,
    keyGenerator: (request) => `${prefix}:${request.ip}`,
  })

  return async (request: FastifyRequest) => {
    const result = await limiter(request)
    if (!result.isAllowed && result.isExceeded) {
      throw rateLimited(message)
    }
  }
}

export type LookupAttemptLimiterOptions = {
  prefix: string
  maxAttempts: number
  windowMs?: number
  message?: string
  extractEmail?: (request: FastifyRequest) => string
}

/**
 * Chặn dò mã công khai (SEC-05, R4 & E3):
 * CHỈ lượt SAI (404 — sai email hoặc sai mã) mới tính vào ô đếm của cặp (IP, email).
 * Lượt ĐÚNG giải tỏa ô đếm (xóa bucket) nên không tốn hạn mức.
 * Sai quá `maxAttempts` lần trong `windowMs` (mặc định 15 phút) thì nhận 429.
 */
export function createLookupAttemptLimiter(options: LookupAttemptLimiterOptions) {
  const {
    prefix,
    maxAttempts,
    windowMs = 15 * 60_000,
    message = `Bạn nhập sai quá ${maxAttempts} lần. Vui lòng thử lại sau 15 phút.`,
    extractEmail = (request: FastifyRequest) => {
      const body = request.body && typeof request.body === 'object' ? (request.body as Record<string, unknown>) : {}
      return String(body.email ?? body.applicantEmail ?? '')
    },
  } = options

  const failureBuckets = new Map<string, { count: number; resetAt: number }>()

  function keyOf(request: FastifyRequest) {
    const email = extractEmail(request).toLowerCase().trim().slice(0, 120)
    return `${prefix}:${request.ip}:${email}`
  }

  const limit = async (request: FastifyRequest) => {
    const now = Date.now()
    const bucket = failureBuckets.get(keyOf(request))
    if (bucket && bucket.resetAt > now && bucket.count >= maxAttempts) {
      throw rateLimited(message)
    }
  }

  const noteFailure = (request: FastifyRequest) => {
    const key = keyOf(request)
    const now = Date.now()
    if (failureBuckets.size > 10_000) {
      for (const [staleKey, stale] of failureBuckets) {
        if (stale.resetAt <= now) failureBuckets.delete(staleKey)
      }
    }
    const bucket = failureBuckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      failureBuckets.set(key, { count: 1, resetAt: now + windowMs })
    } else {
      bucket.count += 1
    }
  }

  const clear = (request: FastifyRequest) => {
    failureBuckets.delete(keyOf(request))
  }

  const wrap = <T>(handler: (request: FastifyRequest) => Promise<T>) => {
    return async (request: FastifyRequest): Promise<T> => {
      try {
        const result = await handler(request)
        clear(request)
        return result
      } catch (error) {
        if (error instanceof AppError && error.statusCode === 404) {
          noteFailure(request)
        }
        throw error
      }
    }
  }

  return {
    limit,
    noteFailure,
    clear,
    wrap,
    withAttemptCounting: wrap,
  }
}
