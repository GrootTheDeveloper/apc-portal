import { db } from '../../db/client.js'
import { notFound } from '../../lib/errors.js'

export type OfficialLink = { label: string; url: string }

export type AboutDepartment = {
  id: string
  name: string
  description: string
  contact: string
  order: number
}

export type AboutInfo = {
  name: string
  description: string
  mission: string
  contactEmail: string
  fanpage: string
  officialLinks: OfficialLink[]
}

export type AboutResponse = AboutInfo & { departments: AboutDepartment[] }

/**
 * GET /public/about — thông tin CLB và các ban ACTIVE theo thứ tự `order`.
 * termEndsAt KHÔNG trả ra ngoài (QĐ-6).
 */
export async function getAbout(): Promise<AboutResponse> {
  const [setting, departments] = await Promise.all([
    db.siteSetting.findUnique({ where: { id: 'singleton' } }),
    db.department.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, description: true, contactPoint: true, order: true },
      orderBy: { order: 'asc' },
    }),
  ])

  if (!setting) {
    throw notFound()
  }

  const info = setting.info as AboutInfo

  return {
    name: info.name,
    description: info.description,
    mission: info.mission,
    contactEmail: info.contactEmail,
    fanpage: info.fanpage,
    officialLinks: info.officialLinks ?? [],
    departments: departments.map((d: { id: string; name: string; description: string | null; contactPoint: string | null; order: number }) => ({
      id: d.id,
      name: d.name,
      description: d.description ?? '',
      contact: d.contactPoint ?? '',
      order: d.order,
    })),
  }
}
