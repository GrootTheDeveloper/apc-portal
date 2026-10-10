import { describe, expect, it } from 'vitest'

import { getProjectDetail, getProjectList } from './mock'

describe('projects mock data functions', () => {
  it('returns paginated projects with page size 12', async () => {
    const result = await getProjectList({ page: 1, pageSize: 12 })
    expect(result.items.length).toBe(12)
    expect(result.total).toBeGreaterThan(12)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(12)
  })

  it('filters projects by type', async () => {
    const result = await getProjectList({ page: 1, pageSize: 12, type: 'Nền tảng' })
    expect(result.items.length).toBeGreaterThan(0)
    for (const item of result.items) {
      expect(item.type).toBe('Nền tảng')
    }
  })

  it('returns detail for existing project slug', async () => {
    const item = await getProjectDetail('umt-online-judge')
    expect(item).not.toBeNull()
    expect(item?.name).toBe('UMT Online Judge (UMTOJ)')
    expect(item?.type).toBe('Nền tảng')
    expect(item?.members.length).toBeGreaterThan(0)
  })

  it('returns null for non-existent project slug', async () => {
    const item = await getProjectDetail('du-an-khong-ton-tai')
    expect(item).toBeNull()
  })
})
