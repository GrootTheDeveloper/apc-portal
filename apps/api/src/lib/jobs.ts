import type { FastifyBaseLogger } from 'fastify'

export type Job = {
  /** Dừng hẹn giờ và chờ lượt đang chạy (nếu có) xong. */
  stop: () => Promise<void>
}

/**
 * Tác vụ định kỳ chạy trong process API (docs/06 §5 mục 15). Khởi động trong server.ts, không chạy khi test
 * (test gọi thẳng `fn`).
 * - Lượt trước chưa xong thì bỏ qua lượt sau, không chạy chồng.
 * - `fn` ném lỗi thì ghi log mức lỗi kèm `name`, lượt sau vẫn chạy.
 * - Tác vụ đổi dữ liệu nghiệp vụ ghi nhật ký bằng `audit({ service: name }, ...)` (B1), không dùng tài khoản cá nhân.
 *
 *   const job = startJob('email', 10_000, () => processEmailQueue(mailer, app.log), app.log)
 *   await job.stop()
 */
export function startJob(name: string, everyMs: number, fn: () => Promise<unknown>, log: FastifyBaseLogger): Job {
  let running: Promise<void> | null = null

  const tick = () => {
    if (running) return
    running = fn()
      .then(
        () => undefined,
        (error: unknown) => log.error({ err: error, job: name }, 'Tác vụ nền bị lỗi'),
      )
      .finally(() => {
        running = null
      })
  }

  const timer = setInterval(tick, everyMs)
  return {
    stop: async () => {
      clearInterval(timer)
      await running
    },
  }
}
