import { describe, expect, it } from 'vitest'

import { DEFAULT_AFTER_LOGIN, loginUrl, safeReturnTo } from './returnTo'

describe('safeReturnTo', () => {
  it('keeps internal paths with their query string', () => {
    expect(safeReturnTo('/admin')).toBe('/admin')
    expect(safeReturnTo('/portal')).toBe('/portal')
    expect(safeReturnTo('/news?page=2')).toBe('/news?page=2')
  })

  it('falls back to /portal for missing, external or tricky values (no open redirect)', () => {
    for (const value of [
      null,
      undefined,
      '',
      'admin',
      'https://evil.example/login',
      '//evil.example',
      '/\\evil.example',
      '/\t/evil.example',
      'javascript:alert(1)',
      '/login',
      '/login?returnTo=/admin',
      '/khong-ton-tai',
      '/admin/../../evil',
    ]) {
      expect(safeReturnTo(value)).toBe(DEFAULT_AFTER_LOGIN)
    }
  })

  it('builds the login link that remembers the current page', () => {
    expect(loginUrl('/admin?tab=1')).toBe('/login?returnTo=%2Fadmin%3Ftab%3D1')
  })
})
