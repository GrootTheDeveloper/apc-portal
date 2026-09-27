import { describe, expect, it } from 'vitest'

import { publicCode, slugify } from '../src/lib/ids.js'
import { pageArgs, pageQuery, toPage } from '../src/lib/pagination.js'

describe('pagination', () => {
  it('defaults, coerces query strings and caps pageSize', () => {
    expect(pageQuery.parse({})).toEqual({ page: 1, pageSize: 20 })
    expect(pageQuery.parse({ page: '3', pageSize: '10' })).toEqual({ page: 3, pageSize: 10 })
    expect(pageQuery.safeParse({ pageSize: '1000' }).success).toBe(false)
    expect(pageQuery.safeParse({ page: '0' }).success).toBe(false)
  })

  it('builds skip/take and the page envelope', () => {
    expect(pageArgs({ page: 3, pageSize: 10 })).toEqual({ skip: 20, take: 10 })
    expect(toPage(['a'], 21, { page: 3, pageSize: 10 })).toEqual({ items: ['a'], total: 21, page: 3, pageSize: 10 })
  })
})

describe('ids', () => {
  it('makes unambiguous random public codes', () => {
    const codes = new Set(Array.from({ length: 1000 }, () => publicCode()))
    expect(codes.size).toBe(1000)
    for (const code of codes) expect(code).toMatch(/^[2-9A-HJKMNP-Z]{12}$/)
  })

  it('slugifies Vietnamese titles', () => {
    expect(slugify('Workshop Git & GitHub cơ bản')).toBe('workshop-git-github-co-ban')
    expect(slugify('  Đêm hội Lập trình 2026!  ')).toBe('dem-hoi-lap-trinh-2026')
    expect(slugify('Tuyển thành viên đợt 1')).toBe('tuyen-thanh-vien-dot-1')
  })
})
