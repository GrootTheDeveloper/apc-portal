// Kiểu dữ liệu và hằng số cho module nội dung (Tin tức & Dự án) trên web.
// Dùng chung cho các trang danh sách, chi tiết và các section ở trang chủ.

export type NewsItem = {
  id?: string
  title: string
  slug: string
  summary: string
  excerpt?: string // Tương thích ngược nếu còn component cũ gọi
  thumbnailUrl?: string | null
  coverUrl?: string | null // Tương thích ngược
  category: string
  publishedAt?: string | null
  metaTitle?: string | null
  metaDescription?: string | null
}

export type NewsDetailItem = NewsItem & {
  content: string
}

export const NEWS_CATEGORIES = ['Chuyên môn', 'Thông báo', 'Chia sẻ'] as const
export type NewsCategory = (typeof NEWS_CATEGORIES)[number]

export type ProjectMember = {
  initials: string
  name: string
  role: string
}

export type ProjectItem = {
  id?: string
  title: string
  name?: string // Tương thích ngược nếu còn component cũ gọi
  slug: string
  description: string
  thumbnailUrl?: string | null
  imageUrl?: string | null // Tương thích ngược
  technologies?: string[] | null
  projectUrl?: string | null
  productUrl?: string | null // Tương thích ngược
  sourceUrl?: string | null
  publishedAt?: string | null
  type?: string
  members?: ProjectMember[]
  featured?: boolean
}

export const PROJECT_TYPES = ['Nền tảng', 'Công cụ', 'Sản phẩm'] as const
export type ProjectType = (typeof PROJECT_TYPES)[number]

/** Lấy style màu sắc theo loại dự án */
export function getProjectTypeColorClass(type?: string): string {
  switch (type) {
    case 'Nền tảng':
      return 'text-apc-red'
    case 'Công cụ':
      return 'text-apc-blue'
    case 'Sản phẩm':
      return 'text-apc-gold'
    default:
      return 'text-apc-blue'
  }
}

/** Lấy style chip phân loại chuyên mục tin tức */
export function getNewsCategoryChipClass(category: string): string {
  switch (category) {
    case 'Chuyên môn':
      return 'bg-apc-blue/10 text-apc-blue'
    case 'Thông báo':
      return 'bg-apc-gold/10 text-apc-gold'
    case 'Chia sẻ':
      return 'bg-apc-red/10 text-apc-red'
    default:
      return 'bg-surface-container-highest text-on-surface-variant'
  }
}

/** Lấy hình ảnh / gradient và biểu tượng đại diện theo chuyên mục tin tức khi chưa có thumbnail */
export function getNewsCategoryVisual(category: string): {
  coverClass: string
  icon: string
  iconClass: string
} {
  switch (category) {
    case 'Chuyên môn':
      return {
        coverClass: 'from-apc-blue/15 to-surface-container-high',
        icon: 'database',
        iconClass: 'text-apc-blue/50',
      }
    case 'Thông báo':
      return {
        coverClass: 'from-apc-gold/20 to-surface-container-high',
        icon: 'campaign',
        iconClass: 'text-apc-gold/60',
      }
    case 'Chia sẻ':
      return {
        coverClass: 'from-apc-red/15 to-surface-container-high',
        icon: 'lightbulb',
        iconClass: 'text-apc-red/50',
      }
    default:
      return {
        coverClass: 'from-apc-blue/15 to-surface-container-high',
        icon: 'article',
        iconClass: 'text-apc-blue/50',
      }
  }
}
