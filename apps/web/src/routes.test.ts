import { describe, expect, it } from 'vitest'

import { safeReturnTo } from './lib/returnTo'
import { isAppPath } from './routes'

describe('isAppPath (route tree is the single source for returnTo)', () => {
  it('accepts public, portal and admin routes declared once in routes.tsx or the menu', () => {
    for (const path of ['/', '/news', '/news/bai-viet-bat-ky', '/portal', '/portal/account/security', '/admin', '/admin/events']) {
      expect(isAppPath(path)).toBe(true)
    }
  })

  it('rejects paths that only reach the 404 page', () => {
    for (const path of ['/khong-ton-tai', '/portal/khong-ton-tai', '/admin/system', '/admin/data-retention']) {
      expect(isAppPath(path)).toBe(false)
    }
  })

  it('lets login return to any page added to the menu without a second declaration', () => {
    expect(safeReturnTo('/admin/organization/departments?tab=1', isAppPath)).toBe('/admin/organization/departments?tab=1')
    expect(safeReturnTo('/khong-ton-tai', isAppPath)).toBe('/portal')
  })
})
