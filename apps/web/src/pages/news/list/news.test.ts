import { describe, expect, it } from 'vitest'

import { getNewsDetail, getNewsList } from './mock'

describe('news mock data functions', () => {
  it('returns paginated news items with default page size 12', async () => {
    const result = await getNewsList({ page: 1, pageSize: 12 })
    expect(result.items.length).toBe(12)
    expect(result.total).toBeGreaterThan(12)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(12)
  })

  it('filters news by category', async () => {
    const result = await getNewsList({ page: 1, pageSize: 12, category: 'Chuyên môn' })
    expect(result.items.length).toBeGreaterThan(0)
    for (const item of result.items) {
      expect(item.category).toBe('Chuyên môn')
    }
  })

  it('returns detail for existing news slug', async () => {
    const item = await getNewsDetail('toi-uu-hoa-query-sql-cho-ung-dung-web-quy-mo-lon')
    expect(item).not.toBeNull()
    expect(item?.title).toBe('Tối ưu hóa query SQL cho ứng dụng web quy mô lớn')
    expect(item?.category).toBe('Chuyên môn')
  })

  it('returns null for non-existent news slug', async () => {
    const item = await getNewsDetail('slug-khong-ton-tai')
    expect(item).toBeNull()
  })
})
