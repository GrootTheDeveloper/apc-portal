import { describe, expect, it } from 'vitest'

import { NEWS_CATEGORIES, newsCategoryStyle, safeHttpUrl } from './content'

describe('content helpers & constants', () => {
  it('has expected categories', () => {
    expect(NEWS_CATEGORIES).toEqual(['Chuyên môn', 'Thông báo', 'Chia sẻ'])
  })

  it('gives each category its own logo color, unknown ones a neutral style', () => {
    expect(newsCategoryStyle('Chuyên môn').label).toBe('text-apc-blue')
    expect(newsCategoryStyle('Thông báo').label).toBe('text-apc-gold-deep')
    expect(newsCategoryStyle('Chia sẻ').label).toBe('text-apc-red')
    expect(newsCategoryStyle('Khác')).toMatchObject({ label: 'text-muted', icon: 'article' })
  })

  it('only accepts http(s) links', () => {
    expect(safeHttpUrl('https://apc.umt.edu.vn')).toBe('https://apc.umt.edu.vn')
    expect(safeHttpUrl('http://example.com')).toBe('http://example.com')
    expect(safeHttpUrl('javascript:alert(1)')).toBeUndefined()
    expect(safeHttpUrl('//evil.com')).toBeUndefined()
    expect(safeHttpUrl(null)).toBeUndefined()
  })
})
