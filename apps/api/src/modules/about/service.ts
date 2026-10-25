import { z } from 'zod'

import { db } from '../../db/client.js'
import { notFound } from '../../lib/errors.js'

const httpUrl = z.string().regex(/^https?:\/\//i)

/** Hình dạng cột JSON `site_settings.info`. Trang quản trị sau này ghi đúng hình dạng này. */
const aboutInfo = z.object({
  name: z.string(),
  description: z.string(),
  mission: z.string(),
  contactEmail: z.string(),
  fanpage: httpUrl,
  officialLinks: z.array(z.object({ label: z.string(), url: httpUrl })).default([]),
})

/**
 * GET /public/about — thông tin CLB và các ban ACTIVE theo thứ tự `order`.
 * termEndsAt KHÔNG trả ra ngoài (QĐ-6).
 */
export async function getAbout() {
  const [setting, departments] = await Promise.all([
    db.siteSetting.findUnique({ where: { id: 'singleton' } }),
    db.department.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, description: true, contactPoint: true, order: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    }),
  ])
  if (!setting) throw notFound('Chưa có thông tin giới thiệu.')

  // Dữ liệu trong DB sai hình dạng là lỗi máy chủ (500), không phải lỗi người gọi (422).
  const info = aboutInfo.safeParse(setting.info)
  if (!info.success) throw new Error('site_settings.info sai định dạng', { cause: info.error })

  return {
    ...info.data,
    departments: departments.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description ?? '',
      contact: d.contactPoint ?? '',
      order: d.order,
    })),
  }
}
