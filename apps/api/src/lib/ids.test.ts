import { describe, expect, it, vi } from 'vitest'

import { buildUniqueSlug } from './ids.js'

describe('buildUniqueSlug', () => {
  it('slug chưa tồn tại thì trả nguyên slug gốc', async () => {
    const exists = vi.fn(async () => false)
    await expect(buildUniqueSlug('du-an-moi', exists)).resolves.toBe('du-an-moi')
    expect(exists).toHaveBeenCalledWith('du-an-moi')
    expect(exists).toHaveBeenCalledTimes(1)
  })

  it('slug đã tồn tại thì trả slug kèm hậu tố hex ngẫu nhiên', async () => {
    // Chỉ slug gốc tồn tại; ứng viên có hậu tố thì chưa có
    const exists = vi.fn(async (slug: string) => slug === 'du-an-moi')
    const result = await buildUniqueSlug('du-an-moi', exists)
    expect(result).toMatch(/^du-an-moi-[0-9a-f]{8}$/)
    expect(result).not.toBe('du-an-moi')
  })

  it('hậu tố sinh ra đúng dạng 8 ký tự hex', async () => {
    const exists = vi.fn(async (slug: string) => slug === 'du-an-moi')
    const result = await buildUniqueSlug('du-an-moi', exists)
    const suffix = result.slice('du-an-moi'.length + 1)
    expect(suffix).toMatch(/^[0-9a-f]{8}$/)
  })

  it('slug trùng liên tục thì sau 5 lần thử ném lỗi rõ ràng', async () => {
    const exists = vi.fn(async () => true)
    await expect(buildUniqueSlug('du-an-moi', exists)).rejects.toThrow(
      'Không sinh được slug duy nhất cho "du-an-moi" sau 5 lần thử.',
    )
    // 1 lần thử slug gốc + 5 lần thử hậu tố
    expect(exists).toHaveBeenCalledTimes(6)
  })
})
