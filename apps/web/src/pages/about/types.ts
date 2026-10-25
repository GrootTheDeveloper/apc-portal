/** Hình dạng phản hồi GET /public/about — khớp với AboutResponse trong apps/api/src/modules/about/service.ts */

export type OfficialLink = { label: string; url: string }

export type AboutDepartment = {
  id: string
  name: string
  description: string
  contact: string
  order: number
}

export type AboutData = {
  name: string
  description: string
  mission: string
  contactEmail: string
  fanpage: string
  officialLinks: OfficialLink[]
  departments: AboutDepartment[]
}
