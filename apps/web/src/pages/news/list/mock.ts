// MOCK DATA cho task C1 — sẽ thay bằng API thật ở task C2.
// Đổi MOCK_STATE để test các trạng thái UI: loading/empty/error/filter-empty.

import { ApiError, type Page } from '../../../lib/api'

export type NewsItem = {
  slug: string
  title: string
  excerpt: string
  category: string
  publishedAt: string
  coverUrl: string
  coverClass: string
  icon: string
  iconClass: string
  content: string
  author: { initials: string; name: string; role: string; avatarClass: string }
}

export const NEWS_CATEGORIES = ['Chuyên môn', 'Thông báo', 'Chia sẻ'] as const

// Đổi giá trị này để test các trạng thái UI. Nhớ đổi lại 'normal' trước khi commit.
export const MOCK_STATE: 'normal' | 'empty' | 'error' | 'filter-empty' = 'normal'

/** Chuyển tiêu đề có dấu thành slug không dấu: "Tối ưu SQL" → "toi-uu-sql" */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const DEFAULT_CONTENT = `Đây là nội dung mẫu của bài viết trong giai đoạn C1. Nội dung thật sẽ được lấy từ API ở giai đoạn C2.

Khi triển khai trang chi tiết, nội dung sẽ được tách theo dấu xuống dòng đôi và render mỗi đoạn thành một thẻ đoạn văn riêng.

Phần nội dung này chỉ để kiểm tra giao diện trang chi tiết — không cần nội dung thật ở giai đoạn C1. Có thể mở rộng thêm nhiều đoạn nếu cần test layout với bài viết dài.

Cảm ơn đã đọc đến đây!`

// 3 bài gốc, khớp với NewsSection ở trang chủ để không đổi giao diện trang chủ.
const FEATURED_NEWS: NewsItem[] = [
  {
    slug: 'toi-uu-hoa-query-sql-cho-ung-dung-web-quy-mo-lon',
    title: 'Tối ưu hóa query SQL cho ứng dụng web quy mô lớn',
    excerpt:
      'Tips thực tế từ dự án UMTOJ để giảm thời gian phản hồi của database xuống dưới 50ms khi xử lý hàng ngàn request đồng thời.',
    category: 'Chuyên môn',
    publishedAt: '2024-11-10T03:00:00Z',
    coverUrl: '',
    coverClass: 'from-apc-blue/15 to-surface-container-high',
    icon: 'database',
    iconClass: 'text-apc-blue/50',
    content: DEFAULT_CONTENT,
    author: { initials: 'TN', name: 'Trần Nam', role: 'Trưởng ban Kỹ thuật', avatarClass: 'bg-apc-blue text-white' },
  },
  {
    slug: 'tong-ket-chung-1-khoa-dao-tao-tan-binh-gen-3',
    title: 'Tổng kết chứng 1 - Khóa đào tạo Tân binh Gen 3',
    excerpt:
      'Nhìn lại 4 tuần đầu tiên đầy thử thách và nhiệt huyết của các thành viên mới. 100% hoàn thành project cá nhân giai đoạn 1.',
    category: 'Thông báo',
    publishedAt: '2024-11-05T03:00:00Z',
    coverUrl: '',
    coverClass: 'from-apc-gold/20 to-surface-container-high',
    icon: 'campaign',
    iconClass: 'text-apc-gold/60',
    content: DEFAULT_CONTENT,
    author: { initials: 'MA', name: 'Minh Anh', role: 'Ban Truyền thông', avatarClass: 'bg-apc-red text-white' },
  },
  {
    slug: 'kinh-nghiem-lam-san-pham-thuc-te-cho-sinh-vien-nam-nhat',
    title: 'Kinh nghiệm làm sản phẩm thực tế cho sinh viên năm nhất',
    excerpt:
      'Từ ý tưởng đến bản demo chạy được: cách chọn phạm vi vừa sức, chia việc theo tuần và giữ động lực khi gặp bug khó.',
    category: 'Chia sẻ',
    publishedAt: '2024-10-28T03:00:00Z',
    coverUrl: '',
    coverClass: 'from-apc-red/15 to-surface-container-high',
    icon: 'lightbulb',
    iconClass: 'text-apc-red/50',
    content: DEFAULT_CONTENT,
    author: { initials: 'QH', name: 'Quốc Huy', role: 'Ban Chuyên môn', avatarClass: 'bg-apc-gold text-apc-dark' },
  },
]

