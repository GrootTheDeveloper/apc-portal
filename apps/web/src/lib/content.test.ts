import { describe, expect, it } from 'vitest'

import {
  getNewsCategoryChipClass,
  getNewsCategoryVisual,
  getProjectTypeColorClass,
  NEWS_CATEGORIES,
  safeHttpUrl,
} from './content'

describe('content helpers & constants', () => {
  it('has expected categories', () => {
    expect(NEWS_CATEGORIES).toEqual(['Chuyên môn', 'Thông báo', 'Chia sẻ'])
  })

  it('only accepts http(s) links', () => {
    expect(safeHttpUrl('https://apc.umt.edu.vn')).toBe('https://apc.umt.edu.vn')
    expect(safeHttpUrl('http://example.com')).toBe('http://example.com')
    expect(safeHttpUrl('javascript:alert(1)')).toBeUndefined()
    expect(safeHttpUrl('//evil.com')).toBeUndefined()
    expect(safeHttpUrl(null)).toBeUndefined()
  })

  it('returns valid chip class for each news category', () => {
    expect(getNewsCategoryChipClass('Chuyên môn')).toContain('text-apc-blue')
    expect(getNewsCategoryChipClass('Thông báo')).toContain('text-apc-gold')
    expect(getNewsCategoryChipClass('Chia sẻ')).toContain('text-apc-red')
    expect(getNewsCategoryChipClass('Khác')).toContain('text-on-surface-variant')
  })

  it('returns valid visual fallback for news categories', () => {
    const tech = getNewsCategoryVisual('Chuyên môn')
    expect(tech.icon).toBe('database')
    expect(tech.coverClass).toContain('from-apc-blue')

    const notice = getNewsCategoryVisual('Thông báo')
    expect(notice.icon).toBe('campaign')
    expect(notice.coverClass).toContain('from-apc-gold')

    const share = getNewsCategoryVisual('Chia sẻ')
    expect(share.icon).toBe('lightbulb')
    expect(share.coverClass).toContain('from-apc-red')

    const unknown = getNewsCategoryVisual('Khác')
    expect(unknown.icon).toBe('article')
  })

  it('returns valid color class for each project type', () => {
    expect(getProjectTypeColorClass('Nền tảng')).toBe('text-apc-red')
    expect(getProjectTypeColorClass('Công cụ')).toBe('text-apc-blue')
    expect(getProjectTypeColorClass('Sản phẩm')).toBe('text-apc-gold')
    expect(getProjectTypeColorClass(undefined)).toBe('text-apc-blue')
  })
})
