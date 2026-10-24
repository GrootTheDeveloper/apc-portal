import type { FastifyBaseLogger } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { startJob } from '../src/lib/jobs.js'

const fakeLog = () => {
  const error = vi.fn()
  return { log: { error } as unknown as FastifyBaseLogger, error }
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

afterEach(() => {
  vi.useRealTimers()
})

describe('startJob', () => {
  it('bỏ qua lượt mới khi lượt trước chưa xong, không chạy chồng', async () => {
    vi.useFakeTimers()
    let calls = 0
    let active = 0
    let maxActive = 0
    const job = startJob(
      'cham',
      10,
      async () => {
        calls++
        active++
        maxActive = Math.max(maxActive, active)
        await sleep(35)
        active--
      },
      fakeLog().log,
    )

    // Hẹn giờ ở 10, 20, …, 100ms; mỗi lượt mất 35ms nên chỉ lượt ở 10, 50, 90 được chạy.
    await vi.advanceTimersByTimeAsync(100)
    const stopping = job.stop()
    await vi.advanceTimersByTimeAsync(50)
    await stopping

    expect(calls).toBe(3)
    expect(maxActive).toBe(1)
  })

  it('fn ném lỗi thì ghi log kèm tên tác vụ và lượt sau vẫn chạy', async () => {
    vi.useFakeTimers()
    const { log, error } = fakeLog()
    const fn = vi.fn(async () => {
      throw new Error('hỏng')
    })
    const job = startJob('loi', 10, fn, log)

    await vi.advanceTimersByTimeAsync(30)
    await job.stop()

    expect(fn).toHaveBeenCalledTimes(3)
    expect(error).toHaveBeenCalledTimes(3)
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ job: 'loi' }), expect.any(String))
  })

  it('stop() dừng hẹn giờ, không chạy thêm lượt nào', async () => {
    vi.useFakeTimers()
    const fn = vi.fn(async () => undefined)
    const job = startJob('dung', 10, fn, fakeLog().log)

    await vi.advanceTimersByTimeAsync(20)
    await job.stop()
    await vi.advanceTimersByTimeAsync(100)

    expect(fn).toHaveBeenCalledTimes(2)
  })
})
