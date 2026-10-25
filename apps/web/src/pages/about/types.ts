// Hình dạng phản hồi GET /public/about (apps/api/src/modules/about/service.ts).

export type OfficialLink = { label: string; url: string }

export type Department = {
  id: string
  name: string
  description: string
  /** Kênh liên hệ chung của ban (email ban / fanpage / chức danh) — KHÔNG phải tên, email, SĐT cá nhân (BR-20, DATA-03). Rỗng thì ẩn. */
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
  departments: Department[]
}