// 27 bài còn lại sinh từ template để đủ 30 bài test phân trang (12/trang → 3 trang).
const EXTRA_TITLES: { title: string; category: (typeof NEWS_CATEGORIES)[number] }[] = [
  { title: 'Giới thiệu React 19 và các tính năng mới', category: 'Chuyên môn' },
  { title: 'Tổng kết học kỳ 1 năm học 2024-2025', category: 'Thông báo' },
  { title: 'Hành trình từ sinh viên năm nhất đến intern', category: 'Chia sẻ' },
  { title: 'Docker hóa ứng dụng Node.js trong 15 phút', category: 'Chuyên môn' },
  { title: 'Khai giảng khóa đào tạo Tân binh Gen 4', category: 'Thông báo' },
  { title: 'Những sai lầm khi mới học lập trình', category: 'Chia sẻ' },
  { title: 'TypeScript nâng cao: Generic và Conditional Types', category: 'Chuyên môn' },
  { title: 'Lịch bảo trì hệ thống định kỳ tháng 12', category: 'Thông báo' },
  { title: 'Đọc sách Clean Code — review sau 3 tháng', category: 'Chia sẻ' },
  { title: 'Viết test hiệu quả với Vitest và Testing Library', category: 'Chuyên môn' },
  { title: 'Thông báo tuyển thành viên ban Truyền thông', category: 'Thông báo' },
  { title: 'Cách mình vượt qua nỗi sợ thuật toán', category: 'Chia sẻ' },
  { title: 'CI/CD với GitHub Actions cho monorepo', category: 'Chuyên môn' },
  { title: 'Kết quả cuộc thi lập trình APC Code Challenge 2024', category: 'Thông báo' },
  { title: 'Từ ý tưởng đến sản phẩm: bài học từ UMTOJ', category: 'Chia sẻ' },
  { title: 'Tối ưu bundle size cho ứng dụng Vite', category: 'Chuyên môn' },
  { title: 'Thay đổi lịch sinh hoạt câu lạc bộ', category: 'Thông báo' },
  { title: 'Làm sao để đọc code người khác nhanh hơn', category: 'Chia sẻ' },
  { title: 'Thiết kế API RESTful đúng chuẩn', category: 'Chuyên môn' },
  { title: 'Ra mắt cổng thông tin thành viên APC Portal', category: 'Thông báo' },
  { title: 'Trải nghiệm làm việc nhóm trong dự án thực tế', category: 'Chia sẻ' },
  { title: 'Hiểu sâu về React Hooks: useEffect', category: 'Chuyên môn' },
  { title: 'Hướng dẫn đăng ký tham gia sự kiện Tech Talk', category: 'Thông báo' },
  { title: 'Review khóa học CS50 của Harvard', category: 'Chia sẻ' },
  { title: 'Prisma vs TypeORM: nên chọn cái nào?', category: 'Chuyên môn' },
  { title: 'Thông báo nghỉ lễ Tết Nguyên Đán 2025', category: 'Thông báo' },
  { title: 'Tips phỏng vấn thực tập cho sinh viên IT', category: 'Chia sẻ' },
]

const COVER_CLASSES = [
  'from-apc-blue/15 to-surface-container-high',
  'from-apc-gold/20 to-surface-container-high',
  'from-apc-red/15 to-surface-container-high',
]
const ICON_CLASSES = ['text-apc-blue/50', 'text-apc-gold/60', 'text-apc-red/50']
const ICONS = ['database', 'campaign', 'lightbulb']
const AVATAR_CLASSES = ['bg-apc-blue text-white', 'bg-apc-red text-white', 'bg-apc-gold text-apc-dark']
const AUTHORS = [
  { initials: 'TN', name: 'Trần Nam', role: 'Trưởng ban Kỹ thuật' },
  { initials: 'MA', name: 'Minh Anh', role: 'Ban Truyền thông' },
  { initials: 'QH', name: 'Quốc Huy', role: 'Ban Chuyên môn' },
]

const EXTRA_NEWS: NewsItem[] = EXTRA_TITLES.map((entry, index) => {
  const cycle = index % 3
  // Rải ngày từ 2024-01, mỗi bài cách nhau 7 ngày, để test sắp xếp + phân trang.
  const published = new Date(Date.UTC(2024, 0, 1) + index * 7 * 24 * 60 * 60 * 1000)
  const author = AUTHORS[cycle]
  if (!author) throw new Error('Mock author cycle lỗi')
  return {
    slug: slugify(entry.title),
    title: entry.title,
    excerpt: 'Bài viết mẫu cho giai đoạn C1 — nội dung sẽ được thay bằng dữ liệu thật ở C2.',
    category: entry.category,
    publishedAt: published.toISOString(),
    coverUrl: '',
    coverClass: COVER_CLASSES[cycle] ?? COVER_CLASSES[0]!,
    icon: ICONS[cycle] ?? ICONS[0]!,
    iconClass: ICON_CLASSES[cycle] ?? ICON_CLASSES[0]!,
    content: DEFAULT_CONTENT,
    author: { ...author, avatarClass: AVATAR_CLASSES[cycle] ?? AVATAR_CLASSES[0]! },
  }
})

export const MOCK_NEWS: NewsItem[] = [...FEATURED_NEWS, ...EXTRA_NEWS]

/**
 * Lấy danh sách tin tức có phân trang + lọc chuyên mục.
 * Sang C2 chỉ cần đổi thân hàm này thành gọi api(...) — chữ ký giữ nguyên.
 */
export async function getNewsList(params: {
  page: number
  pageSize: number
  category?: string
}): Promise<Page<NewsItem>> {
  const { page, pageSize, category } = params

  // Giả lập độ trễ mạng để thấy trạng thái loading.
  await new Promise((resolve) => setTimeout(resolve, 400))

  if (MOCK_STATE === 'error') {
    throw new ApiError(500, 'mock_error', 'Không tải được tin tức. Vui lòng thử lại.')
  }

  if (MOCK_STATE === 'empty') {
    return { items: [], total: 0, page, pageSize }
  }

  const filtered = category ? MOCK_NEWS.filter((item) => item.category === category) : MOCK_NEWS

  // Sắp xếp mới nhất trước.
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  )

  const total = sorted.length

  // Mô phỏng trường hợp "không có kết quả theo bộ lọc": total > 0 nhưng items rỗng.
  if (MOCK_STATE === 'filter-empty' && category) {
    return { items: [], total, page, pageSize }
  }

  const start = (page - 1) * pageSize
  const items = sorted.slice(start, start + pageSize)

  return { items, total, page, pageSize }
}

/**
 * Lấy chi tiết tin tức theo slug. Trả null nếu không tìm thấy (để trang hiện NotFound).
 */
export async function getNewsDetail(slug: string): Promise<NewsItem | null> {
  await new Promise((resolve) => setTimeout(resolve, 400))

  if (MOCK_STATE === 'error') {
    throw new ApiError(500, 'mock_error', 'Không tải được bài viết. Vui lòng thử lại.')
  }

  return MOCK_NEWS.find((item) => item.slug === slug) ?? null
}