// MOCK DATA cho task C1 — sẽ thay bằng API thật ở task C2.
// Đổi MOCK_STATE để test các trạng thái UI: loading/empty/error/filter-empty.

import { ApiError, type Page } from '../../../lib/api'

export type ProjectType = 'Nền tảng' | 'Công cụ' | 'Sản phẩm'

export type ProjectMember = {
  initials: string
  name: string
  role: string
}

export type ProjectItem = {
  slug: string
  name: string
  type: ProjectType
  description: string
  imageUrl: string
  coverClass: string
  technologies: string[]
  members: ProjectMember[]
  productUrl?: string
  sourceUrl?: string
  featured: boolean
}

export const PROJECT_TYPES: ProjectType[] = ['Nền tảng', 'Công cụ', 'Sản phẩm']

// Đổi giá trị này để test các trạng thái UI. Nhớ đổi lại 'normal' trước khi commit.
export const MOCK_STATE: 'normal' | 'empty' | 'error' | 'filter-empty' = 'normal'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// 2 dự án nổi bật (featured: true) — khớp với ProjectsSection ở trang chủ.
const FEATURED_PROJECTS: ProjectItem[] = [
  {
    slug: 'umt-online-judge',
    name: 'UMT Online Judge (UMTOJ)',
    type: 'Nền tảng',
    description:
      'Chấm bài tự động và luyện tập lập trình thi đấu dành riêng cho sinh viên UMT — hỗ trợ đa ngôn ngữ, phân loại độ khó và bảng xếp hạng realtime.',
    imageUrl: '/assets/home/06-umt-online-judge.jpg',
    coverClass: 'from-apc-red/15 to-surface-container-high',
    technologies: ['React', 'Node.js', 'Docker'],
    members: [
      { initials: 'TN', name: 'Trần Nam', role: 'Trưởng nhóm' },
      { initials: 'QH', name: 'Quốc Huy', role: 'Backend' },
      { initials: 'MA', name: 'Minh Anh', role: 'Frontend' },
    ],
    productUrl: 'https://umtoj.umt.edu.vn',
    sourceUrl: 'https://github.com/apc-umt/umtoj',
    featured: true,
  },
  {
    slug: 'apc-event-manager',
    name: 'APC Event Manager',
    type: 'Công cụ',
    description:
      'Quản lý sự kiện, điểm danh và cấp certificate tự động cho các hoạt động của câu lạc bộ.',
    imageUrl: '/assets/home/07-apc-event-manager.jpg',
    coverClass: 'from-apc-blue/15 to-surface-container-high',
    technologies: ['Next.js', 'Prisma', 'PostgreSQL'],
    members: [
      { initials: 'MA', name: 'Minh Anh', role: 'Trưởng nhóm' },
      { initials: 'TN', name: 'Trần Nam', role: 'Fullstack' },
    ],
    sourceUrl: 'https://github.com/apc-umt/event-manager',
    featured: true,
  },
]

const EXTRA_PROJECT_TITLES: { name: string; type: ProjectType }[] = [
  { name: 'APC Portal', type: 'Nền tảng' },
  { name: 'CLI tạo project nhanh', type: 'Công cụ' },
  { name: 'Hệ thống điểm danh QR', type: 'Công cụ' },
  { name: 'Blog chia sẻ kiến thức APC', type: 'Nền tảng' },
  { name: 'Bot Discord quản lý câu lạc bộ', type: 'Công cụ' },
  { name: 'Ứng dụng học từ vựng tiếng Anh', type: 'Sản phẩm' },
  { name: 'Dashboard thống kê hoạt động CLB', type: 'Nền tảng' },
  { name: 'Tool chấm điểm tự động', type: 'Công cụ' },
  { name: 'Landing page cho sự kiện Tech Talk', type: 'Sản phẩm' },
  { name: 'Chatbot tư vấn tuyển sinh', type: 'Sản phẩm' },
  { name: 'Hệ thống quản lý thư viện sách', type: 'Nền tảng' },
  { name: 'Extension VS Code cho APC', type: 'Công cụ' },
  { name: 'API gateway nội bộ', type: 'Nền tảng' },
]

const TECH_POOL = [
  ['React', 'TypeScript', 'Tailwind'],
  ['Next.js', 'Prisma', 'PostgreSQL'],
  ['Node.js', 'Fastify', 'Docker'],
  ['Vue', 'Vite', 'Firebase'],
  ['Python', 'FastAPI', 'Redis'],
]

const MEMBER_POOL: ProjectMember[][] = [
  [
    { initials: 'TN', name: 'Trần Nam', role: 'Trưởng nhóm' },
    { initials: 'QH', name: 'Quốc Huy', role: 'Backend' },
  ],
  [
    { initials: 'MA', name: 'Minh Anh', role: 'Frontend' },
    { initials: 'TN', name: 'Trần Nam', role: 'DevOps' },
  ],
  [
    { initials: 'QH', name: 'Quốc Huy', role: 'Fullstack' },
    { initials: 'MA', name: 'Minh Anh', role: 'Design' },
    { initials: 'TN', name: 'Trần Nam', role: 'QA' },
  ],
]

const EXTRA_PROJECTS: ProjectItem[] = EXTRA_PROJECT_TITLES.map((entry, index) => {
  const cycle = index % 3
  return {
    slug: slugify(entry.name),
    name: entry.name,
    type: entry.type,
    description: 'Dự án mẫu cho giai đoạn C1 — nội dung sẽ được thay bằng dữ liệu thật ở C2.',
    imageUrl: '',
    coverClass: 'from-apc-blue/15 to-surface-container-high',
    technologies: TECH_POOL[cycle] ?? TECH_POOL[0]!,
    members: MEMBER_POOL[cycle] ?? MEMBER_POOL[0]!,
    featured: false,
  }
})

export const MOCK_PROJECTS: ProjectItem[] = [...FEATURED_PROJECTS, ...EXTRA_PROJECTS]

/**
 * Lấy danh sách dự án có phân trang + lọc loại. Sang C2 chỉ cần đổi thân hàm thành api(...).
 */
export async function getProjectList(params: {
  page: number
  pageSize: number
  type?: string
}): Promise<Page<ProjectItem>> {
  const { page, pageSize, type } = params

  await new Promise((resolve) => setTimeout(resolve, 400))

  if (MOCK_STATE === 'error') {
    throw new ApiError(500, 'mock_error', 'Không tải được dự án. Vui lòng thử lại.')
  }

  if (MOCK_STATE === 'empty') {
    return { items: [], total: 0, page, pageSize }
  }

  const filtered = type ? MOCK_PROJECTS.filter((item) => item.type === type) : MOCK_PROJECTS
  const total = filtered.length

  if (MOCK_STATE === 'filter-empty' && type) {
    return { items: [], total, page, pageSize }
  }

  const start = (page - 1) * pageSize
  const items = filtered.slice(start, start + pageSize)

  return { items, total, page, pageSize }
}

/**
 * Lấy chi tiết dự án theo slug. Trả null nếu không tìm thấy.
 */
export async function getProjectDetail(slug: string): Promise<ProjectItem | null> {
  await new Promise((resolve) => setTimeout(resolve, 400))

  if (MOCK_STATE === 'error') {
    throw new ApiError(500, 'mock_error', 'Không tải được dự án. Vui lòng thử lại.')
  }

  return MOCK_PROJECTS.find((item) => item.slug === slug) ?? null
}