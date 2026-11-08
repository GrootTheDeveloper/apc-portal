// Kiểu dữ liệu và hằng số cho module nội dung (Tin tức & Dự án) trên web, khớp GET /public/news, /public/projects.
// Dùng chung cho các trang danh sách, chi tiết và các section ở trang chủ.

export type NewsItem = {
  id: string
  title: string
  slug: string
  summary: string
  thumbnailUrl: string | null
  category: string
  publishedAt: string | null
}

export type NewsDetailItem = NewsItem & {
  content: string
  metaTitle: string | null
  metaDescription: string | null
}

export const NEWS_CATEGORIES = ['Chuyên môn', 'Thông báo', 'Chia sẻ'] as const

export type ProjectItem = {
  id: string
  title: string
  slug: string
  description: string
  thumbnailUrl: string | null
  technologies: string[] | null
  projectUrl: string | null
  sourceUrl: string | null
  publishedAt: string | null
}

type CategoryStyle = {
  /** Mảng màu nhạt thay ảnh bìa khi bài chưa có ảnh */
  field: string
  /** Chữ chuyên mục */
  label: string
  /** Chấm màu (dòng thời gian ở trang chủ) */
  dot: string
  /** Biểu tượng Material Symbols trên mảng màu */
  icon: string
}

// Mỗi chuyên mục một màu logo (class literal để Tailwind JIT nhận diện).
const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  'Chuyên môn': { field: 'bg-apc-blue-pale text-apc-blue', label: 'text-apc-blue', dot: 'bg-apc-blue', icon: 'database' },
  'Thông báo': { field: 'bg-apc-gold-pale text-apc-gold-deep', label: 'text-apc-gold-deep', dot: 'bg-apc-gold', icon: 'campaign' },
  'Chia sẻ': { field: 'bg-apc-red-pale text-apc-red', label: 'text-apc-red', dot: 'bg-apc-red', icon: 'lightbulb' },
}
const FALLBACK_STYLE: CategoryStyle = { field: 'bg-soft text-muted', label: 'text-muted', dot: 'bg-ink', icon: 'article' }

export function newsCategoryStyle(category: string): CategoryStyle {
  return CATEGORY_STYLES[category] ?? FALLBACK_STYLE
}

/** Chỉ nhận link http(s) từ dữ liệu nhập tay; chặn `javascript:` và scheme lạ. */
export function safeHttpUrl(url?: string | null): string | undefined {
  return url && /^https?:\/\//i.test(url) ? url : undefined
}
